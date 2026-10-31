import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import { establishSession } from "./api/client";

const response = (value: unknown) => ({ ok: true, status: 200, json: async () => value }) as Response;
afterEach(() => vi.unstubAllGlobals());
it.each([["RECEPTION", false, true], ["DOCTOR", false, true], ["NURSE", true, true], ["NURSE", false, false]])(
  "integra contacto para %s y coordinacion %s", async (role, can_coordinate, visible) => {
    establishSession("token-ficticio");
    const mock = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (path === "/auth/me") return response({ username: "profesional.ficticio", role, can_coordinate });
      if (path === "/dashboard") return response({ active: 0, open_alerts: 0, patients: [] });
      if (path === "/communications") return response({ enabled: false, items: [], total: 0, has_more: false });
      throw new Error(`Ruta inesperada ${path}`);
    });
    vi.stubGlobal("fetch", mock); render(<App />);
    await screen.findByRole("heading", { name: "Centro de control" });
    if (visible) {
      fireEvent.click(screen.getByRole("button", { name: "Contacto tras el alta" }));
      await screen.findByRole("heading", { name: "Contacto tras el alta" });
      await screen.findByText(/todavía no habilitado/);
    } else expect(screen.queryByRole("button", { name: "Contacto tras el alta" })).not.toBeInTheDocument();
  });
