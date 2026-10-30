import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import { establishSession } from "./api/client";

const response = (value: unknown) => ({ ok: true, status: 200, json: async () => value }) as Response;
afterEach(() => vi.unstubAllGlobals());
it.each([
  ["SUPERVISOR", false, true], ["NURSE", true, true], ["DOCTOR", false, false],
])("integra el acceso de %s con coordinacion %s", async (role, can_coordinate, visible) => {
  establishSession("token-ficticio");
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname;
    if (path === "/auth/me") return response({ username: "profesional.ficticio", display_name: "Profesional ficticio", role, can_coordinate });
    if (path === "/dashboard") return response({ active: 0, open_alerts: 0, patients: [], requested_by: "profesional.ficticio" });
    if (path === "/operations/delays") return response({ generated_at: "2026-10-29T13:00:00+00:00", requested_by: "profesional.ficticio", patients: [] });
    throw new Error(`Ruta inesperada ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock); render(<App />);
  await screen.findByText("Profesional ficticio (profesional.ficticio)");
  await screen.findByRole("heading", { name: "Centro de control" });
  if (visible) {
    fireEvent.click(screen.getByRole("button", { name: "Esperas y demoras" }));
    await screen.findByRole("heading", { name: "Esperas y demoras por etapa" });
    await screen.findByText(/No hay episodios activos que coincidan/);
    expect(fetchMock.mock.calls.some(([input]) => new URL(String(input)).pathname === "/operations/delays")).toBe(true);
  } else expect(screen.queryByRole("button", { name: "Esperas y demoras" })).not.toBeInTheDocument();
});
