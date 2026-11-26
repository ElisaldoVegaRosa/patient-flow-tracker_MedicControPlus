import json
import sqlite3
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import pytest
from test_patient_allergies import flow  # noqa: F401
from app import main
from app.patient_background import migrate_background
from app.concurrency import etag
from app.clinical_profiles import context


def read(flow,category='MEDICAL',eid=None,name='medico',suffix=''):
    client,login,ids,*_=flow
    response=client.get(f'/episodes/{eid or ids[0]}/background/{category}'+suffix,headers=login(name))
    assert response.status_code==200
    return response.json()


def save(flow,category='MEDICAL',body=None,*,name='medico',eid=None,version=None,key=None):
    client,login,ids,*_=flow;eid=eid or ids[0]
    return client.patch(f'/episodes/{eid}/background/{category}',headers={**login(name),'If-Match':version or read(flow,category,eid,name)['version'],'Idempotency-Key':key or uuid4().hex},json=body or dict(status='REPORTED',description='Antecedente ficticio sin valor clinico',source='Paciente ficticio',reason='Registro ficticio inicial'))


def test_initial_unknown_sections_do_not_infer_absence_or_create_rows(flow):
    for category in ['MEDICAL','SURGICAL']:
        value=read(flow,category)
        assert value['category']==category and value['profile']['status']=='UNKNOWN'
        assert value['profile']['reviewed_at'] is None and value['total']==0 and value['history']==[]
    c=main.get_connection()
    try:assert c.execute('SELECT COUNT(*) FROM patient_background_profiles').fetchone()[0]==0
    finally:c.close()


def test_categories_are_independent_and_versions_cannot_cross_resources(flow):
    medical=read(flow);surgical=read(flow,'SURGICAL')
    assert medical['version']!=surgical['version']
    assert save(flow,'SURGICAL',version=medical['version']).status_code==409
    assert save(flow,version=medical['version']).status_code==200
    unchanged=read(flow,'SURGICAL')
    assert unchanged['profile']['status']=='UNKNOWN' and unchanged['version']==surgical['version']
    assert save(flow,'SURGICAL',dict(status='NONE_REPORTED',description='',source='Paciente ficticio',reason='No refiere cirugias'),version=surgical['version']).status_code==200
    assert read(flow)['profile']['status']=='REPORTED'
    assert read(flow,'SURGICAL')['profile']['status']=='NONE_REPORTED'


def test_audit_same_patient_historical_view_and_unrelated_ficha(flow):
    client,login,ids,*_=flow;key=uuid4().hex;baseline=read(flow)['version']
    assert save(flow,key=key,version=baseline).status_code==200
    data=read(flow)
    assert data['profile']['revision']==1 and data['history'][0]['before']['status']=='UNKNOWN'
    assert data['history'][0]['after']['description']=='Antecedente ficticio sin valor clinico'
    assert read(flow,eid=ids[1])['profile']==data['profile'] and not read(flow,eid=ids[1])['can_edit']
    assert read(flow,eid=ids[2])['profile']['status']=='UNKNOWN'
    assert save(flow,eid=ids[2],version=data['version']).status_code==409
    assert save(flow,key=key,version=baseline).status_code==200 and read(flow)['total']==1
    assert save(flow,'SURGICAL',key=key).status_code==409
    receipt=client.get('/write-result',headers={**login(),'Idempotency-Key':key}).json()
    assert receipt['status']=='confirmed' and 'Antecedente ficticio sin valor clinico' not in json.dumps(receipt)
    c=main.get_connection()
    try:assert tuple(c.execute('SELECT episode_id,summary FROM write_receipts WHERE operation_key=?',(key,)).fetchone())==(ids[0],None)
    finally:c.close()


@pytest.mark.parametrize('name',['enfermeria','recepcion','laboratorio','supervisor','archivo','otro.medico'])
def test_role_permissions_and_current_responsibility(flow,name):
    client,login,ids,*_=flow;path=f'/episodes/{ids[0]}/background/MEDICAL'
    assert client.get(path).status_code==401
    response=client.get(path,headers=login(name))
    assert response.status_code==(200 if name in {'enfermeria','otro.medico'} else 403)
    if response.status_code==200:assert not response.json()['can_edit']
    rejected=client.patch(path,headers={**login(name),'If-Match':read(flow)['version'],'Idempotency-Key':uuid4().hex},json=dict(status='NONE_REPORTED',source='Paciente ficticio',reason='Intento ficticio'))
    assert rejected.status_code==403 and read(flow)['total']==0


def test_pending_and_accepted_handoffs_preserve_authority_rules(flow):
    _,_,ids,_,other=flow;baseline=read(flow)['version']
    c=main.get_connection();c.execute('UPDATE care_slots SET pending_user_id=?,revision=revision+1 WHERE episode_id=?',(other,ids[0]));c.commit();c.close()
    assert save(flow,version=baseline).status_code==409
    assert save(flow,name='otro.medico').status_code==403
    assert save(flow).status_code==200
    c=main.get_connection();c.execute('UPDATE care_slots SET user_id=?,pending_user_id=NULL,revision=revision+1 WHERE episode_id=?',(other,ids[0]));c.commit();c.close()
    assert save(flow).status_code==403
    assert save(flow,name='otro.medico').status_code==200


def test_closed_missing_owner_key_version_and_revoked_session(flow):
    client,login,ids,*_=flow;body=dict(status='NONE_REPORTED',source='Paciente ficticio',reason='Registro ficticio')
    assert save(flow,body=body,eid=ids[1]).status_code==409
    path=f'/episodes/{ids[0]}/background/MEDICAL'
    assert client.patch(path,headers=login(),json=body).status_code==428
    assert client.patch(path,headers={**login(),'Idempotency-Key':uuid4().hex},json=body).status_code==428
    c=main.get_connection();c.execute('UPDATE care_slots SET user_id=NULL WHERE episode_id=?',(ids[0],));c.commit();c.close()
    assert save(flow).status_code==403
    assert client.get('/episodes/999/background/MEDICAL',headers=login()).status_code==404
    assert client.post('/auth/logout',headers=login()).status_code==200
    assert client.get(path,headers=login()).status_code==401


@pytest.mark.parametrize('patch',[{'status':'NONE_KNOWN'},{'description':''},{'description':'x'*2001},{'source':'  '},{'reason':'  '},{'status':'NONE_REPORTED','description':'Texto incompatible'},{'doctor_id':999}])
def test_validates_status_description_source_reason_and_no_actor_spoofing(flow,patch):
    body=dict(status='REPORTED',description='Texto ficticio',source='Paciente ficticio',reason='Revision ficticia')|patch
    assert save(flow,body=body).status_code==422 and read(flow)['total']==0


@pytest.mark.parametrize('suffix',['?limit=0','?limit=51','?offset=-1','?offset=2147483648'])
def test_history_bounds(flow,suffix):
    client,login,ids,*_=flow
    assert client.get(f'/episodes/{ids[0]}/background/MEDICAL'+suffix,headers=login()).status_code==422


def test_no_category_fallback_and_read_only_get(flow,monkeypatch):
    client,login,ids,*_=flow;headers=login()
    for category in ['medical','ALLERGIES','999']:
        assert client.get(f'/episodes/{ids[0]}/background/{category}',headers=headers).status_code==422
    original=main.get_connection
    def readonly():
        c=original();c.execute('PRAGMA query_only=ON');return c
    monkeypatch.setattr(main,'get_connection',readonly)
    assert read(flow)['profile']['status']=='UNKNOWN'


def test_history_pagination_and_aba_stale_version(flow):
    baseline=read(flow)['version']
    for status in ['REPORTED','NONE_REPORTED','UNKNOWN','REPORTED']:
        body=dict(status=status,description='Texto ficticio' if status=='REPORTED' else '',source='Paciente ficticio',reason='Revision ficticia')
        assert save(flow,body=body).status_code==200
    assert save(flow,version=baseline).status_code==409
    first=read(flow,suffix='?limit=2');second=read(flow,suffix='?limit=2&offset=2')
    assert first['total']==4 and len(first['history'])==len(second['history'])==2
    assert first['history'][0]['id']>second['history'][0]['id']
    assert read(flow,'SURGICAL')['total']==0


@pytest.mark.parametrize('separate',[False,True])
def test_real_concurrent_writes_are_serialized_per_section(flow,separate):
    client,login,ids,*_=flow;headers=login();versions={kind:read(flow,kind)['version'] for kind in ['MEDICAL','SURGICAL']};barrier=Barrier(2)
    def attempt(index):
        category='SURGICAL' if separate and index else 'MEDICAL';barrier.wait()
        return client.patch(f'/episodes/{ids[0]}/background/{category}',headers={**headers,'If-Match':versions[category],'Idempotency-Key':uuid4().hex},json=dict(status='REPORTED',description=f'Antecedente ficticio {index}',source='Paciente ficticio',reason='Concurrencia ficticia')).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:statuses=list(pool.map(attempt,[0,1]))
    assert sorted(statuses)==([200,200] if separate else [200,409])
    assert read(flow)['total']==1 and read(flow,'SURGICAL')['total']==int(separate)


def test_audit_failure_rolls_back_every_effect(flow):
    c=main.get_connection();c.execute("CREATE TRIGGER fail_background_audit BEFORE INSERT ON patient_background_changes BEGIN SELECT RAISE(ABORT,'Fictitious history failure'); END");c.commit();c.close()
    with pytest.raises(sqlite3.IntegrityError,match='Fictitious history failure'):save(flow)
    assert read(flow)['profile']['revision']==0 and read(flow)['total']==0
    c=main.get_connection()
    try:
        assert c.execute("SELECT COUNT(*) FROM events WHERE type='PATIENT_BACKGROUND_UPDATED'").fetchone()[0]==0
        assert c.execute('SELECT COUNT(*) FROM write_receipts').fetchone()[0]==0
    finally:c.close()


def test_migration_keeps_existing_profiles_and_old_allergy_versions(flow):
    client,login,ids,*_=flow
    assert save(flow).status_code==200 and save(flow,'SURGICAL').status_code==200
    c=main.get_connection()
    try:
        before=[tuple(row) for row in c.execute('SELECT * FROM patient_background_profiles ORDER BY category')]
        changes=[tuple(row) for row in c.execute('SELECT * FROM patient_background_changes')]
        migrate_background(c);migrate_background(c)
        assert before==[tuple(row) for row in c.execute('SELECT * FROM patient_background_profiles ORDER BY category')]
        assert changes==[tuple(row) for row in c.execute('SELECT * FROM patient_background_changes')]
        current=context(c,ids[0])
        expected=etag([current['id'],current['patient_id'],current['identity_revision'],current['status'],current['user_id'],current['owner_revision'],current['owner_active'],current['owner_role'],0,0])
    finally:c.close()
    allergy=client.get(f'/episodes/{ids[0]}/allergies',headers=login()).json()
    assert allergy['version']==expected and allergy['profile']['status']=='UNKNOWN'
