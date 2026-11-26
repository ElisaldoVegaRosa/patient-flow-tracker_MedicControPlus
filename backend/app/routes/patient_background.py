"""Only the confirmed responsible doctor can record medical/surgical history."""
import json
from typing import Literal
from fastapi import APIRouter,Depends,Header,HTTPException,Path,Query
from pydantic import BaseModel,ConfigDict,model_validator
from .. import patient_background as background
from ..input_validation import ClinicalNote
from ..write_operations import atomic_write,transaction_factory

Category=Literal['MEDICAL','SURGICAL']


class BackgroundRecord(BaseModel):
    model_config=ConfigDict(extra='forbid',str_strip_whitespace=True)
    status: Literal['UNKNOWN','NONE_REPORTED','REPORTED']
    description: str=''
    source: ClinicalNote
    reason: ClinicalNote

    @model_validator(mode='after')
    def compatible_description(self):
        if len(self.description)>2000:
            raise ValueError('La descripcion admite como maximo 2000 caracteres')
        if self.status=='REPORTED' and len(self.description)<3:
            raise ValueError('Describe los antecedentes registrados (minimo 3 caracteres)')
        if self.status!='REPORTED' and self.description:
            raise ValueError('Vacia la descripcion para registrar sin informacion o sin antecedentes referidos; el texto anterior permanece en el historial')
        return self


def create_router(connection_factory,timestamp,detail,add_event,require_roles):
    factory=transaction_factory(connection_factory)
    router=APIRouter()

    @router.get('/episodes/{episode_id}/background/{category}')
    def read(category:Category,episode_id:int=Path(ge=1,le=2**63-1),limit:int=Query(10,ge=1,le=50),
             offset:int=Query(0,ge=0,le=2**31-1),user:dict=Depends(require_roles('DOCTOR','NURSE'))):
        connection=factory()
        try:
            connection.execute('BEGIN')
            return background.read(connection,episode_id,category,user,limit,offset)
        finally:connection.close()

    @router.patch('/episodes/{episode_id}/background/{category}')
    @atomic_write(connection_factory,detail,require_key=True)
    def save(category:Category,data:BackgroundRecord,episode_id:int=Path(ge=1,le=2**63-1),
             expected:str|None=Header(None,alias='If-Match'),user:dict=Depends(require_roles('DOCTOR'))):
        connection=factory();current=background.context(connection,episode_id)
        if current['status']!='ACTIVE':
            raise HTTPException(409,'Esta visita esta cerrada; consulta los antecedentes sin editarlos desde este episodio')
        if not background.owns(current,user):
            raise HTTPException(403,'Solo el medico responsable confirmado puede registrar o corregir antecedentes; acepta el relevo antes de sustituirlo')
        if not expected:raise HTTPException(428,'Consulta los antecedentes actuales antes de guardar')
        before=background.profile(connection,current['patient_id'],category)
        if expected!=background.version(connection,current,before,category):
            raise HTTPException(409,{'code':'version_conflict','message':'Cambio este apartado, la identidad o el responsable. Revisa los datos actuales antes de guardar.'})
        after=dict(status=data.status,description=data.description,source=data.source);at=timestamp()
        connection.execute("""INSERT INTO patient_background_profiles
            (patient_id,category,status,description,source,reviewed_by,reviewed_at,episode_id,revision)
            VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(patient_id,category) DO UPDATE SET
            status=excluded.status,description=excluded.description,source=excluded.source,
            reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,
            episode_id=excluded.episode_id,revision=excluded.revision""",
            (current['patient_id'],category,data.status,data.description,data.source,user['username'],at,episode_id,before['revision']+1))
        connection.execute("""INSERT INTO patient_background_changes
            (patient_id,category,episode_id,username,created_at,reason,old_value,new_value) VALUES (?,?,?,?,?,?,?,?)""",
            (current['patient_id'],category,episode_id,user['username'],at,data.reason,
             json.dumps(background.snapshot(before),ensure_ascii=False),json.dumps(after,ensure_ascii=False)))
        add_event(connection,episode_id,'PATIENT_BACKGROUND_UPDATED',user['username'],
                  'Antecedentes medicos revisados por el responsable.' if category=='MEDICAL' else 'Antecedentes quirurgicos revisados por el responsable.')
        return detail(connection,episode_id)

    return router
