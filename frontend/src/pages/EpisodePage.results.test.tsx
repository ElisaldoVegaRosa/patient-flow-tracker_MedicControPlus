import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import EpisodePage from "./EpisodePage";
import { establishSession } from "../api/client";
import type { Episode, LaboratoryAnalysisDetail } from "../types/clinical";

const stamp = "2026-10-01T12:00:00Z";
const version = { id: 41, sequence: 1, action: "PUBLISH", result: "Resultado ficticio", published_at: stamp, review: null };
const analysis: LaboratoryAnalysisDetail = { id: 5, title: "Analítica ficticia", version: '"analysis"', cancelled_at: null, cancellation_reason: null,
  medical_owner: { username: "medico.demo", role: "DOCTOR", active: 1 }, required_specimens: [{ id: 1, received_at: stamp, suitability: "ACCEPTED" }],
  has_published_result: true, needs_medical_review: true, satisfies_current_samples: true, current_version: version, versions: [version] };
const base: Episode = { id: 22, name: "Paciente ficticio", birth_date: "1990-01-01", document: "TEST-RESULT",
  qr_token: "qr-ficticio", status: "ACTIVE", priority: 3, location: "Observación", started_at: stamp,
  clinical_version: '"clinical"', tasks: [], alerts: [], vitals: [], events: [],
  laboratory: { orders: [{ task_id: 3, task_status: "PENDING", specimens: [], results: [analysis] }] } };
afterEach(() => vi.unstubAllGlobals());
function show(episode = base, username = "medico.demo") {
  establishSession("token-ficticio");
  const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => ({ ok: true, status: 200, json: async () => init?.method === "POST" ? episode : episode }) as Response);
  vi.stubGlobal("fetch", fetchMock); const update = vi.fn();
  const view = render(<EpisodePage episode={episode} user={{ username, role: "DOCTOR", access_token: "token-ficticio" }} updateEpisode={update} showError={vi.fn()} />);
  return { ...view, fetchMock, update };
}
function review() { const summary = screen.getByText("Confirmar revisión médica", { selector: "summary" }); fireEvent.click(summary); return within(summary.closest("details")!); }

it("revisa desde el episodio con versión de analítica y sin publicar otro resultado", async () => {
  const { fetchMock, update } = show(); const f = review();
  fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Revisión ficticia" } });
  fireEvent.click(f.getByRole("button", { name: "Confirmar revisión médica" }));
  await waitFor(() => expect(update).toHaveBeenCalled());
  expect(String(fetchMock.mock.calls[0][0])).toContain("/lab/results/41/review");
  expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("If-Match")).toBe('"analysis"');
  expect(screen.queryByText("Publicar resultado de esta analítica", { selector: "summary" })).not.toBeInTheDocument();
});

it.each([false, true])("cerrado exige ciclo y alcance vigentes para revisar: %s", current => {
  show({ ...base, status: "CLOSED", lab_followups: [{ current_cycle: current, scope: [{ analysis_id: 5 }] }] });
  const button = review().getByRole("button", { name: "Confirmar revisión médica" });
  if (current) expect(button).toBeEnabled(); else expect(button).toBeDisabled();
});

it("al cambiar responsable no conserva la capacidad de revisar del anterior", () => {
  const view = show(); const f = review();
  fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Borrador de revisión" } });
  const changed = { ...base, laboratory: { orders: [{ ...base.laboratory!.orders[0], results: [{ ...analysis, version: '"v2"', medical_owner: { username: "medico.otro", role: "DOCTOR", active: 1 } }] }] } };
  view.rerender(<EpisodePage episode={changed} user={{ username: "medico.demo", role: "DOCTOR", access_token: "token-ficticio" }} updateEpisode={view.update} showError={vi.fn()} />);
  expect(screen.queryByText("Confirmar revisión médica", { selector: "summary" })).not.toBeInTheDocument();
  expect(screen.getByText(/La revisión corresponde al médico responsable/)).toBeVisible();
});

it.each([false, true])("reactivar tras el alta exige un plan de seguimiento vigente: %s", planned => {
  const cancelled = { ...analysis, cancelled_at: stamp, cancellation_reason: "Cancelación ficticia", has_published_result: false,
    needs_medical_review: false, satisfies_current_samples: false, current_version: null, versions: [] };
  show({ ...base, status: "CLOSED", laboratory: { orders: [{ ...base.laboratory!.orders[0], results: [cancelled] }] },
    lab_followups: [{ current_cycle: true, scope: [{ analysis_id: 5 }], review_due_at: planned ? stamp : null }] });
  const summary = screen.getByText("Reactivar analítica cancelada", { selector: "summary" }); fireEvent.click(summary);
  const button = within(summary.closest("details")!).getByRole("button", { name: "Reactivar analítica cancelada" });
  if (planned) expect(button).toBeEnabled(); else expect(button).toBeDisabled();
});

it("el médico consulta la procedencia de nuevas muestras desde el episodio", () => {
  show({ ...base, laboratory: { orders: [{ ...base.laboratory!.orders[0], repeats: [{ id: 1, analysis_id: 5,
    previous_specimen_id: 1, new_specimen_id: 2, requested_at: stamp, requested_by_username: "lab.demo", reason: "Repetición ficticia" }] }] } });
  fireEvent.click(screen.getByText("Historial de nuevas muestras (1)", { selector: "summary" }));
  expect(screen.getByText("Muestra anterior #1 · Nueva muestra #2")).toBeVisible();
  expect(screen.getByText("Motivo: Repetición ficticia")).toBeVisible();
});
