import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useState } from "react";
import PatientAllergies from "./PatientAllergies";
import { usePendingOperations } from "../hooks/usePendingOperations";
import { establishSession } from "../api/client";
import type { Episode, PatientAllergyData } from "../types/clinical";

const episode: Episode = { id:42,patient_id:7,name:"Paciente ficticio",birth_date:"1990-01-01",document:"DEMO-ALLERGIES",status:"ACTIVE",priority:3,location:"Consulta",qr_token:"allergy-qr",started_at:"2026-11-25T12:00:00Z",events:[],vitals:[],tasks:[],alerts:[] };
const data = (overrides: Partial<PatientAllergyData> = {}): PatientAllergyData => ({ episode_id:42,patient_id:7,version:'"v1"',can_edit:true,responsible:"Medico ficticio",
  profile:{ status:"UNKNOWN",description:"",source:"",reviewed_by:null,reviewed_at:null,episode_id:null,revision:0 },history:[],total:0,limit:10,offset:0,...overrides });
const recorded = data({ version:'"v2"',profile:{status:"REPORTED",description:"Reaccion ficticia\n<script>solo texto</script>",source:"Paciente ficticio",reviewed_by:"medico",reviewed_at:"2026-11-25T14:00:00Z",episode_id:42,revision:1} });
const response=(value:unknown,status=200)=>({ok:status<400,status,json:async()=>value}) as Response;
function View({ role="DOCTOR", source=episode }: {role?:string;source?:Episode}) {
  const [current,setCurrent]=useState(source);
  const operations=usePendingOperations();
  return <PatientAllergies episode={current} user={{username:"medico",role}} operations={operations} onUpdated={setCurrent} />;
}
async function consult() {
  fireEvent.click(screen.getByRole("button",{name:"Consultar alergias"}));
  await screen.findAllByText("Sin información de alergias",{selector:"p"});
}
function edit() {
  fireEvent.click(screen.getByText("Registrar o corregir alergias"));
  fireEvent.change(screen.getByLabelText("Estado de alergias"),{target:{value:"REPORTED"}});
  fireEvent.change(screen.getByLabelText("Alergias y reacciones informadas"),{target:{value:"Reaccion ficticia"}});
  fireEvent.change(screen.getByLabelText("Fuente de la información"),{target:{value:"Paciente ficticio"}});
  fireEvent.change(screen.getByLabelText("Motivo del registro o corrección"),{target:{value:"Revision ficticia"}});
}
beforeEach(()=>{ localStorage.clear();sessionStorage.clear();establishSession("alergias-ficticio"); });
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();sessionStorage.clear();});

it("no supone ausencia sin consultar; enfermeria consulta sin editar y ve fechas dominicanas",async()=>{
 const fetchMock=vi.fn<typeof fetch>().mockResolvedValue(response(recorded));vi.stubGlobal("fetch",fetchMock);
 render(<View role="NURSE" />);
 expect(fetchMock).not.toHaveBeenCalled();
 expect(screen.getByText(/aún no se ha consultado/)).toBeVisible();
 fireEvent.click(screen.getByRole("button",{name:"Consultar alergias"}));
 await screen.findByText("Alergias registradas",{selector:"p"});
 expect(screen.queryByText("Registrar o corregir alergias")).not.toBeInTheDocument();
 expect(screen.getByText(/Revisado por medico/)).toHaveTextContent("25/11/2026, 10:00 a. m.");
 const description=screen.getByText(/Reaccion ficticia/);expect(description.textContent).toContain("<script>solo texto</script>");expect(description.querySelector("script")).toBeNull();
});

it.each(["RECEPTION","LAB","SUPERVISOR","ADMISSION","ACCOUNT_ADMIN"])("%s no consulta ni recibe el registro",role=>{
 const fetchMock=vi.fn();vi.stubGlobal("fetch",fetchMock);render(<View role={role}/>);
 expect(screen.queryByRole("region",{name:"Alergias del paciente"})).not.toBeInTheDocument();expect(fetchMock).not.toHaveBeenCalled();
});

it("guarda una sola vez con version y clave y consulta el registro actualizado",async()=>{
 let saved=false;
 const fetchMock=vi.fn<typeof fetch>().mockImplementation(async(_input,init)=>{
  if(init?.method==="PATCH"){saved=true;return response(episode);}
  return response(saved?recorded:data());
 });vi.stubGlobal("fetch",fetchMock);render(<View/>);await consult();edit();
 const button=screen.getByRole("button",{name:"Guardar registro de alergias"});fireEvent.click(button);fireEvent.click(button);
 await screen.findByText("Registro de alergias guardado.");
 await screen.findByText("Alergias registradas",{selector:"p"});
 const writes=fetchMock.mock.calls.filter(([,init])=>init?.method==="PATCH");expect(writes).toHaveLength(1);
 const headers=new Headers(writes[0][1]?.headers);expect(headers.get("If-Match")).toBe('"v1"');expect(headers.get("Idempotency-Key")).toBeTruthy();
 expect(JSON.parse(String(writes[0][1]?.body))).toEqual({status:"REPORTED",description:"Reaccion ficticia",source:"Paciente ficticio",reason:"Revision ficticia"});
 await waitFor(()=>expect(screen.getByLabelText("Motivo del registro o corrección")).toHaveValue(""));
 expect(sessionStorage.length).toBe(0);
});

it("conflicto conserva campos y exige revisar la version actual antes de reenviar",async()=>{
 let conflict=false;
 vi.stubGlobal("fetch",vi.fn<typeof fetch>().mockImplementation(async(_input,init)=>{
  if(init?.method==="PATCH"){conflict=true;return response({detail:{code:"version_conflict",message:"Cambio el registro"}},409);}
  return response(conflict?recorded:data());
 }));render(<View/>);await consult();edit();fireEvent.click(screen.getByRole("button",{name:"Guardar registro de alergias"}));
 await screen.findByText(/Estos datos cambiaron/);expect(screen.getByLabelText("Alergias y reacciones informadas")).toHaveValue("Reaccion ficticia");
 expect(screen.getByRole("button",{name:"Guardar registro de alergias"})).toBeDisabled();
 fireEvent.click(screen.getByRole("button",{name:"He revisado los cambios; usar versión actual"}));
 expect(screen.getByRole("button",{name:"Guardar registro de alergias"})).toBeEnabled();
});

it("un relevo conserva el borrador y bloquea el guardado del responsable anterior",async()=>{
 const fetchMock=vi.fn<typeof fetch>().mockResolvedValueOnce(response(data())).mockResolvedValue(response(data({can_edit:false,version:'"handoff"',responsible:"Otro medico"})));
 vi.stubGlobal("fetch",fetchMock);render(<View/>);await consult();edit();
 fireEvent.click(screen.getByRole("button",{name:"Actualizar alergias"}));
 await screen.findByText(/Responsable: Otro medico/);
 expect(screen.getByLabelText("Alergias y reacciones informadas")).toHaveValue("Reaccion ficticia");
 expect(screen.getByRole("button",{name:"Guardar registro de alergias"})).toBeDisabled();
});

it("recupera borrador al volver al mismo episodio y cuenta",async()=>{
 vi.stubGlobal("fetch",vi.fn<typeof fetch>().mockResolvedValue(response(data())));
 const view=render(<View/>);await consult();edit();view.unmount();render(<View/>);await consult();
 fireEvent.click(screen.getByText("Registrar o corregir alergias"));
 expect(screen.getByLabelText("Alergias y reacciones informadas")).toHaveValue("Reaccion ficticia");
 expect(screen.getByLabelText("Motivo del registro o corrección")).toHaveValue("Revision ficticia");
});

it("rechaza datos de otra ficha y descarta respuestas al salir",async()=>{
 let late!: (value:Response)=>void;
 let signal:AbortSignal|undefined;
 const fetchMock=vi.fn<typeof fetch>().mockResolvedValueOnce(response(data({patient_id:99}))).mockImplementationOnce((_input,init)=>{
  signal=init?.signal as AbortSignal;return new Promise(resolve=>{late=resolve;});
 });vi.stubGlobal("fetch",fetchMock);const view=render(<View/>);
 fireEvent.click(screen.getByRole("button",{name:"Consultar alergias"}));
 await screen.findByRole("alert");expect(screen.queryByText("Registrar o corregir alergias")).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"Actualizar alergias"}));await waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(2));view.unmount();
 expect(signal?.aborted).toBe(true);await act(async()=>late(response(recorded)));
 expect(screen.queryByText("Alergias registradas")).not.toBeInTheDocument();
});

it("visita cerrada identifica el registro vigente y muestra historial paginado sin editar",async()=>{
 const history=Array.from({length:10},(_,id)=>({id,episode_id:42,username:"medico",created_at:"2026-11-25T14:00:00Z",reason:"Revision ficticia",before:data().profile,after:recorded.profile}));
 const fetchMock=vi.fn<typeof fetch>().mockImplementation(async input=>{
  const offset=Number(new URL(String(input)).searchParams.get("offset"));return response(data({can_edit:false,history:offset?[history[0]]:history,total:11,offset}));
 });vi.stubGlobal("fetch",fetchMock);render(<View source={{...episode,status:"CLOSED"}}/>);await consult();
 expect(screen.getByText(/revisiones posteriores/)).toBeVisible();fireEvent.click(screen.getByText("Registrar o corregir alergias"));expect(screen.getByRole("button",{name:"Guardar registro de alergias"})).toBeDisabled();
 fireEvent.click(screen.getByText("Historial de alergias (11)"));
 fireEvent.click(screen.getByRole("button",{name:"Más cambios de alergias"}));
 await waitFor(()=>expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain("offset=10"));
 await waitFor(()=>expect(within(screen.getByRole("navigation",{name:"Páginas del historial de alergias"})).getByRole("button",{name:"Más cambios de alergias"})).toBeDisabled());
});
