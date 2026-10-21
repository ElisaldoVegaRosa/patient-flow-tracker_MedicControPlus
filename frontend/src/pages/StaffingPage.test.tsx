import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import StaffingPage from "./StaffingPage";
import { usePendingOperations } from "../hooks/usePendingOperations";
import { establishSession, invalidateSession } from "../api/client";
import { notifyOperationalConfirmation, operationalFormDirty } from "../session/operationalWrites";
import type { StaffingData } from "../types/clinical";

const user = { username: "medico.uno", role: "DOCTOR", can_coordinate: true, access_token: "staff-test-session" };
const area = { id: 1, name: "Consulta", active: 1, revision: 0, version: '"area-0"' };
const person = { id: 8, username: user.username, display_name: "Medico ficticio", role: "DOCTOR", active: 1, can_coordinate: 1 };
const shift = { id: 1, name: "Noche demo", starts_at: "2026-10-21T00:00:00+00:00", ends_at: "2026-10-21T12:00:00+00:00", coordinator_id: 8,
  coordinator_username: user.username, coordinator_name: person.display_name, coordinator_active: 1, coordinator_permission: 1,
  status: "PLANNED" as const, revision: 0, version: '"shift-0"' };
const assignment = { shift_id: 1, user_id: 8, area_id: 1, status: "PLANNED" as const, revision: 0, version: '"duty-0"',
  ...person, id: 1, account_active: 1, area_name: area.name, area_active: 1, shift_name: shift.name, starts_at: shift.starts_at,
  ends_at: shift.ends_at, shift_status: shift.status, coordinator_id: 8, effective_available: false };
const response = (status: number, value: unknown) => ({ ok: status < 400, status, json: async () => value }) as Response;

function setup(coordinate = true) {
  establishSession("staff-test-session");
  let data: StaffingData = { areas: [area], shifts: [shift], assignments: [assignment], professionals: [person], coordinators: [person], changes: [], requested_by: user.username };
  const mutations = vi.fn(async (path: string, options: RequestInit) => { void path; void options; return response(200, area); });
  const fetchMock = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path === "/staff/planning") return response(200, data);
    if (path === "/staff/mine") return response(200, { assignments: data.assignments, requested_by: user.username });
    if (path.startsWith("/staff/")) return mutations(path, options!);
    throw new Error(`Unexpected ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  function Harness() { return <StaffingPage user={{ ...user, can_coordinate: coordinate }} operations={usePendingOperations()} />; }
  render(<Harness />);
  return { fetchMock, mutations, update: (value: StaffingData) => { data = value; }, data };
}
afterEach(() => { invalidateSession(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("shows only the user's read-only planning without requesting coordination data", async () => {
  const { fetchMock } = setup(false);
  await screen.findByText(/Estado registrado: Planificado/);
  expect(screen.getByRole("heading", { name: "Mi turno" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Crear turno" })).not.toBeInTheDocument();
  expect(screen.queryByRole("group")).not.toBeInTheDocument();
  expect(fetchMock.mock.calls.every(([url]) => String(url).endsWith("/staff/mine"))).toBe(true);
});

it("sends Dominican midnight-crossing dates with an explicit offset and requires personal staff", async () => {
  const { mutations } = setup();
  await screen.findByRole("article", { name: "Turno Noche demo" });
  const form = screen.getByRole("group", { name: "Crear turno" });
  for (const [label, value] of [["Nombre del turno", "Noche nueva"], ["Inicio · hora dominicana", "2026-10-20T20:00"], ["Fin · hora dominicana", "2026-10-21T08:00"], ["Responsable de coordinación", "8"], ["Motivo", "Planificacion ficticia"]])
    fireEvent.change(within(form).getByLabelText(label), { target: { value } });
  fireEvent.click(within(form).getByRole("button", { name: "Crear turno" }));
  await waitFor(() => expect(mutations).toHaveBeenCalledTimes(1));
  expect(mutations.mock.calls[0][0]).toBe("/staff/shifts");
  expect(JSON.parse(String(mutations.mock.calls[0][1].body))).toEqual({ name: "Noche nueva", starts_at: "2026-10-20T20:00:00-04:00", ends_at: "2026-10-21T08:00:00-04:00", coordinator_id: 8, reason: "Planificacion ficticia" });
  expect(new Headers(mutations.mock.calls[0][1].headers).get("Idempotency-Key")).toBeTruthy();
  expect(screen.getByText("Medico ficticio (medico.uno) · DOCTOR")).toBeInTheDocument();
});

it("preserves edits after a version conflict and sends reviewed versions only after explicit review", async () => {
  const { mutations, update, data } = setup();
  await screen.findByRole("article", { name: "Turno Noche demo" });
  const details = screen.getByText("Consulta · Activa").closest("details")!;
  details.open = true;
  const group = within(details).getByRole("group", { name: "Actualizar área" });
  fireEvent.change(within(group).getByLabelText("Nombre del área"), { target: { value: "Consulta nueva" } });
  fireEvent.change(within(group).getByLabelText("Motivo"), { target: { value: "Motivo local" } });
  update({ ...data, areas: [{ ...area, version: '"area-1"', name: "Cambio remoto" }] });
  mutations.mockResolvedValueOnce(response(409, { detail: { code: "version_conflict", message: "Otra sesion cambio datos" } }));
  fireEvent.click(within(group).getByRole("button", { name: "Actualizar área" }));
  await within(group).findByText(/Estos datos cambiaron/);
  expect(within(group).getByLabelText("Nombre del área")).toHaveValue("Consulta nueva");
  expect(within(group).getByRole("button", { name: "Actualizar área" })).toBeDisabled();
  fireEvent.click(within(group).getByRole("button", { name: "He revisado los cambios; usar versión actual" }));
  fireEvent.click(within(group).getByRole("button", { name: "Actualizar área" }));
  await waitFor(() => expect(mutations).toHaveBeenCalledTimes(2));
  expect(new Headers(mutations.mock.calls[1][1].headers).get("If-Match")).toBe('"area-1"');
});

it("does not erase new fields when an earlier receipt arrives and keeps filtered forms mounted", async () => {
  setup();
  await screen.findByRole("article", { name: "Turno Noche demo" });
  const group = screen.getByRole("group", { name: "Crear área" });
  fireEvent.change(within(group).getByLabelText("Nombre del área"), { target: { value: "Borrador diferente" } });
  fireEvent.change(within(group).getByLabelText("Motivo"), { target: { value: "Motivo actual" } });
  act(() => notifyOperationalConfirmation("/staff/areas", JSON.stringify({ name: "Area anterior", reason: "Motivo anterior" })));
  expect(within(group).getByLabelText("Nombre del área")).toHaveValue("Borrador diferente");
  act(() => notifyOperationalConfirmation("/staff/recovered"));
  expect(within(group).getByLabelText("Motivo")).toHaveValue("Motivo actual");
  const duty = screen.getByRole("article", { name: "Planificación medico.uno 1" });
  const availability = within(duty).getByRole("group", { name: "Confirmar disponibilidad" });
  fireEvent.change(within(availability).getByLabelText("Motivo"), { target: { value: "Pendiente local" } });
  fireEvent.change(screen.getByLabelText("Filtrar por área"), { target: { value: "1" } });
  expect(within(availability).getByLabelText("Motivo")).toHaveValue("Pendiente local");
});

it("detects select-only edits relative to default selection", () => {
  const { container } = render(<form><select name="active" defaultValue="false"><option value="true">Activa</option><option value="false">Inactiva</option></select></form>);
  const form = container.querySelector("form")!;
  expect(operationalFormDirty(form)).toBe(false);
  fireEvent.change(within(form).getByRole("combobox"), { target: { value: "true" } });
  expect(operationalFormDirty(form)).toBe(true);
});
