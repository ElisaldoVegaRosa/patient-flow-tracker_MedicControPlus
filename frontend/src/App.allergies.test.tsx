import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import type { Episode, PatientAllergyData } from "./types/clinical";
vi.mock("./components/EpisodePresence",()=>({default:()=>null}));
const episode:Episode={id:42,patient_id:7,name:"Paciente alergias ficticio",birth_date:"1990-01-01",document:"ALLERGY-APP",status:"ACTIVE",priority:3,location:"Consulta",qr_token:"allergy-qr",started_at:"2026-11-25T12:00:00Z",events:[],vitals:[],tasks:[],alerts:[]};
const initial:PatientAllergyData={episode_id:42,patient_id:7,version:'"v1"',can_edit:true,responsible:"Medico ficticio",profile:{status:"UNKNOWN",description:"",source:"",reviewed_by:null,reviewed_at:null,episode_id:null,revision:0},history:[],total:0,limit:10,offset:0};
const stored:PatientAllergyData={...initial,version:'"v2"',profile:{status:"REPORTED",description:"Reaccion original ficticia",source:"Paciente ficticio",reviewed_by:"medico",reviewed_at:"2026-11-25T14:00:00Z",episode_id:42,revision:1}};
const response=(data:unknown,status=200)=>({ok:status<400,status,json:async()=>data}) as Response;
afterEach(()=>{localStorage.clear();sessionStorage.clear();vi.unstubAllGlobals();});

it.each([["Consultar resultado",false,false],["Consultar resultado",true,false],["Reintentar operación original",false,false],["Reintentar operación original",true,false],["Reintentar operación original",false,true]])("%s confirma alergias y conserva edicion posterior=%s",async(action,editedAfter,rejected)=>{
 localStorage.setItem("token","allergy-app-ficticio");let attempts=0;let confirmed=false;
 const fetchMock=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const path=new URL(String(input)).pathname;
  if(path==="/auth/me")return response({username:"medico",role:"DOCTOR"});
  if(path==="/dashboard")return response({active:1,open_alerts:0,patients:[{...episode,pending_task_count:0,open_alert_count:0}],requested_by:"medico"});
  if(path==="/episodes/42")return response(episode);
  if(path==="/episodes/42/allergies"){
   if(init?.method==="PATCH"){if(++attempts===1)throw new TypeError("Failed to fetch");confirmed=true;if(rejected)return response({detail:{code:"version_conflict",message:"Cambio el registro"}},409);return response(episode);}
   return response(confirmed?stored:initial);
  }
  if(path==="/write-result"){confirmed=true;return response({status:"confirmed",result:episode});}
  throw new Error(`Peticion inesperada: ${path}`);
 });vi.stubGlobal("fetch",fetchMock);const user=userEvent.setup();render(<App/>);
 await user.click(await screen.findByRole("button",{name:"Abrir"}));
 await user.click(await screen.findByRole("button",{name:"Consultar alergias"}));
 await user.click(await screen.findByText("Registrar o corregir alergias"));
 fireEvent.change(screen.getByLabelText("Estado de alergias"),{target:{value:"REPORTED"}});
 fireEvent.change(screen.getByLabelText("Alergias y reacciones informadas"),{target:{value:"Reaccion original ficticia"}});
 fireEvent.change(screen.getByLabelText("Fuente de la información"),{target:{value:"Paciente ficticio"}});
 fireEvent.change(screen.getByLabelText("Motivo del registro o corrección"),{target:{value:"Revision ficticia"}});
 await user.click(screen.getByRole("button",{name:"Guardar registro de alergias"}));
 await screen.findByRole("region",{name:"Guardados por confirmar"});
 expect(screen.getByRole("heading",{name:"EP-42 · Registro de alergias"})).toBeVisible();
 if(editedAfter)fireEvent.change(screen.getByLabelText("Alergias y reacciones informadas"),{target:{value:"Edicion posterior ficticia"}});
 await user.click(screen.getByRole("button",{name:action}));
 if(rejected){
  await screen.findByText(/Estos datos cambiaron/);
  expect(screen.getByRole("button",{name:"Guardar registro de alergias"})).toBeDisabled();
  expect(screen.getByLabelText("Motivo del registro o corrección")).toHaveValue("Revision ficticia");
  expect(screen.queryByRole("region",{name:"Guardados por confirmar"})).not.toBeInTheDocument();
  expect(attempts).toBe(2);return;
 }
 await screen.findByText("Registro de alergias confirmado por el servidor.");
 await screen.findByText("Alergias registradas",{selector:"p"});
 expect(screen.getByLabelText("Alergias y reacciones informadas")).toHaveValue(editedAfter?"Edicion posterior ficticia":"Reaccion original ficticia");
 expect(screen.getByLabelText("Motivo del registro o corrección")).toHaveValue(editedAfter?"Revision ficticia":"");
 expect(screen.queryByRole("region",{name:"Guardados por confirmar"})).not.toBeInTheDocument();
 expect(attempts).toBe(action==="Consultar resultado"?1:2);
 const writes=fetchMock.mock.calls.filter(([,init])=>init?.method==="PATCH");
 if(writes.length===2){expect(writes[0][1]?.body).toEqual(writes[1][1]?.body);expect(new Headers(writes[0][1]?.headers).get("Idempotency-Key")).toBe(new Headers(writes[1][1]?.headers).get("Idempotency-Key"));}
 await waitFor(()=>expect(screen.getByLabelText("Estado de alergias")).toHaveValue("REPORTED"));
});
