import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AppHeader from "./AppHeader";

describe("Cabecera por rol", () => {
  it.each([
    ["RECEPTION", ["Centro de control", "Escanear pulsera", "Historial de episodios", "Nuevo ingreso", "Salir"]],
    ["NURSE", ["Centro de control", "Escanear pulsera", "Salir"]],
    ["DOCTOR", ["Centro de control", "Escanear pulsera", "Historial de episodios", "Salir"]],
    ["LAB", ["Centro de control", "Escanear pulsera", "Bandeja de laboratorio", "Salir"]],
    ["SUPERVISOR", ["Centro de control", "Panel de supervisor", "Escanear pulsera", "Historial de episodios", "Bandeja de laboratorio", "Salir"]],
  ])("conserva botones, identidad y acciones para %s", async (role, buttons) => {
    const callbacks = {
      onDashboard: vi.fn(), onSupervisor: vi.fn().mockResolvedValue(undefined),
      onScan: vi.fn(), onHistory: vi.fn().mockResolvedValue(undefined),
      onLaboratory: vi.fn().mockResolvedValue(undefined), onNewEpisode: vi.fn(),
      onLogout: vi.fn().mockResolvedValue(undefined),
    };
    const actions = {
      "Centro de control": callbacks.onDashboard,
      "Panel de supervisor": callbacks.onSupervisor,
      "Escanear pulsera": callbacks.onScan,
      "Historial de episodios": callbacks.onHistory,
      "Bandeja de laboratorio": callbacks.onLaboratory,
      "Nuevo ingreso": callbacks.onNewEpisode,
      "Salir": callbacks.onLogout,
    };
    const user = userEvent.setup();
    render(<AppHeader user={{ username: "usuario-ficticio", role: String(role), access_token: "token-ficticio" }} {...callbacks} />);
    expect(screen.getByText("usuario-ficticio")).toBeVisible();
    expect(screen.getByText(String(role))).toBeVisible();
    expect(screen.getAllByRole("button").map((button) => button.textContent?.trim())).toEqual(buttons);
    for (const [label, callback] of Object.entries(actions)) {
      if (buttons.includes(label)) {
        await user.click(screen.getByRole("button", { name: label }));
        expect(callback).toHaveBeenCalledTimes(1);
      } else {
        expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
        expect(callback).not.toHaveBeenCalled();
      }
    }
  });
});
