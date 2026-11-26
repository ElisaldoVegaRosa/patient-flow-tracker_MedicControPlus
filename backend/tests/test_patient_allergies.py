import json
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from app import main
from app.patient_allergies import migrate_allergies


class Context(tuple):
    def __repr__(self):
        return 'AllergiesContext(temporary database)'


@pytest.fixture
def flow(tmp_path,monkeypatch):
    monkeypatch.setattr(main,'DATABASE_PATH',tmp_path/'allergies.db')
    with TestClient(main.app) as client:
        users={}
        def login(name='medico'):
            if name not in users:
                response=client.post('/auth/login',json={'username':name,'password':'demo123'})
                assert response.status_code==200
                users[name]={'Authorization':'Bearer '+response.json()['access_token']}
            return users[name]
        c=main.get_connection()
        try:
            c.execute("INSERT INTO users(username,password_hash,password_salt,role,active,created_at,display_name) SELECT 'otro.medico',password_hash,password_salt,'DOCTOR',1,created_at,'Otro medico ficticio' FROM users WHERE username='medico'")
            doctor=c.execute("SELECT id FROM users WHERE username='medico'").fetchone()[0]
            other=c.execute("SELECT id FROM users WHERE username='otro.medico'").fetchone()[0]
            for _ in range(2):
                c.execute("INSERT INTO patients(name,birth_date,document) VALUES ('Paciente alergias ficticio','1990-01-01','SAME-DEMO')")
            ids=[]
            for patient,status in [(1,'ACTIVE'),(1,'CLOSED'),(2,'ACTIVE')]:
                eid=c.execute("INSERT INTO episodes(patient_id,qr_token,status,priority,location,started_at) VALUES (?,?,?,3,'Consulta','2026-11-25T12:00:00Z')",(patient,str(uuid4()),status)).lastrowid
                c.execute("INSERT INTO care_episodes(episode_id,ready_at) VALUES (?,'2026-11-25T12:00:00Z')",(eid,))
                c.execute("INSERT INTO care_slots(episode_id,discipline,user_id) VALUES (?,'DOCTOR',?)",(eid,doctor))
                ids.append(eid)
            c.commit()
        finally:
            c.close()
        yield Context((client,login,ids,doctor,other))


def read(flow,eid=None,name='medico',suffix=''):
    client,login,ids,*_=flow
    response=client.get(f'/episodes/{eid or ids[0]}/allergies'+suffix,headers=login(name))
    assert response.status_code==200
    return response.json()


def save(flow,body=None,*,name='medico',eid=None,version=None,key=None):
    client,login,ids,*_=flow
    eid=eid or ids[0]
    return client.patch(f'/episodes/{eid}/allergies',headers={**login(name),'If-Match':version or read(flow,eid,name)['version'],'Idempotency-Key':key or uuid4().hex},json=body or dict(status='REPORTED',description='Reaccion ficticia informada a penicilina',source='Paciente ficticio',reason='Registro ficticio inicial'))


def test_legacy_is_unknown_not_none_and_get_does_not_create_rows(flow):
    data=read(flow)
    assert data['profile']['status']=='UNKNOWN' and data['profile']['reviewed_at'] is None
    assert data['can_edit'] and data['history']==[] and data['total']==0
    c=main.get_connection()
    try:
        assert c.execute('SELECT COUNT(*) FROM patient_allergy_profiles').fetchone()[0]==0
    finally:c.close()


def test_save_audits_changes_shared_patient_identity_and_safe_receipts(flow):
    client,login,ids,*_=flow
    key=uuid4().hex
    original=read(flow)['version']
    response=save(flow,key=key,version=original)
    assert response.status_code==200
    result=response.json()
    assert 'allergies' not in result
    assert result['events'][-1]['type']=='PATIENT_ALLERGIES_UPDATED'
    assert 'penicilina' not in result['events'][-1]['note']
    data=read(flow)
    assert data['profile']['revision']==1 and data['profile']['status']=='REPORTED'
    assert data['history'][0]['before']['status']=='UNKNOWN'
    assert data['history'][0]['after']['description']=='Reaccion ficticia informada a penicilina'
    assert data['history'][0]['username']=='medico'
    assert read(flow,ids[1])['profile']==data['profile']
    assert not read(flow,ids[1])['can_edit']
    assert read(flow,ids[2])['profile']['status']=='UNKNOWN'  # Same demographics, different identity.
    replay=save(flow,key=key,version=original)
    assert replay.status_code==200 and read(flow)['total']==1
    receipt=client.get('/write-result',headers={**login(),'Idempotency-Key':key}).json()
    assert receipt['status']=='confirmed'
    assert 'penicilina' not in json.dumps(receipt)
    c=main.get_connection()
    try:
        row=c.execute('SELECT episode_id,summary FROM write_receipts WHERE operation_key=?',(key,)).fetchone()
        assert tuple(row)==(ids[0],None)
    finally:c.close()


def test_status_change_preserves_previous_text_and_pages_all_history(flow):
    assert save(flow).status_code==200
    for index in range(3):
        assert save(flow,dict(status='NONE_KNOWN' if index%2==0 else 'UNKNOWN',description='',source='Entrevista ficticia',reason='Revision ficticia del registro')).status_code==200
    first=read(flow,suffix='?limit=2')
    second=read(flow,suffix='?limit=2&offset=2')
    assert first['total']==4 and len(first['history'])==len(second['history'])==2
    assert first['history'][0]['id']>second['history'][0]['id']
    assert second['history'][-1]['after']['description']=='Reaccion ficticia informada a penicilina'
    assert first['profile']['status']=='NONE_KNOWN' and first['profile']['description']==''
    assert read(flow,suffix='?offset=999')['history']==[]


@pytest.mark.parametrize('name', ['enfermeria','recepcion','laboratorio','supervisor','archivo','otro.medico'])
def test_read_and_edit_permissions(flow,name):
    client,login,ids,*_=flow
    path=f'/episodes/{ids[0]}/allergies'
    assert client.get(path).status_code==401
    get=client.get(path,headers=login(name))
    assert get.status_code==(200 if name in {'enfermeria','otro.medico'} else 403)
    if get.status_code==200: assert not get.json()['can_edit']
    response=client.patch(path,headers={**login(name),'If-Match':read(flow)['version'],'Idempotency-Key':uuid4().hex},json=dict(status='NONE_KNOWN',source='Entrevista ficticia',reason='Intento ficticio'))
    assert response.status_code==403
    assert read(flow)['total']==0


def test_closed_missing_owner_missing_key_and_version(flow):
    client,login,ids,*_=flow
    body=dict(status='NONE_KNOWN',source='Paciente ficticio',reason='Revision ficticia')
    assert save(flow,body,eid=ids[1]).status_code==409
    path=f'/episodes/{ids[0]}/allergies'
    assert client.patch(path,headers=login(),json=body).status_code==428
    assert client.patch(path,headers={**login(),'Idempotency-Key':uuid4().hex},json=body).status_code==428
    c=main.get_connection();c.execute("UPDATE care_slots SET user_id=NULL WHERE episode_id=?",(ids[0],));c.commit();c.close()
    assert save(flow,body).status_code==403
    assert client.get('/episodes/999/allergies',headers=login()).status_code==404


def test_handoff_proposal_does_not_transfer_authority_and_old_versions_conflict(flow):
    _,_,ids,doctor,other=flow
    before=read(flow)['version']
    c=main.get_connection();c.execute("UPDATE care_slots SET pending_user_id=?,revision=revision+1 WHERE episode_id=?",(other,ids[0]));c.commit();c.close()
    assert save(flow,version=before).status_code==409
    assert save(flow,name='otro.medico').status_code==403
    assert save(flow).status_code==200
    c=main.get_connection();c.execute("UPDATE care_slots SET user_id=?,pending_user_id=NULL,revision=revision+1 WHERE episode_id=?",(other,ids[0]));c.commit();c.close()
    assert save(flow).status_code==403
    assert save(flow,name='otro.medico').status_code==200
    assert read(flow)['profile']['reviewed_by']=='otro.medico'


def test_aba_conflicts_and_key_reuse_cannot_overwrite(flow):
    original=read(flow)['version']
    key=uuid4().hex
    assert save(flow,key=key).status_code==200
    assert save(flow,dict(status='NONE_KNOWN',source='Fuente ficticia',reason='Revision ficticia')).status_code==200
    assert save(flow).status_code==200
    assert save(flow,version=original).status_code==409
    assert save(flow,dict(status='UNKNOWN',source='Fuente ficticia',reason='Revision ficticia'),key=key).status_code==409
    assert read(flow)['total']==3


@pytest.mark.parametrize('patch',[{'status':'CONFIRMED'},{'description':''},{'description':'x'*2001},{'source':'  '},{'reason':'  '},{'status':'NONE_KNOWN','description':'Texto incompatible'},{'unexpected':True}])
def test_validates_description_source_reason_and_extra_fields(flow,patch):
    body=dict(status='REPORTED',description='Reaccion ficticia',source='Paciente ficticio',reason='Registro ficticio')|patch
    assert save(flow,body).status_code==422
    assert read(flow)['total']==0


@pytest.mark.parametrize('suffix',['?limit=0','?limit=51','?offset=-1','?offset=2147483648'])
def test_history_bounds(flow,suffix):
    client,login,ids,*_=flow
    assert client.get(f'/episodes/{ids[0]}/allergies'+suffix,headers=login()).status_code==422


def test_migration_is_idempotent_and_leaves_all_existing_rows_unchanged(flow):
    c=main.get_connection()
    try:
        before=[tuple(row) for row in c.execute('SELECT * FROM patients')]
        episodes=[tuple(row) for row in c.execute('SELECT * FROM episodes')]
        migrate_allergies(c);migrate_allergies(c)
        assert before==[tuple(row) for row in c.execute('SELECT * FROM patients')]
        assert episodes==[tuple(row) for row in c.execute('SELECT * FROM episodes')]
        assert c.execute('SELECT COUNT(*) FROM patient_allergy_profiles').fetchone()[0]==0
        assert c.execute('PRAGMA foreign_key_check').fetchall()==[]
    finally:c.close()


def test_parallel_stale_writes_record_only_one_revision(flow):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    client,login,ids,*_=flow
    headers=login()
    baseline=read(flow)['version']
    barrier=Barrier(2)
    def attempt(index):
        barrier.wait()
        return client.patch(f'/episodes/{ids[0]}/allergies',headers={**headers,'If-Match':baseline,'Idempotency-Key':uuid4().hex},json=dict(status='REPORTED',description=f'Reaccion ficticia {index}',source='Paciente ficticio',reason='Registro concurrente ficticio')).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses=list(pool.map(attempt,[1,2]))
    assert sorted(statuses)==[200,409]
    assert read(flow)['total']==1 and read(flow)['profile']['revision']==1


def test_audit_failure_rolls_back_profile_event_and_receipt(flow):
    import sqlite3
    c=main.get_connection()
    c.execute("CREATE TRIGGER fail_allergy_audit BEFORE INSERT ON patient_allergy_changes BEGIN SELECT RAISE(ABORT,'Fictitious audit failure'); END")
    c.commit();c.close()
    with pytest.raises(sqlite3.IntegrityError,match='Fictitious audit failure'):
        save(flow)
    assert read(flow)['profile']['revision']==0 and read(flow)['total']==0
    c=main.get_connection()
    try:
        assert c.execute("SELECT COUNT(*) FROM events WHERE type='PATIENT_ALLERGIES_UPDATED'").fetchone()[0]==0
        assert c.execute('SELECT COUNT(*) FROM write_receipts').fetchone()[0]==0
    finally:c.close()


def test_revoked_session_cannot_read_or_write_and_successful_replay_after_close_is_read_only(flow):
    client,login,ids,*_=flow
    key=uuid4().hex;baseline=read(flow)['version']
    assert save(flow,key=key,version=baseline).status_code==200
    c=main.get_connection();c.execute("UPDATE episodes SET status='CLOSED' WHERE id=?",(ids[0],));c.commit();c.close()
    assert save(flow,key=key,version=baseline).status_code==200
    assert read(flow)['total']==1
    assert client.post('/auth/logout',headers=login()).status_code==200
    assert client.get(f'/episodes/{ids[0]}/allergies',headers=login()).status_code==401
