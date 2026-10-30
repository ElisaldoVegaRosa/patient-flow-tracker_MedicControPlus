import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import LaboratoryFollowupCard from "./LaboratoryFollowupCard";
import { doctor, receiver, followup } from "../testFixtures/laboratoryFollowup";
import { usePendingOperations } from "../hooks/usePendingOperations";
import { notifyOperationalConfirmation } from "../session/operationalWrites";
import { readSpecimenDraft } from "../session/specimenDrafts";
import type { LaboratoryFollowup, SessionUser } from "../types/clinical";

const applied = vi.fn((path: string, _result: unknown, body?: BodyInit | null) => notifyOperationalConfirmation(path, body));
let fetchMock: ReturnType<typeof vi.fn>;
function Harness({ item = followup, user = doctor }: { item?: LaboratoryFollowup; user?: SessionUser }) {
  const operations = usePendingOperations();
  return <LaboratoryFollowupCard {...{ item, user, operations }} doctors={[doctor, receiver]} onDirty={() => {}} onApplied={applied} onConflict={vi.fn()} />;
}
function form(label: string) {
  fireEvent.click(screen.getByText("Paciente ficticio · EP-22 · Seguimiento tras alta"));
  const summary = screen.getByText(label, { selector: "summary" }); fireEvent.click(summary);
  return within(summary.closest("details")!);
}
const reason = (f: ReturnType<typeof within>) => fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Motivo ficticio" } });
beforeEach(() => { localStorage.setItem("token", "token-ficticio"); fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: 22 }) }) as Response); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

it("el responsable actualiza solo el plan con fecha dominicana, versión de seguimiento y clave", async () => {
  render(<Harness />); const f = form("Actualizar plan de seguimiento"); reason(f);
  fireEvent.change(f.getByLabelText("Cómo se informará al paciente"), { target: { value: "Nuevo contacto ficticio" } });
  fireEvent.click(f.getByRole("button", { name: "Actualizar plan de seguimiento" }));
  await waitFor(() => expect(applied).toHaveBeenCalled());
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toContain("/lab/followups/1/plan");
  expect(new Headers(init.headers).get("If-Match")).toBe('"f1"');
  expect(new Headers(init.headers).get("Idempotency-Key")).toBeTruthy();
  expect(JSON.parse(String(init.body))).toEqual({ reason: "Motivo ficticio", review_due_at: "2099-10-29T09:00:00-04:00", communication_plan: "Nuevo contacto ficticio" });
});
it("coordinación propone un médico activo sin asumir responsabilidad ni registrar revisión", async () => {
  render(<Harness user={{ username: "coord.demo", role: "NURSE", can_coordinate: true }} />);
  const f = form("Proponer relevo del seguimiento"); reason(f);
  expect(f.queryByRole("option", { name: /Médico Demo/ })).not.toBeInTheDocument();
  fireEvent.change(f.getByLabelText("Médico receptor"), { target: { value: "4" } });
  fireEvent.click(f.getByRole("button", { name: "Proponer relevo del seguimiento" }));
  await waitFor(() => expect(applied).toHaveBeenCalled());
  expect(String(fetchMock.mock.calls[0][0])).toContain("/lab/followups/1/propose");
  expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ reason: "Motivo ficticio", user_id: 4 });
  expect(screen.queryByText("Actualizar plan de seguimiento", { selector: "summary" })).not.toBeInTheDocument();
});
it("el receptor acepta expresamente y solo entonces cambia la responsabilidad en servidor", async () => {
  render(<Harness item={{ ...followup, pending_user_id: 4, proposed: receiver }} user={receiver} />);
  const f = form("Aceptar responsabilidad del seguimiento"); reason(f);
  expect(screen.getByText("Responsable: Médico Demo (medico.demo).")).toBeVisible();
  fireEvent.click(f.getByRole("button", { name: "Aceptar responsabilidad del seguimiento" }));
  await waitFor(() => expect(applied).toHaveBeenCalled());
  expect(String(fetchMock.mock.calls[0][0])).toContain("/lab/followups/1/accept");
  expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ reason: "Motivo ficticio" });
});
it.each(["LAB", "NURSE", "SUPERVISOR"])("%s sin coordinación consulta sin modificar el seguimiento", role => {
  render(<Harness user={{ username: "otra.cuenta", role }} />);
  expect(screen.queryByText("Actualizar plan de seguimiento", { selector: "summary" })).not.toBeInTheDocument();
  expect(screen.queryByText("Proponer relevo del seguimiento", { selector: "summary" })).not.toBeInTheDocument();
  expect(screen.queryByText("Aceptar responsabilidad del seguimiento", { selector: "summary" })).not.toBeInTheDocument();
});
it("otro ciclo bloquea campos anteriores y conserva el motivo ante cambios de versión", () => {
  const view = render(<Harness />); const f = form("Actualizar plan de seguimiento"); reason(f);
  view.rerender(<Harness item={{ ...followup, current_cycle: false, version: '"f2"', episode_status: "ACTIVE" }} />);
  expect(f.getByRole("button", { name: "Actualizar plan de seguimiento" })).toBeDisabled();
  expect(f.getByLabelText("Motivo")).toHaveValue("Motivo ficticio");
  expect(readSpecimenDraft(doctor, "/lab/followups/1/plan").draft?.baseline).toBe('"f1"');
});
it("recuperar un borrador no envía y exige revisar la versión actual", () => {
  const view = render(<Harness />); const f = form("Actualizar plan de seguimiento"); reason(f); view.unmount();
  render(<Harness item={{ ...followup, version: '"f2"' }} />); const restored = form("Actualizar plan de seguimiento");
  expect(restored.getByLabelText("Motivo")).toHaveValue("Motivo ficticio");
  expect(restored.getByRole("button", { name: "Actualizar plan de seguimiento" })).toBeDisabled();
  expect(fetchMock).not.toHaveBeenCalled();
});
it("el receptor puede rechazar el relevo con motivo y el responsable anterior se conserva", async () => {
  render(<Harness item={{ ...followup, pending_user_id: 4, proposed: receiver }} user={receiver} />);
  const f = form("Cancelar o rechazar relevo del seguimiento"); reason(f);
  fireEvent.click(f.getByRole("button", { name: "Cancelar o rechazar relevo del seguimiento" }));
  await waitFor(() => expect(applied).toHaveBeenCalled());
  expect(String(fetchMock.mock.calls[0][0])).toContain("/lab/followups/1/cancel-handoff");
  expect(screen.getByText("Responsable: Médico Demo (medico.demo).")).toBeVisible();
});
it("una respuesta tardía no actualiza una vista abandonada", async () => {
  let resolve!: (value: Response) => void;
  fetchMock.mockImplementation(() => new Promise<Response>(r => { resolve = r; }));
  const view = render(<Harness />); const f = form("Actualizar plan de seguimiento"); reason(f);
  fireEvent.click(f.getByRole("button", { name: "Actualizar plan de seguimiento" })); view.unmount();
  await act(async () => resolve({ ok: true, status: 200, json: async () => ({ id: 22 }) } as Response));
  expect(applied).not.toHaveBeenCalled();
});
it("historial legible se consulta al desplegar y conserva valores anteriores y nuevos", async () => {
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ items: [{ id: 1, action: "PROPOSE", username: "coord.demo", created_at: "2026-10-28T12:00:00Z", reason: "Relevo ficticio",
    previous: { owner: doctor, proposed: null, review_due_at: followup.review_due_at, communication_plan: "Plan previo" },
    next: { owner: doctor, proposed: receiver, review_due_at: followup.review_due_at, communication_plan: "Plan vigente" } }], has_more: false, offset: 0, limit: 20 }) } as Response);
  render(<Harness />); fireEvent.click(screen.getByText("Paciente ficticio · EP-22 · Seguimiento tras alta"));
  expect(fetchMock).not.toHaveBeenCalled();
  const summary = screen.getByText("Historial del seguimiento", { selector: "summary" }); fireEvent.click(summary);
  await screen.findByRole("heading", { name: "Relevo propuesto" });
  fireEvent.click(screen.getByText("Ver cambios anteriores y nuevos"));
  expect(screen.getByText("Comunicación: Plan previo.")).toBeVisible();
  expect(screen.getByText("Comunicación: Plan vigente.")).toBeVisible();
  expect(String(fetchMock.mock.calls[0][0])).toContain("/lab/followups/1/history?limit=20&offset=0");
});
