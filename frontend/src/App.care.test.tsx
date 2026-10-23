import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import { establishSession, invalidateSession } from "./api/client";

afterEach(() => { invalidateSession(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("opens the shared care queue from the clinical header", async () => {
  establishSession("care-route-test");
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname;
    const routes: Record<string, unknown> = {
      "/auth/me": { username: "medico.uno", role: "DOCTOR" },
      "/dashboard": { active: 0, open_alerts: 0, patients: [], requested_by: "medico.uno" },
      "/care/queue": { episodes: [], areas: [], requested_by: "medico.uno" },
    };
    if (!(path in routes)) throw new Error(`Unexpected ${path}`);
    return { ok: true, status: 200, json: async () => routes[path] } as Response;
  }));
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Colas y responsables" }));
  await screen.findByText("No hay episodios activos con triaje registrado.");
  expect(screen.getByRole("heading", { name: "Colas y responsables" })).toBeInTheDocument();
});
