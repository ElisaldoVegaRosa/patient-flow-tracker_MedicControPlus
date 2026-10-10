import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { DashboardData, Episode } from "./types/clinical";

function patient(id: number, priority: number): Episode {
  return {
    id, priority, name: `Paciente ficticio ${id}`, document: `QA-DASH-${id}`,
    birth_date: "1990-01-15", qr_token: `qr-demo-${id}`, status: "ACTIVE",
    location: "Observación", started_at: "2026-10-07T12:00:00Z",
    vitals: [], alerts: [], tasks: [], events: [],
  };
}

const patients = [patient(81, 1), patient(82, 2), patient(83, 3)];
patients[0].alerts = ["ACTIVE", "ACKNOWLEDGED", "ESCALATED", "RESOLVED"].map(
  (status, index) => ({
    id: index + 1, episode_id: 81, reason: `Alerta ${status}`, severity: "HIGH",
    status, responsible: null, created_at: "2026-10-07T12:00:00Z",
    updated_at: "2026-10-07T12:00:00Z",
  }),
);
patients[0].tasks = ["PENDING", "COMPLETED"].map((status, index) => ({
  id: index + 1, episode_id: 81, title: `Tarea ${status}`,
  service: "NURSING", status, result: null,
}));
patients[1].tasks = [{
  id: 3, episode_id: 82, title: "Otra tarea", service: "NURSING",
  status: "PENDING", result: null,
}];
const populated: DashboardData = {
  active: 3, open_alerts: 3, patients, requested_by: "recepcion",
};
const empty: DashboardData = {
  active: 0, open_alerts: 0, patients: [], requested_by: "recepcion",
};

describe("Centro de control general", () => {
  beforeEach(() => localStorage.setItem("token", "token-de-prueba"));
  afterEach(() => vi.unstubAllGlobals());

  async function openDashboard(initial: DashboardData) {
    const dashboardResponse = vi.fn().mockResolvedValue(initial);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (init?.method && init.method !== "GET") throw new Error("Mutación inesperada");
      let data: unknown;
      if (path === "/auth/me") data = { username: "recepcion", role: "RECEPTION" };
      else if (path === "/dashboard") data = await dashboardResponse();
      else if (path === "/episodes/81") data = patients[0];
      else throw new Error(`Petición inesperada: ${path}`);
      return { ok: true, status: 200, json: async () => data } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "Centro de control" });
    return { user, fetchMock, dashboardResponse };
  }

  it("conserva indicadores, tabla y apertura del episodio seleccionado", async () => {
    const { user, fetchMock } = await openDashboard(populated);
    const cards = screen.getAllByRole("article");
    expect(cards.map((card) => card.querySelector("strong")?.textContent?.trim()))
      .toEqual(["3", "3", "2", "2"]);
    ["Pacientes activos", "Alertas abiertas", "Alta prioridad", "Tareas pendientes"]
      .forEach((label, index) => expect(within(cards[index]).getByText(label)).toBeVisible());
    const row = screen.getByRole("row", { name: /Paciente ficticio 81/ });
    expect(within(row).getAllByRole("cell").slice(0, 4).map((cell) => cell.textContent))
      .toEqual(["Paciente ficticio 81EP-81", "P1", "Observación", "3"]);
    const beforeOpen = fetchMock.mock.calls.length;
    await user.click(within(row).getByRole("button", { name: "Abrir" }));
    expect(await screen.findByRole("heading", { name: "Paciente ficticio 81" })).toBeVisible();
    expect(fetchMock.mock.calls.slice(beforeOpen)).toEqual([
      ["http://localhost:8000/episodes/81", expect.any(Object)],
    ]);
  });

  it("muestra el estado vacío y Actualizar consulta y presenta los nuevos datos", async () => {
    const { user, fetchMock, dashboardResponse } = await openDashboard(empty);
    expect(screen.getByText("No hay pacientes activos.")).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    dashboardResponse.mockResolvedValueOnce(populated);
    const beforeRefresh = fetchMock.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Actualizar" }));
    expect(await screen.findByRole("row", { name: /Paciente ficticio 83/ })).toBeVisible();
    expect(screen.queryByText("No hay pacientes activos.")).not.toBeInTheDocument();
    expect(dashboardResponse).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.slice(beforeRefresh)).toEqual([
      ["http://localhost:8000/dashboard", expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token-de-prueba" }),
      })],
    ]);
    expect(screen.getAllByRole("article").map((card) => card.querySelector("strong")?.textContent?.trim()))
      .toEqual(["3", "3", "2", "2"]);
  });
});
