import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { SupervisorData, SupervisorPatient } from "./types/clinical";

function patient(id: number, priority: number, atRisk: boolean, alerts: number): SupervisorPatient {
  return {
    id, priority, at_risk: atRisk, open_alert_count: alerts,
    name: `Paciente ficticio ${id}`, document: `QA-SUP-${id}`,
    birth_date: "1990-01-15", qr_token: `qr-demo-${id}`, status: "ACTIVE",
    location: "Observación", started_at: "2026-10-07T12:00:00Z",
    vitals: [], alerts: [], tasks: [], events: [],
    waiting_minutes: 12, pending_task_count: 1,
  };
}
const data: SupervisorData = {
  metrics: { active_patients: 3, high_priority_patients: 1, patients_at_risk: 1,
    open_alerts: 2, pending_tasks: 3 },
  rules: { evaluated_episodes: 3, generated_alerts: 0 },
  patients: [patient(81, 1, false, 0), patient(82, 3, true, 0), patient(83, 4, false, 2)],
  generated_at: "2026-10-07T12:00:00Z", requested_by: "supervisor",
};

describe("Centro de control del supervisor", () => {
  beforeEach(() => localStorage.setItem("token", "token-de-prueba"));
  afterEach(() => vi.unstubAllGlobals());

  async function setup(role = "SUPERVISOR") {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (init?.method && init.method !== "GET") throw new Error("Mutación inesperada");
      let response: unknown;
      if (path === "/auth/me") response = { username: "demo", role };
      else if (path === "/dashboard") response = {
        active: 0, open_alerts: 0, patients: [], requested_by: "demo",
      };
      else if (path === "/supervisor/dashboard") response = data;
      else if (path === "/episodes/82") response = data.patients[1];
      else throw new Error(`Petición inesperada: ${path}`);
      return { ok: true, status: 200, json: async () => response } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "Centro de control" });
    return { user, fetchMock };
  }

  it("conserva indicadores, filtros y apertura del episodio seleccionado", async () => {
    const { user, fetchMock } = await setup();
    await user.click(screen.getByRole("button", { name: "Panel de supervisor" }));
    await screen.findByRole("heading", { name: "Centro de control del supervisor" });
    expect(screen.getAllByRole("article").map((card) => card.querySelector("strong")?.textContent?.trim()))
      .toEqual(["3", "1", "1", "2", "3"]);
    const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows()).toHaveLength(3);
    const beforeFilters = fetchMock.mock.calls.length;
    for (const [filter, id] of [["En riesgo", 82], ["P1–P2", 81], ["Con alertas", 83]] as const) {
      const button = screen.getByRole("button", { name: filter });
      await user.click(button);
      expect(button).toHaveClass("active-filter");
      expect(rows()).toHaveLength(1);
      expect(within(rows()[0]).getByText(`Paciente ficticio ${id}`)).toBeVisible();
    }
    await user.click(screen.getByRole("button", { name: "Todos" }));
    expect(rows()).toHaveLength(3);
    expect(fetchMock.mock.calls).toHaveLength(beforeFilters);
    const row = screen.getByRole("row", { name: /Paciente ficticio 82/ });
    expect(within(row).getByText("12 min")).toBeVisible();
    expect(within(row).getByText("REQUIERE ATENCIÓN")).toBeVisible();
    await user.click(within(row).getByRole("button", { name: "Abrir" }));
    expect(await screen.findByRole("heading", { name: "Paciente ficticio 82" })).toBeVisible();
    expect(fetchMock.mock.calls.slice(beforeFilters)).toEqual([
      ["http://localhost:8000/episodes/82", expect.any(Object)],
    ]);
  });

  it("Actualizar indicadores consulta y restablece el filtro Todos sin evaluar reglas", async () => {
    const { user, fetchMock } = await setup();
    await user.click(screen.getByRole("button", { name: "Panel de supervisor" }));
    await screen.findByRole("heading", { name: "Centro de control del supervisor" });
    await user.click(screen.getByRole("button", { name: "En riesgo" }));
    const before = fetchMock.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Actualizar indicadores" }));
    expect(await screen.findByRole("row", { name: /Paciente ficticio 81/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Todos" })).toHaveClass("active-filter");
    expect(fetchMock.mock.calls.slice(before)).toEqual([
      ["http://localhost:8000/supervisor/dashboard", expect.any(Object)],
    ]);
  });

  it.each(["RECEPTION", "NURSE", "DOCTOR", "LAB"])("conserva la ausencia de acceso para %s", async (role) => {
    const { fetchMock } = await setup(role);
    expect(screen.queryByRole("button", { name: "Panel de supervisor" })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/supervisor/"))).toBe(false);
  });
});
