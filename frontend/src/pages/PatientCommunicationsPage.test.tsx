import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import PatientCommunicationsPage from "./PatientCommunicationsPage";
import { usePendingOperations } from "../hooks/usePendingOperations";
import { establishSession } from "../api/client";
import type { CommunicationCase, SessionUser } from "../types/clinical";

const reception: SessionUser = { username: "recepcion", role: "RECEPTION" };
const sample: CommunicationCase = { followup_id: 1, episode_id: 23, patient_name: "Paciente ficticio", owner_name: "Medico ficticio", version: '"v1"', current_cycle: true,
  notice_id: 1, valid: true, contacted: false, explained: false, can_authorize: false, can_explain: false, can_attempt: true,
  mode: "CONTACT_ONLY", message: "Contacte al medico", authorized_at: "2026-10-30T13:00:00Z", next_attempt_at: null, history: [], history_count: 1 };
const response = (value: unknown, status = 200) => ({ ok: status < 400, status, json: async () => value }) as Response;
const queue = (item = sample) => ({ enabled: true, total: 1, has_more: false, items: [item] });
function Harness({ user = reception }: { user?: SessionUser }) { const operations = usePendingOperations(); return <PatientCommunicationsPage {...{ user, operations }} />; }
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); sessionStorage.clear(); });

it("Recepcion consulta avisos sin acciones medicas ni campo de telefono", async () => {
  establishSession("ficticio"); vi.stubGlobal("fetch", vi.fn(async () => response(queue())));
  render(<Harness />); await screen.findByText("Mensaje autorizado: Contacte al medico");
  expect(screen.queryByText("Autorizar aviso de Recepción")).not.toBeInTheDocument();
  expect(screen.queryByText("Registrar explicación clínica")).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Teléfono/)).not.toBeInTheDocument();
  expect(screen.getByText(/El número se consulta/)).toBeInTheDocument();
  expect(screen.getByText(/Contacto y aviso: Pendientes. Explicación clínica: Pendiente/)).toBeInTheDocument();
});

it("un contacto confirmado sigue mostrando explicacion clinica pendiente", async () => {
  establishSession("ficticio"); vi.stubGlobal("fetch", vi.fn(async () => response(queue({ ...sample, contacted: true }))));
  render(<Harness />);
  await screen.findByText(/Contacto y aviso: Confirmados. Explicación clínica: Pendiente/);
});

it("no confunde ausencia de etiqueta con estado inactivo del responsable", async () => {
  establishSession("ficticio"); vi.stubGlobal("fetch", vi.fn(async () => response(queue({ ...sample, owner_name: null }))));
  render(<Harness />);
  await screen.findByText("Médico responsable: Sin responsable identificado.");
  expect(screen.queryByText(/Sin responsable activo/)).not.toBeInTheDocument();
});

it("no interpreta base sin activar como bandeja vacia ni habilita escrituras", async () => {
  establishSession("ficticio"); vi.stubGlobal("fetch", vi.fn(async () => response({ enabled: false, items: [], total: 0, has_more: false })));
  render(<Harness />); await screen.findByText(/todavía no habilitado/);
  expect(screen.queryByText("Registrar gestión de contacto")).not.toBeInTheDocument();
});

it("guarda WhatsApp leido sin convertirlo en confirmado y usa cliente central", async () => {
  establishSession("ficticio");
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => response(init?.method === "POST" ? { saved: true } : queue()));
  vi.stubGlobal("fetch", fetchMock); render(<Harness />);
  await screen.findByText("Registrar gestión de contacto");
  const form = screen.getByRole("button", { name: "Guardar gestión" }).closest("form")!;
  fireEvent.change(within(form).getByLabelText("Medio"), { target: { value: "WHATSAPP" } });
  fireEvent.change(within(form).getByLabelText("Resultado de la gestión"), { target: { value: "READ" } });
  fireEvent.change(within(form).getByLabelText("Motivo"), { target: { value: "Sin respuesta en ensayo ficticio" } });
  fireEvent.submit(form);
  await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
  const init = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")![1]!;
  const body = JSON.parse(String(init.body));
  expect(body.outcome).toBe("READ"); expect(body.identity_verified).toBe(false); expect(body.transmitted).toBe(false);
  expect(new Headers(init.headers).get("If-Match")).toBe('"v1"');
  expect(new Headers(init.headers).get("Idempotency-Key")).toBeTruthy();
});

it("reserva autorizacion y explicacion al medico responsable", async () => {
  establishSession("ficticio"); vi.stubGlobal("fetch", vi.fn(async () => response(queue({ ...sample, can_authorize: true, can_explain: true, can_attempt: false }))));
  render(<Harness user={{ username: "medico", role: "DOCTOR" }} />);
  await screen.findByText("Autorizar aviso de Recepción"); expect(screen.getByText("Registrar explicación clínica")).toBeInTheDocument();
  expect(screen.queryByText("Registrar gestión de contacto")).not.toBeInTheDocument();
});

it("conserva campos al consultar una autorizacion caducada y bloquea guardar", async () => {
  establishSession("ficticio"); let stale = false;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname;
    if (path === "/communications/1") return response({ ...sample, version: '"v2"', valid: false, message: null, can_attempt: false });
    return response(stale ? { enabled: true, items: [], total: 0, has_more: false } : queue());
  }));
  render(<Harness />); await screen.findByText("Registrar gestión de contacto");
  const form = screen.getByRole("button", { name: "Guardar gestión" }).closest("form")!;
  fireEvent.change(within(form).getByLabelText("Motivo"), { target: { value: "Borrador ficticio conservado" } });
  stale = true; fireEvent.click(screen.getByRole("button", { name: "Actualizar contactos" }));
  await screen.findByText(/Falta un aviso vigente/);
  expect(within(form).getByLabelText("Motivo")).toHaveValue("Borrador ficticio conservado");
  expect(screen.getByRole("button", { name: "Guardar gestión" })).toBeDisabled();
});

it("retira datos cuando se deniega la consulta", async () => {
  establishSession("ficticio"); let denied = false;
  vi.stubGlobal("fetch", vi.fn(async () => denied ? response({ detail: "Acceso retirado" }, 403) : response(queue())));
  render(<Harness />); await screen.findByText("Mensaje autorizado: Contacte al medico");
  denied = true; fireEvent.click(screen.getByRole("button", { name: "Actualizar contactos" }));
  await screen.findByText(/El acceso cambió/); expect(screen.queryByText("Mensaje autorizado: Contacte al medico")).not.toBeInTheDocument();
});

it("actualiza visible y pausa cuando hay formulario editado", async () => {
  establishSession("ficticio"); const fetchMock = vi.fn(async () => response(queue())); vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers(); render(<Harness />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(screen.getByText("Registrar gestión de contacto")).toBeInTheDocument();
  const before = fetchMock.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(15001); });
  expect(fetchMock.mock.calls.length).toBeGreaterThan(before);
  const form = screen.getByRole("button", { name: "Guardar gestión" }).closest("form")!;
  fireEvent.change(within(form).getByLabelText("Motivo"), { target: { value: "Borrador ficticio" } });
  const paused = fetchMock.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(30001); });
  expect(fetchMock.mock.calls.length).toBe(paused);
});

it("recupera el borrador del mismo profesional y exige revisar la nueva version", async () => {
  establishSession("ficticio"); let newer = false;
  vi.stubGlobal("fetch", vi.fn(async () => response(queue({ ...sample, version: newer ? '"v2"' : '"v1"' }))));
  const first = render(<Harness />); await screen.findByText("Registrar gestión de contacto");
  let form = screen.getByRole("button", { name: "Guardar gestión" }).closest("form")!;
  fireEvent.change(within(form).getByLabelText("Motivo"), { target: { value: "Borrador ficticio recuperado" } });
  first.unmount(); newer = true;
  render(<Harness />); await screen.findByText("Registrar gestión de contacto");
  form = screen.getByRole("button", { name: "Guardar gestión" }).closest("form")!;
  expect(within(form).getByLabelText("Motivo")).toHaveValue("Borrador ficticio recuperado");
  expect(screen.getByRole("button", { name: "Guardar gestión" })).toBeDisabled();
  expect(screen.getByText(/Tus campos se conservan/)).toBeInTheDocument();
});
