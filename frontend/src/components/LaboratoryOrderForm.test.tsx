import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import LaboratoryOrderForm from "./LaboratoryOrderForm";
import UncertainWrites from "./UncertainWrites";
import { usePendingOperations } from "../hooks/usePendingOperations";
import { notifyOperationalConfirmation, notifyOperationalConflict } from "../session/operationalWrites";
import { readSpecimenDraft } from "../session/specimenDrafts";
import type { Episode } from "../types/clinical";

const user = { username: "medico.demo", role: "DOCTOR" };
const episode: Episode = { id: 22, status: "ACTIVE", clinical_version: '"v1"', laboratory: { orders: [] },
  name: "Paciente ficticio", birth_date: "1990-01-01", document: "TEST-ORDER", qr_token: "qr-ficticio",
  priority: 3, location: "Consulta", started_at: "2026-10-01T12:00:00Z", tasks: [], alerts: [], vitals: [], events: [] };
const path = "/episodes/22/lab-orders";
const applied = vi.fn((p: string, _r: unknown, body?: BodyInit | null) => notifyOperationalConfirmation(p, body));
const conflict = vi.fn();
let fetchMock: ReturnType<typeof vi.fn>;
function Harness({ value = episode, role = "DOCTOR" }: { value?: Episode; role?: string }) {
  const operations = usePendingOperations();
  return <><UncertainWrites operations={operations} onConfirmed={applied} onRejected={notifyOperationalConflict} /><LaboratoryOrderForm episode={value} user={{ ...user, role }} operations={operations} onApplied={applied} onConflict={conflict} /></>;
}
function fill() {
  fireEvent.change(screen.getByLabelText("Nombre de la orden"), { target: { value: "Orden ficticia" } });
  fireEvent.change(screen.getByLabelText("Nombre de analítica 1"), { target: { value: "Hemograma ficticio" } });
  fireEvent.change(screen.getByLabelText("Tipo de muestra 1"), { target: { value: "BLOOD" } });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Solicitud ficticia" } });
  fireEvent.click(screen.getByLabelText("Muestra 1 para analítica 1"));
}
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Crear orden de laboratorio" }));
beforeEach(() => {
  localStorage.setItem("token", "token-ficticio");
  fetchMock = vi.fn(async () => ({ ok: true, status: 201, json: async () => episode }) as Response);
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

it("publica un grafo muchos a muchos con versión clínica y clave, y limpia solo al confirmar", async () => {
  render(<Harness />); fill();
  fireEvent.click(screen.getByRole("button", { name: "Añadir analítica" }));
  fireEvent.change(screen.getByLabelText("Nombre de analítica 2"), { target: { value: "Glucosa ficticia" } });
  fireEvent.click(screen.getByLabelText("Muestra 1 para analítica 2"));
  fireEvent.click(screen.getByRole("button", { name: "Añadir muestra" }));
  fireEvent.change(screen.getByLabelText("Tipo de muestra 2"), { target: { value: "URINE" } });
  fireEvent.click(screen.getByLabelText("Muestra 2 para analítica 2"));
  submit(); await waitFor(() => expect(applied).toHaveBeenCalled());
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toContain(path);
  expect(new Headers(init.headers).get("If-Match")).toBe('"v1"');
  expect(new Headers(init.headers).get("Idempotency-Key")).toBeTruthy();
  expect(JSON.parse(String(init.body))).toEqual({ title: "Orden ficticia", reason: "Solicitud ficticia",
    analyses: [{ key: "a1", title: "Hemograma ficticio" }, { key: "a2", title: "Glucosa ficticia" }],
    specimens: [{ key: "s1", kind: "BLOOD", analysis_keys: ["a1", "a2"] }, { key: "s3", kind: "URINE", analysis_keys: ["a2"] }] });
  expect(screen.getByLabelText("Nombre de la orden")).toHaveValue("");
  expect(readSpecimenDraft(user, path).draft).toBeUndefined();
});

it("no envía analíticas sin muestra ni muestras sin analítica", () => {
  render(<Harness />); fill();
  fireEvent.click(screen.getByLabelText("Muestra 1 para analítica 1"));
  submit(); expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Nombre de analítica 1")).toBeInvalid();
  fireEvent.click(screen.getByLabelText("Muestra 1 para analítica 1"));
  fireEvent.click(screen.getByRole("button", { name: "Añadir muestra" }));
  fireEvent.change(screen.getByLabelText("Tipo de muestra 2"), { target: { value: "SALIVA" } });
  submit(); expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Tipo de muestra 2")).toBeInvalid();
});

it("otra muestra exige descripción y no inventa un tipo", async () => {
  render(<Harness />); fill();
  fireEvent.change(screen.getByLabelText("Tipo de muestra 1"), { target: { value: "OTHER" } });
  submit(); expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Descripción de muestra 1"), { target: { value: "Muestra ficticia especial" } });
  submit(); await waitFor(() => expect(applied).toHaveBeenCalled());
  expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).specimens[0]).toMatchObject({ kind: "OTHER", kind_description: "Muestra ficticia especial" });
});

it("recupera filas, vínculos y baseline sin enviar, y exige revisar la versión actual", async () => {
  const view = render(<Harness />); fill();
  fireEvent.click(screen.getByRole("button", { name: "Añadir analítica" }));
  fireEvent.change(screen.getByLabelText("Nombre de analítica 2"), { target: { value: "Glucosa ficticia" } });
  fireEvent.click(screen.getByLabelText("Muestra 1 para analítica 2"));
  view.unmount(); render(<Harness value={{ ...episode, clinical_version: '"v2"' }} />);
  expect(screen.getByLabelText("Nombre de analítica 2")).toHaveValue("Glucosa ficticia");
  expect(screen.getByLabelText("Muestra 1 para analítica 2")).toBeChecked();
  expect(screen.getByRole("button", { name: "Crear orden de laboratorio" })).toBeDisabled();
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "He revisado los cambios; usar versión actual" }));
  submit(); await waitFor(() => expect(applied).toHaveBeenCalled());
  expect(new Headers(fetchMock.mock.calls[0][1].headers).get("If-Match")).toBe('"v2"');
});

it("quitar una analítica elimina sus vínculos y no renumera las demás", async () => {
  render(<Harness />); fill();
  fireEvent.click(screen.getByRole("button", { name: "Añadir analítica" }));
  fireEvent.change(screen.getByLabelText("Nombre de analítica 2"), { target: { value: "Glucosa ficticia" } });
  fireEvent.click(screen.getByLabelText("Muestra 1 para analítica 2"));
  fireEvent.click(screen.getByRole("button", { name: "Quitar analítica 1" }));
  expect(screen.getByLabelText("Nombre de analítica 1")).toHaveValue("Glucosa ficticia");
  expect(readSpecimenDraft(user, path).draft?.fields.analysis_a1).toBeUndefined();
  submit(); await waitFor(() => expect(applied).toHaveBeenCalled());
  const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
  expect(body.analyses).toEqual([{ key: "a2", title: "Glucosa ficticia" }]);
  expect(body.specimens[0].analysis_keys).toEqual(["a2"]);
});

it("no limpia vínculos editados después del envío ni aplica respuestas tras abandonar", async () => {
  let resolve!: (value: Response) => void;
  fetchMock.mockImplementation(() => new Promise<Response>(r => { resolve = r; }));
  const view = render(<Harness />); fill(); submit();
  // A late confirmation must compare the whole nested definition.
  const title = screen.getByLabelText("Nombre de analítica 1");
  fireEvent.change(title, { target: { value: "Analítica posterior ficticia" } });
  await act(async () => resolve({ ok: true, status: 201, json: async () => episode } as Response));
  expect(title).toHaveValue("Analítica posterior ficticia");
  expect(readSpecimenDraft(user, path).draft).toBeDefined();
  submit(); view.unmount();
  await act(async () => resolve({ ok: true, status: 201, json: async () => episode } as Response));
  expect(applied).toHaveBeenCalledTimes(1);
});

it("reintenta la definición original con la misma clave sin borrar una definición posterior", async () => {
  render(<Harness />); fill();
  fetchMock.mockRejectedValueOnce(new Error("Fallo ficticio de conexión"));
  submit(); await screen.findByRole("heading", { name: "EP-22 · Crear orden de laboratorio" });
  fireEvent.change(screen.getByLabelText("Nombre de analítica 1"), { target: { value: "Texto posterior ficticio" } });
  fireEvent.click(screen.getByRole("button", { name: "Reintentar operación original" }));
  await waitFor(() => expect(applied).toHaveBeenCalled());
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const first = fetchMock.mock.calls[0][1] as RequestInit, second = fetchMock.mock.calls[1][1] as RequestInit;
  expect(second.body).toBe(first.body);
  expect(new Headers(second.headers).get("Idempotency-Key")).toBe(new Headers(first.headers).get("Idempotency-Key"));
  expect(screen.getByLabelText("Nombre de analítica 1")).toHaveValue("Texto posterior ficticio");
});

it("un conflicto al resolver el envío incierto consulta datos actuales y conserva el borrador", async () => {
  render(<Harness />); fill();
  fetchMock.mockRejectedValueOnce(new Error("Fallo ficticio de conexión"));
  submit(); await screen.findByRole("heading", { name: "EP-22 · Crear orden de laboratorio" });
  fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ detail: { code: "version_conflict", message: "Episodio cambiado" } }) } as Response);
  fireEvent.click(screen.getByRole("button", { name: "Reintentar operación original" }));
  await waitFor(() => expect(conflict).toHaveBeenCalled());
  expect(screen.getByLabelText("Nombre de analítica 1")).toHaveValue("Hemograma ficticio");
  expect(screen.getByLabelText("Muestra 1 para analítica 1")).toBeChecked();
  expect(applied).not.toHaveBeenCalled();
});

it.each(["NURSE", "LAB", "SUPERVISOR", "RECEPTION"])("no ofrece creación a %s", role => {
  render(<Harness role={role} />); expect(screen.queryByRole("heading", { name: "Nueva orden de laboratorio" })).not.toBeInTheDocument();
});
it.each(["CLOSED", "ANNULLED"])("no ofrece creación en episodio %s", status => {
  render(<Harness value={{ ...episode, status }} />); expect(screen.queryByRole("heading", { name: "Nueva orden de laboratorio" })).not.toBeInTheDocument();
});
it("sin integración LAB conserva el circuito anterior sin ofrecer una ruta inactiva", () => {
  render(<Harness value={{ ...episode, laboratory: undefined }} />); expect(screen.queryByRole("heading", { name: "Nueva orden de laboratorio" })).not.toBeInTheDocument();
});
