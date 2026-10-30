import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import EpisodePage from "./EpisodePage";
import { establishSession } from "../api/client";
import type { Episode } from "../types/clinical";

const base: Episode = { id: 22, name: "Paciente ficticio", birth_date: "1990-01-01", document: "TEST-SAMPLE",
  qr_token: "qr-ficticio", status: "ACTIVE", priority: 3, location: "Observación", started_at: "2026-10-01T12:00:00Z",
  clinical_version: '"clinical"', tasks: [], alerts: [], vitals: [], events: [],
  laboratory: { orders: [{ task_id: 3, task_status: "PENDING", specimens: [{
    id: 1, version: '"sample"', kind: "URINE", kind_description: null, collected_at: null, delivered_at: null, received_at: null,
    suitability: "UNKNOWN", assessed_at: null, analysis_ids: [4], historical_analysis_ids: [] }] }] },
};
afterEach(() => vi.unstubAllGlobals());
function show(episode = base, role = "NURSE") {
  establishSession("token-ficticio");
  const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => ({ ok: true, status: 200, json: async () => String(url).endsWith('/lab/sample-professionals') && init?.method !== 'POST' ? { professionals: [] } : episode }) as Response);
  vi.stubGlobal("fetch", fetchMock);
  const update = vi.fn();
  render(<EpisodePage episode={episode} user={{ username: "enfermera.demo", role, access_token: "token-ficticio" }} updateEpisode={update} showError={vi.fn()} />);
  return { fetchMock, update };
}
async function collection() {
  const action = await screen.findByText("Registrar obtención", { selector: "summary" });
  fireEvent.click(action.closest("section")!.querySelector("details > summary")!); fireEvent.click(action);
  return within(action.closest("details")!);
}
it("enfermería registra la muestra desde el episodio con su propia versión", async () => {
  const { fetchMock, update } = show(); const f = await collection();
  expect(screen.queryByText("Confirmar recepción", { selector: "summary" })).not.toBeInTheDocument();
  fireEvent.change(f.getByLabelText("Lugar de obtención"), { target: { value: "Observación" } });
  fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Toma ficticia" } });
  fireEvent.click(f.getByRole("button", { name: "Registrar obtención" }));
  await waitFor(() => expect(update).toHaveBeenCalled());
  const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST");
  expect(post).toBeTruthy();
  expect(new Headers((post![1] as RequestInit).headers).get("If-Match")).toBe('"sample"');
});
it.each([false, true])("el episodio cerrado exige seguimiento vigente de la misma analítica: %s", async current => {
  show({ ...base, status: "CLOSED", lab_followups: [{ current_cycle: current, scope: [{ analysis_id: 4 }] }] });
  const f = await collection();
  if (current) expect(f.getByRole("button", { name: "Registrar obtención" })).toBeEnabled();
  else expect(f.getByRole("button", { name: "Registrar obtención" })).toBeDisabled();
});
it("un seguimiento de otra analítica no permite registrar la muestra", async () => {
  show({ ...base, status: "CLOSED", lab_followups: [{ current_cycle: true, scope: [{ analysis_id: 999 }] }] });
  const f = await collection(); expect(f.getByRole("button", { name: "Registrar obtención" })).toBeDisabled();
});
it.each(["DOCTOR", "SUPERVISOR"])("%s no recibe formularios ni consulta de profesionales", role => {
  const { fetchMock } = show(base, role);
  expect(screen.queryByRole("heading", { name: "Registro de muestras" })).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});
