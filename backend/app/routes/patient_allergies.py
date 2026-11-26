"""Medical responsibility guards all writes; nursing can only consult."""
import json
from typing import Literal
from fastapi import APIRouter, Depends, Header, HTTPException, Path, Query
from pydantic import BaseModel, ConfigDict, model_validator
from ..input_validation import ClinicalNote
from .. import patient_allergies as allergies
from ..write_operations import atomic_write, transaction_factory


class AllergyRecord(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    status: Literal['UNKNOWN','NONE_KNOWN','REPORTED']
    description: str = ''
    source: ClinicalNote
    reason: ClinicalNote

    @model_validator(mode='after')
    def compatible_description(self):
        if len(self.description)>2000:
            raise ValueError('La descripcion admite como maximo 2000 caracteres')
        if self.status=='REPORTED' and len(self.description)<3:
            raise ValueError('Describe las alergias y reacciones informadas (minimo 3 caracteres)')
        if self.status!='REPORTED' and self.description:
            raise ValueError('Vacia la descripcion para registrar sin informacion o sin alergias conocidas; el texto anterior queda en el historial')
        return self


def create_router(connection_factory, timestamp, detail, add_event, require_roles):
    factory = transaction_factory(connection_factory)
    router = APIRouter()

    @router.get('/episodes/{episode_id}/allergies')
    def read(episode_id: int = Path(ge=1,le=2**63-1), limit: int = Query(10,ge=1,le=50),
             offset: int = Query(0,ge=0,le=2**31-1), user: dict = Depends(require_roles('DOCTOR','NURSE'))):
        connection = factory()
        try:
            connection.execute('BEGIN')
            return allergies.read(connection,episode_id,user,limit,offset)
        finally:
            connection.close()

    @router.patch('/episodes/{episode_id}/allergies')
    @atomic_write(connection_factory,detail,require_key=True)
    def save(data: AllergyRecord, episode_id: int = Path(ge=1,le=2**63-1),
             expected: str | None = Header(None,alias='If-Match'), user: dict = Depends(require_roles('DOCTOR'))):
        connection = factory()
        current = allergies.context(connection,episode_id)
        if current['status']!='ACTIVE':
            raise HTTPException(409,'El episodio esta cerrado; el registro de alergias no admite cambios desde esta visita')
        if not allergies.owns(current,user):
            raise HTTPException(403,'Solo el medico responsable confirmado puede registrar o corregir alergias; acepta el relevo antes de sustituirlo')
        if not expected:
            raise HTTPException(428,'Consulta el registro vigente de alergias antes de guardar')
        before = allergies.profile(connection,current['patient_id'])
        if expected!=allergies.version(connection,current,before):
            raise HTTPException(409,{'code':'version_conflict','message':'Cambio el registro, la identidad o el responsable. Revisa los datos actuales antes de guardar.'})
        after = dict(status=data.status,description=data.description,source=data.source)
        at = timestamp()
        connection.execute("""INSERT INTO patient_allergy_profiles
            (patient_id,status,description,source,reviewed_by,reviewed_at,episode_id,revision)
            VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(patient_id) DO UPDATE SET
            status=excluded.status,description=excluded.description,source=excluded.source,
            reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,
            episode_id=excluded.episode_id,revision=excluded.revision""",
            (current['patient_id'],data.status,data.description,data.source,user['username'],at,episode_id,before['revision']+1))
        connection.execute("""INSERT INTO patient_allergy_changes
            (patient_id,episode_id,username,created_at,reason,old_value,new_value) VALUES (?,?,?,?,?,?,?)""",
            (current['patient_id'],episode_id,user['username'],at,data.reason,
             json.dumps(allergies.snapshot(before),ensure_ascii=False),json.dumps(after,ensure_ascii=False)))
        # The shared timeline does not disclose the allergy description to other roles.
        add_event(connection,episode_id,'PATIENT_ALLERGIES_UPDATED',user['username'],
                  'Registro de alergias actualizado por el medico responsable.')
        return detail(connection,episode_id)

    return router
