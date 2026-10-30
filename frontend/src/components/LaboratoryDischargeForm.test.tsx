import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import LaboratoryDischargeForm from "./LaboratoryDischargeForm";
import { usePendingOperations } from "../hooks/usePendingOperations";
import { notifyOperationalConfirmation } from "../session/operationalWrites";
import { readSpecimenDraft } from "../session/specimenDrafts";
import type { Episode, LaboratoryAnalysisDetail } from "../types/clinical";

const stamp = "2026-10-01T12:00:00Z";
const analysis: LaboratoryAnalysisDetail = { id: 5, title: "Analítica nueva", version: '"a1"', cancelled_at: null, cancellation_reason: null,
  medical_owner: { username: "medico.demo", role: "DOCTOR", active: 1 }, required_specimens: [{ id: 1, received_at: stamp, suitability: "ACCEPTED" }],
  has_published_result: true, needs_medical_review: false, satisfies_current_samples: true, current_version: null, versions: [] };
const episode: Episode = { id: 22, status: "ACTIVE", clinical_version: '"clinical"', name: "Paciente ficticio", birth_date: "1990-01-01", document: "DEMO-MIXED", qr_token: "qr-ficticio",
  priority: 3, location: "Consulta", started_at: stamp, alerts: [], vitals: [], events: [],
  tasks: [{ id: 1, episode_id: 22, title: "Orden anterior ficticia", service: "LAB", status: "COMPLETED", result: "Resultado anterior ficticio", version: '"t1"' }],
  laboratory: { legacy_order_ids: [1], orders: [{ task_id: 2, task_status: "PENDING", specimens: [], results: [analysis] }] } };
const applied = vi.fn((path: string, _value: unknown, body?: BodyInit | null) => notifyOperationalConfirmation(path, body));
let fetchMock: ReturnType<typeof vi.fn>;
function Harness({ value = episode, username = "medico.demo", role = "DOCTOR" }: { value?: Episode; username?: string; role?: string }) {
  const operations = usePendingOperations();
  return <LaboratoryDischargeForm episode={value} user={{ username, role }} operations={operations} onApplied={applied} onConflict={vi.fn()} />;
}
function fill() {
  fireEvent.change(screen.getByLabelText("Nota de alta"), { target: { value: "Alta ficticia mixta" } });
  fireEvent.change(screen.getByLabelText("Motivo del alta con laboratorio"), { target: { value: "Revisión expresa ficticia" } });
}
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Cerrar episodio · Alta médica" }));
const pending = () => ({ ...episode, laboratory: { ...episode.laboratory!, orders: [{ ...episode.laboratory!.orders[0], results: [{ ...analysis, satisfies_current_samples: false, has_published_result: false }] }] } });
beforeEach(() => { localStorage.setItem("token", "token-ficticio"); fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ...episode, status: "CLOSED" }) }) as Response); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

it("exige la revisión explícita del resultado anterior y envía su versión sin inventar seguimiento", async () => {
  render(<Harness />); fill(); submit(); expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText("Confirmo la revisión de este resultado anterior · Orden #1")); submit();
  await waitFor(() => expect(applied).toHaveBeenCalled());
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toContain("/episodes/22/discharge");
  expect(new Headers(init.headers).get("If-Match")).toBe('"clinical"');
  expect(new Headers(init.headers).get("Idempotency-Key")).toBeTruthy();
  expect(JSON.parse(String(init.body))).toEqual({ note: "Alta ficticia mixta", reason: "Revisión expresa ficticia", legacy_reviews: [{ task_id: 1, version: '"t1"' }] });
  expect(readSpecimenDraft({ username: "medico.demo", role: "DOCTOR" }, "/episodes/22/discharge").draft).toBeUndefined();
});

it("pendientes nuevos requieren motivo, fecha local 12h y comunicación futura declarada", async () => {
  render(<Harness value={pending()} />); fill();
  fireEvent.click(screen.getByLabelText("Confirmo la revisión de este resultado anterior · Orden #1"));
  submit(); expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Motivo del seguimiento"), { target: { value: "Seguimiento ficticio" } });
  fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2099-10-29" } });
  fireEvent.change(screen.getByLabelText("Hora (1–12)"), { target: { value: "9" } });
  fireEvent.change(screen.getByLabelText("AM/PM"), { target: { value: "AM" } });
  fireEvent.change(screen.getByLabelText("Cómo se informará al paciente"), { target: { value: "Comunicación ficticia al paciente" } });
  submit(); await waitFor(() => expect(applied).toHaveBeenCalled());
  expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).followup).toEqual({ reason: "Seguimiento ficticio", review_due_at: "2099-10-29T09:00:00-04:00", communication_plan: "Comunicación ficticia al paciente" });
});

it("otra versión del resultado pierde la casilla marcada y conserva el borrador para revisión", () => {
  const view = render(<Harness />); fill(); fireEvent.click(screen.getByLabelText("Confirmo la revisión de este resultado anterior · Orden #1"));
  view.rerender(<Harness value={{ ...episode, clinical_version: '"v2"', tasks: [{ ...episode.tasks[0], version: '"t2"', result: "Resultado rectificado ficticio" }] }} />);
  expect(screen.getByLabelText("Confirmo la revisión de este resultado anterior · Orden #1")).not.toBeChecked();
  expect(screen.getByLabelText("Nota de alta")).toHaveValue("Alta ficticia mixta");
  expect(screen.getByRole("button", { name: "Cerrar episodio · Alta médica" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "He revisado los cambios; usar versión actual" }));
  submit(); expect(fetchMock).not.toHaveBeenCalled();
});

it.each(["PENDING", "COMPLETED"])("ordén anterior %s sin resultado válido impide cerrar", status => {
  render(<Harness value={{ ...episode, tasks: [{ ...episode.tasks[0], status, result: null }] }} />);
  expect(screen.getByRole("button", { name: "Cerrar episodio · Alta médica" })).toBeDisabled();
});
it("otro médico no confirma las revisiones anteriores ni asume los pendientes", () => {
  render(<Harness username="otro.medico" />);
  expect(screen.getByRole("button", { name: "Cerrar episodio · Alta médica" })).toBeDisabled();
});
it("con reevaluaciones pendientes conserva el bloqueo previo", () => {
  render(<Harness value={{ ...episode, reevaluations: [{ status: "PENDING" }] as Episode["reevaluations"] }} />);
  expect(screen.getByRole("button", { name: "Cerrar episodio · Alta médica" })).toBeDisabled();
});
it("recupera nota y casilla de la misma versión sin hacer otro envío", () => {
  const view = render(<Harness />); fill(); fireEvent.click(screen.getByLabelText("Confirmo la revisión de este resultado anterior · Orden #1")); view.unmount();
  render(<Harness />);
  expect(screen.getByLabelText("Nota de alta")).toHaveValue("Alta ficticia mixta");
  expect(screen.getByLabelText("Confirmo la revisión de este resultado anterior · Orden #1")).toBeChecked();
  expect(fetchMock).not.toHaveBeenCalled();
});
it("la misma orden sin integración estructurada conserva el alta anterior", () => {
  render(<Harness value={{ ...episode, laboratory: { legacy_order_ids: [1], orders: [] } }} />);
  expect(screen.queryByRole("heading", { name: "Alta con seguimiento de laboratorio" })).not.toBeInTheDocument();
});
