import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import LaboratoryFollowupPanel from "./LaboratoryFollowupPanel";
import { doctor, receiver, followup } from "../testFixtures/laboratoryFollowup";
import { usePendingOperations } from "../hooks/usePendingOperations";
import { establishSession } from "../api/client";
import { notifyOperationalConfirmation } from "../session/operationalWrites";
import type { Episode } from "../types/clinical";

const episode: Episode = { id: 22, name: "Paciente ficticio", birth_date: "1990-01-01", document: "DEMO-FOLLOWUP", qr_token: "qr-ficticio", status: "CLOSED",
  priority: 3, location: "Observación", started_at: "2026-10-28T12:00:00Z", tasks: [], events: [], alerts: [], vitals: [], lab_followups: [followup] };
const applied = vi.fn((path: string, _result: unknown, body?: BodyInit | null) => notifyOperationalConfirmation(path, body));
function Harness({ value = episode, role = "DOCTOR" }: { value?: Episode; role?: string }) {
  const operations = usePendingOperations();
  return <LaboratoryFollowupPanel episode={value} user={{ ...doctor, role }} operations={operations} onApplied={applied} onConflict={vi.fn()} />;
}
afterEach(() => vi.unstubAllGlobals());
it("el episodio cerrado permite al responsable actualizar su plan con versión propia", async () => {
  establishSession("token-ficticio");
  const fetchMock = vi.fn(async (url: RequestInfo | URL) => ({ ok: true, status: 200,
    json: async () => String(url).includes("followup-doctors") ? { doctors: [doctor, receiver] } : episode }) as Response);
  vi.stubGlobal("fetch", fetchMock); render(<Harness />);
  fireEvent.click(screen.getByText("Paciente ficticio · EP-22 · Seguimiento tras alta"));
  const summary = screen.getByText("Actualizar plan de seguimiento", { selector: "summary" }); fireEvent.click(summary);
  const f = within(summary.closest("details")!);
  fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Plan ficticio desde episodio" } });
  fireEvent.click(f.getByRole("button", { name: "Actualizar plan de seguimiento" }));
  await waitFor(() => expect(applied).toHaveBeenCalled());
});
it("un ciclo anterior conserva la consulta y bloquea los formularios", () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ doctors: [] }) }) as Response));
  render(<Harness value={{ ...episode, status: "ACTIVE", lab_followups: [{ ...followup, current_cycle: false, episode_status: "ACTIVE" }] }} />);
  fireEvent.click(screen.getByText("Paciente ficticio · EP-22 · Seguimiento tras alta"));
  fireEvent.click(screen.getByText("Actualizar plan de seguimiento", { selector: "summary" }));
  expect(screen.getByRole("button", { name: "Actualizar plan de seguimiento" })).toBeDisabled();
});
it("sin datos completos de seguimiento no inventa responsabilidad ni solicita catálogos", () => {
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  render(<Harness value={{ ...episode, lab_followups: [{ current_cycle: true, scope: [] }] }} />);
  expect(screen.queryByRole("heading", { name: "Seguimiento tras el alta" })).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});
