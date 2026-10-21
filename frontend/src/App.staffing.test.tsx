import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import { establishSession, invalidateSession } from "./api/client";

afterEach(() => { invalidateSession(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it.each([true, false])("restores coordination=%s and guards select-only edits on navigation", async coordinate => {
  establishSession("staff-route-test");
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname;
    const routes: Record<string, unknown> = {
      "/auth/me": { username: "medico.uno", role: "DOCTOR", can_coordinate: coordinate },
      "/dashboard": { active: 0, open_alerts: 0, patients: [], requested_by: "medico.uno" },
      "/staff/planning": { areas: [{ id: 1, name: "Consulta", active: 1, version: '"a"' }], shifts: [], assignments: [], professionals: [], coordinators: [], changes: [], requested_by: "medico.uno" },
      "/staff/mine": { assignments: [], requested_by: "medico.uno" },
    };
    if (!(path in routes)) throw new Error(`Unexpected ${path}`);
    return { ok: true, status: 200, json: async () => routes[path] } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: coordinate ? "Personal y turnos" : "Mi turno" }));
  await screen.findByText("No hay planificación registrada.");
  if (coordinate) {
    screen.getByText("Consulta · Activa").closest("details")!.open = true;
    fireEvent.change(screen.getByLabelText("Estado del área"), { target: { value: "false" } });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Centro de control" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Personal, áreas y turnos" })).toBeInTheDocument();
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  }
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith(coordinate ? "/staff/planning" : "/staff/mine"))).toBe(true);
});
