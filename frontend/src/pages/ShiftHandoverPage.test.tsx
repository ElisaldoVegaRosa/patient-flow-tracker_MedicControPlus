import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ShiftHandoverPage from "./ShiftHandoverPage";
import { usePendingOperations } from "../hooks/usePendingOperations";
import { establishSession } from "../api/client";
import type { HandoverData, User } from "../types/clinical";
const user: User = { username: "medico.demo", role: "DOCTOR", access_token: "demo" };
const patient: HandoverData["patients"][number] = { episode_id: 22, name: "Paciente ficticio", priority: 3,
  identity_status: "PROVISIONAL", location: "Espera", area_id: 1, area_name: "Consulta",
  owners: [{ discipline: "DOCTOR", username: "anterior", display_name: "Médico anterior", active: 1,
    proposed_username: user.username, proposed_name: "Médico receptor" }],
  tasks: { MEDICAL: 1, NURSING: 2 }, reevaluations: [], open_alerts: 3, legacy_lab_orders: 1, lab_results: 2, lab_reviews: 1 };
const model: HandoverData = { generated_at: "2026-11-04T12:00:00+00:00", requested_by: user.username,
  patients: [patient, { ...patient, episode_id: 23, name: "Otro paciente", owners: [] }] };
const open = vi.fn();
function Harness({ person = user }: { person?: User }) {
  return <ShiftHandoverPage user={person} operations={usePendingOperations()} onOpenEpisode={open} />;
}
afterEach(() => { vi.unstubAllGlobals(); open.mockReset(); });
function setup() {
  establishSession("demo");
  const fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => structuredClone(model) }) as Response);
  vi.stubGlobal("fetch", fetch); return fetch;
}
it("incluye relevo entrante conservando responsable, separa contadores y abre episodio por lectura", async () => {
  const fetch = setup(); render(<Harness />);
  const title = await screen.findByRole("heading", { name: /EP-22/ });
  expect(screen.queryByRole("heading", { name: /EP-23/ })).not.toBeInTheDocument();
  expect(screen.getByText(/continúa el responsable anterior/)).toBeVisible();
  expect(screen.getByText(/1 órdenes anteriores pendientes · 2 analíticas/)).toBeVisible();
  fireEvent.click(within(title.closest("article")!).getByRole("button", { name: "Abrir episodio EP-22" }));
  expect(open).toHaveBeenCalledWith(22);
  expect(fetch.mock.calls.every(call => !((call as unknown as [string, RequestInit])[1]?.method))).toBe(true);
});
it("conserva búsqueda y área tras actualizar, permite consultar cola compartida", async () => {
  const fetch = setup(); render(<Harness />); await screen.findByRole("heading", { name: /EP-22/ });
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByRole("heading", { name: /EP-23/ })).toBeVisible();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "EP-22" } });
  fireEvent.change(screen.getByLabelText("Área"), { target: { value: "Consulta" } });
  fireEvent.click(screen.getByRole("button", { name: "Actualizar resumen" }));
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("searchbox")).toHaveValue("EP-22");
  expect(screen.queryByRole("heading", { name: /EP-23/ })).not.toBeInTheDocument();
});
it("impide consultas de administrador de cuentas", () => {
  const fetch = setup(); render(<Harness person={{ ...user, role: "ACCOUNT_ADMIN" }} />);
  expect(screen.getByRole("alert")).toBeVisible(); expect(fetch).not.toHaveBeenCalled();
});
