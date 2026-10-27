import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import CareQueuePage from "./CareQueuePage";
import { usePendingOperations } from "../hooks/usePendingOperations";
import { establishSession, invalidateSession } from "../api/client";
import { notifyOperationalConfirmation, operationalFormDirty } from "../session/operationalWrites";
import type { CareEpisode, CareQueue, User } from "../types/clinical";

const doctor = { id: 8, username: "medico.uno", display_name: "Medico ficticio", role: "DOCTOR", active: 1 };
const other = { ...doctor, id: 9, username: "medico.dos", display_name: "Otro medico ficticio" };
const nurse = { ...doctor, id: 10, username: "enfermera.uno", role: "NURSE" };
const candidate = { ...doctor, high_priority: 0, pending_tasks: 0, total: 0, by_priority: { "1": 0 }, incoming: 0, last_assignment_at: null, last_assignment_order: 0 };
const episode: CareEpisode = { episode_id: 21, name: "Paciente ficticio", status: "ACTIVE", priority: 3, location: "Sala de espera",
  area_id: 2, area_name: "Consulta", legacy_assigned_to: "Texto anterior", ready_at: "2026-10-21T12:00:00Z", arrival_at: "2026-10-21T11:50:00Z", historical: 0,
  version: '"care-0"', since_arrival_minutes: 20, since_ready_minutes: 10, lab_pending: 1, open_alert_count: 2,
  slots: ["DOCTOR", "NURSE"].map(discipline => ({ discipline: discipline as "DOCTOR" | "NURSE", user_id: null, pending_user_id: null, owner: null,
    proposed: null, started_at: null, first_started_at: null, covered: false, needs_coverage: true, candidates: [{ ...candidate, ...(discipline === "NURSE" ? nurse : doctor) }], waiting_minutes: 10 })) };
const response = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as Response;

function setup(userOverrides: Partial<User> = {}, initial = episode) {
  establishSession("care-test");
  const user: User = { ...doctor, access_token: "care-test", can_coordinate: true, ...userOverrides };
  let data: CareQueue = { episodes: [structuredClone(initial)], areas: [{ id: 2, name: "Consulta", active: 1 }, { id: 3, name: "Observación", active: 1 }], requested_by: user.username };
  let detail = structuredClone(initial);
  const writes = vi.fn(async (path: string, options: RequestInit) => { void path; void options; return response(200, detail); });
  const fetchMock = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (options?.method && options.method !== "GET") return writes(path, options);
    if (path === "/care/queue") return response(200, data);
    if (path === "/care/episodes/21") return response(200, detail);
    throw new Error(`Unexpected ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  const open = vi.fn();
  function Harness() { return <CareQueuePage user={user} operations={usePendingOperations()} onOpenEpisode={open} />; }
  render(<Harness />);
  return { writes, fetchMock, open, update: (value: CareEpisode | null, archived = initial) => { data = { ...data, episodes: value ? [value] : [] }; detail = archived; } };
}
afterEach(() => { invalidateSession(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function ready() {
  const card = await screen.findByRole("article", { name: "Seguimiento EP-21" });
  document.querySelectorAll("details").forEach(node => { node.open = true; });
  return card;
}
function fill(group: HTMLElement, label: string, value: string) { fireEvent.change(within(group).getByLabelText(label), { target: { value } }); }

it("shows overdue reevaluations before unfolding the patient and never completes them by reading", async () => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-26T21:31:00Z"));
  const { writes } = setup({}, { ...episode, reevaluations: [{ id: 1, episode_id: 21, group_id: 1,
    title: "Accion ficticia", group_title: "Seguimiento ficticio", service: "MEDICAL", status: "PENDING",
    due_at: "2026-10-26T21:30:00Z", result: null, revision: 0, owner_id: 8, owner_name: "Medico ficticio",
    owner_username: doctor.username, version: '"reevaluation-0"', created_by: doctor.username }] });
  const card = await screen.findByRole("article", { name: "Seguimiento EP-21" });
  expect(card.querySelector("details")!.open).toBe(false);
  expect(within(card).getByText("Reevaluaciones pendientes: 1 · Vencidas: 1")).toBeVisible();
  expect(writes).not.toHaveBeenCalled();
});

it("confirms an assignment with version and numeric ID without implying attention started", async () => {
  const { writes } = setup();
  const card = await ready();
  const form = within(card).getByRole("group", { name: "Confirmar responsable de Medicina" });
  fill(form, "Profesional receptor", "8"); fill(form, "Motivo", "Asignacion ficticia de prueba");
  let resolve!: (value: Response) => void;
  writes.mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; }));
  const button = within(form).getByRole("button", { name: "Confirmar responsable de Medicina" });
  fireEvent.click(button); fireEvent.click(button);
  expect(writes).toHaveBeenCalledTimes(1);
  const [path, options] = writes.mock.calls[0];
  expect(path).toBe("/care/episodes/21/DOCTOR/assign");
  expect(options.method).toBe("POST");
  expect(new Headers(options.headers).get("If-Match")).toBe(episode.version);
  expect(new Headers(options.headers).get("Idempotency-Key")).toBeTruthy();
  expect(JSON.parse(String(options.body))).toEqual({ user_id: 8, reason: "Asignacion ficticia de prueba" });
  expect(JSON.stringify(localStorage)).not.toContain("Asignacion ficticia de prueba");
  await act(async () => resolve(response(200, episode)));
  expect(within(form).getByLabelText("Motivo")).toHaveValue("");
  expect(writes.mock.calls.some(([url]) => url.endsWith("/start"))).toBe(false);
});

it("keeps pending handoffs with the old owner and enables acceptance only for the recipient", async () => {
  const value = structuredClone(episode);
  value.slots[0] = { ...value.slots[0], owner: other, user_id: 9, proposed: doctor, pending_user_id: 8 };
  setup({ can_coordinate: false }, value);
  const card = await ready();
  expect(within(card).getByText(/Hasta aceptar, sigue responsable Otro medico/)).toBeInTheDocument();
  expect(within(card).getByRole("button", { name: "Aceptar relevo de Medicina" })).toBeEnabled();
  expect(within(card).getByRole("button", { name: "Confirmar inicio de Medicina" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Mostrar cola"), { target: { value: "true" } });
  expect(card).toBeVisible();
});

it("prevents non-recipients from accepting and prevents a professional from assigning someone else", async () => {
  const value = structuredClone(episode);
  value.slots[0].candidates.push({ ...candidate, ...other });
  setup({ can_coordinate: false }, value);
  const card = await ready();
  const group = within(card).getByRole("group", { name: "Confirmar responsable de Medicina" });
  expect(within(group).queryByRole("option", { name: /Otro medico/ })).not.toBeInTheDocument();
  expect(within(card).getByRole("button", { name: "Aceptar relevo de Medicina" })).toBeDisabled();
  expect(within(card).queryByRole("button", { name: "Confirmar responsable de Enfermería" })).not.toBeInTheDocument();
});

it("preserves local fields on version conflict and requires explicit review", async () => {
  const { writes, update } = setup();
  const card = await ready();
  const group = within(card).getByRole("group", { name: "Confirmar responsable de Medicina" });
  fill(group, "Profesional receptor", "8"); fill(group, "Motivo", "Motivo conservado");
  update({ ...episode, version: '"care-1"' });
  writes.mockResolvedValueOnce(response(409, { detail: { code: "version_conflict", message: "Cambio la carga" } }));
  fireEvent.click(within(group).getByRole("button", { name: "Confirmar responsable de Medicina" }));
  await within(group).findByText(/Estos datos cambiaron/);
  expect(within(group).getByLabelText("Motivo")).toHaveValue("Motivo conservado");
  expect(within(group).getByRole("button", { name: "Confirmar responsable de Medicina" })).toBeDisabled();
  fireEvent.click(within(group).getByRole("button", { name: "He revisado los cambios; usar versión actual" }));
  fireEvent.click(within(group).getByRole("button", { name: "Confirmar responsable de Medicina" }));
  await waitFor(() => expect(writes).toHaveBeenCalledTimes(2));
  expect(new Headers(writes.mock.calls[1][1].headers).get("If-Match")).toBe('"care-1"');
});

it("retains the same form when another session assigns the patient or closes the episode", async () => {
  const { update, writes } = setup();
  const card = await ready();
  const group = within(card).getByRole("group", { name: "Confirmar responsable de Medicina" });
  fill(group, "Motivo", "Edicion local sin perder");
  const current = { ...structuredClone(episode), version: '"changed"' };
  current.slots[0] = { ...current.slots[0], owner: other, user_id: 9 };
  update(current);
  fireEvent.click(screen.getByRole("button", { name: "Consultar colas actuales" }));
  await within(card).findByText("Responsable confirmado: Otro medico ficticio (medico.dos).");
  expect(within(group).getByLabelText("Motivo")).toHaveValue("Edicion local sin perder");
  expect(within(group).getByRole("button", { name: "Confirmar responsable de Medicina" })).toBeDisabled();
  update(null, { ...current, status: "CLOSED", version: '"closed"' });
  fireEvent.click(screen.getByRole("button", { name: "Consultar colas actuales" }));
  await within(card).findByText(/Episodio finalizado/);
  expect(within(group).getByLabelText("Motivo")).toHaveValue("Edicion local sin perder");
  expect(writes).not.toHaveBeenCalled();
});

it("keeps filters mounted and does not clear new edits for a late earlier confirmation", async () => {
  setup();
  const card = await ready();
  const group = within(card).getByRole("group", { name: "Confirmar responsable de Medicina" });
  fill(group, "Profesional receptor", "8"); fill(group, "Motivo", "Campos nuevos");
  fireEvent.change(screen.getByLabelText("Filtrar área de seguimiento"), { target: { value: "3" } });
  expect(card).not.toBeVisible();
  fireEvent.change(screen.getByLabelText("Filtrar área de seguimiento"), { target: { value: "" } });
  expect(within(group).getByLabelText("Motivo")).toHaveValue("Campos nuevos");
  act(() => notifyOperationalConfirmation("/care/episodes/21/DOCTOR/assign", JSON.stringify({ user_id: 8, reason: "Campos anteriores" })));
  expect(within(group).getByLabelText("Motivo")).toHaveValue("Campos nuevos");
});

it("offers read-only shared consultation to a clinical role without assignment permissions", async () => {
  setup({ role: "LAB", username: "laboratorio", can_coordinate: false });
  const card = await ready();
  expect(card.querySelectorAll("form[data-operational]")).toHaveLength(0);
  expect(within(card).getByText(/Son dependencias, no tareas propias/)).toBeInTheDocument();
  expect(within(card).getByText(/Alertas abiertas: 2/)).toBeInTheDocument();
});

it("does not replace the latest requested patient history with an older delayed response", async () => {
  const { fetchMock } = setup();
  await ready();
  let resolve!: (value: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; }));
  const input = screen.getByLabelText("Número de episodio");
  fireEvent.change(input, { target: { value: "21" } });
  fireEvent.click(screen.getByRole("button", { name: "Consultar responsables e historial" }));
  fetchMock.mockResolvedValueOnce(response(200, { ...episode, episode_id: 22, status: "CLOSED", changes: [] }));
  fireEvent.change(input, { target: { value: "22" } });
  fireEvent.click(screen.getByRole("button", { name: "Consultar responsables e historial" }));
  await screen.findByRole("heading", { name: "Historial EP-22 · CLOSED" });
  await act(async () => resolve(response(200, { ...episode, changes: [] })));
  expect(screen.getByRole("heading", { name: "Historial EP-22 · CLOSED" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Historial EP-21 · ACTIVE" })).not.toBeInTheDocument();
});

it("keeps patient and discipline panels folded without discarding edits or sending writes", async () => {
  const { writes } = setup();
  const card = await screen.findByRole("article", { name: "Seguimiento EP-21" });
  const patient = card.querySelector("details")!;
  expect(patient.open).toBe(false);
  expect(screen.getByText("Consultar responsables anteriores").closest("details")!.open).toBe(false);
  fireEvent.click(patient.querySelector("summary")!);
  const medicine = card.querySelector('section[aria-label="Medicina EP-21"] > details') as HTMLDetailsElement;
  expect(medicine.open).toBe(false);
  fireEvent.click(medicine.querySelector("summary")!);
  const form = within(medicine).getByRole("group", { name: "Confirmar responsable de Medicina" });
  fill(form, "Profesional receptor", "8");
  fill(form, "Motivo", "Edición preservada al plegar");
  fireEvent.click(patient.querySelector("summary")!);
  expect(patient.open).toBe(false);
  expect(screen.getByText("Actualización automática pausada mientras editas.")).toBeInTheDocument();
  fireEvent.click(patient.querySelector("summary")!);
  expect(within(medicine).getByRole("group", { name: "Confirmar responsable de Medicina" })).toBe(form);
  expect(within(form).getByLabelText("Motivo")).toHaveValue("Edición preservada al plegar");
  expect(within(form).getByLabelText("Profesional receptor")).toHaveValue("8");
  expect(writes).not.toHaveBeenCalled();
});

it("does not report an unsaved operation for freshly loaded assigned care", async () => {
  const assigned = structuredClone(episode);
  assigned.slots[1] = { ...assigned.slots[1], owner: nurse, user_id: nurse.id, covered: true, needs_coverage: false };
  setup({ role: "NURSE", username: nurse.username, can_coordinate: false }, assigned);
  const card = await ready();
  const start = within(card).getByRole("group", { name: "Confirmar inicio de Enfermería" });
  expect(within(start).getByLabelText("Motivo")).toBeEnabled();
  expect(within(start).getByRole("button", { name: "Confirmar inicio de Enfermería" })).toBeEnabled();
  expect([...document.querySelectorAll<HTMLFormElement>("form[data-operational]")].filter(operationalFormDirty)).toEqual([]);
});

it("identifies and clears a preserved stale assignment draft before the nurse starts", async () => {
  const { update, writes } = setup({ role: "NURSE", username: nurse.username, can_coordinate: false });
  const card = await ready();
  const assignment = within(card).getByRole("group", { name: "Confirmar responsable de Enfermería" });
  fill(assignment, "Profesional receptor", String(nurse.id));
  fill(assignment, "Motivo", "Borrador anterior a asignación ajena");
  const assigned = structuredClone(episode);
  assigned.version = '"assigned"';
  assigned.slots[1] = { ...assigned.slots[1], owner: nurse, user_id: nurse.id, covered: true, needs_coverage: false };
  update(assigned);
  fireEvent.click(screen.getByRole("button", { name: "Consultar colas actuales" }));
  await within(card).findByText("Responsable confirmado: Medico ficticio (enfermera.uno).");
  expect(within(assignment).getByRole("button", { name: "Confirmar responsable de Enfermería" })).toBeDisabled();
  expect(within(assignment).getByLabelText("Motivo")).toHaveValue("Borrador anterior a asignación ajena");
  expect(screen.getByText(/Campos sin guardar en Seguimiento EP-21 · Confirmar responsable de Enfermería/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Descartar campos de Confirmar responsable de Enfermería" }));
  expect(within(assignment).getByLabelText("Motivo")).toHaveValue("");
  expect([...document.querySelectorAll<HTMLFormElement>("form[data-operational]")].filter(operationalFormDirty)).toEqual([]);
  const start = within(card).getByRole("group", { name: "Confirmar inicio de Enfermería" });
  expect(within(start).getByLabelText("Motivo")).toBeEnabled();
  fill(start, "Motivo", "Inicio nuevo");
  expect(screen.getByText(/Campos sin guardar en Seguimiento EP-21 · Confirmar inicio de Enfermería/)).toBeInTheDocument();
  expect(writes).not.toHaveBeenCalled();
});
