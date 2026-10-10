import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { LaboratoryQueue } from "./types/clinical";

const empty: LaboratoryQueue = {
  total: 0, orders: [], status_filter: "PENDING", requested_by: "lab",
};
const populated: LaboratoryQueue = {
  ...empty, total: 1, orders: [{
    id: 71, episode_id: 91, title: "Hemograma", service: "LAB",
    status: "PENDING", result: null, created_at: "2026-10-07T12:00:00Z",
    patient_name: "Paciente ficticio laboratorio", priority: 2,
    location: "Observación", episode_status: "ACTIVE",
  }],
};

describe("Bandeja de laboratorio", () => {
  beforeEach(() => localStorage.setItem("token", "token-de-prueba"));
  afterEach(() => vi.unstubAllGlobals());

  async function setup(role = "LAB", initial = populated, reject = false) {
    const queue = vi.fn().mockResolvedValue(initial);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      let data: unknown;
      if (url.pathname === "/auth/me") data = { username: "demo", role };
      else if (url.pathname === "/dashboard") {
        data = { active: 0, open_alerts: 0, patients: [], requested_by: "demo" };
      } else if (url.pathname === "/lab/orders") {
        expect(url.search).toBe("?status=PENDING");
        data = await queue();
      } else if (url.pathname === "/tasks/71/complete" && init?.method === "PATCH") {
        if (reject) return {
          ok: false, status: 409, json: async () => ({ detail: "El episodio está cerrado" }),
        } as Response;
        queue.mockResolvedValue(empty);
        data = {};
      } else throw new Error(`Petición inesperada: ${url.pathname}`);
      return { ok: true, status: 200, json: async () => data } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "Centro de control" });
    return { user, queue, fetchMock };
  }

  it.each(["LAB", "SUPERVISOR"])("permite abrir y actualizar la bandeja vacía para %s", async (role) => {
    const { user, queue } = await setup(role, empty);
    await user.click(screen.getByRole("button", { name: "Bandeja de laboratorio" }));
    expect(await screen.findByRole("heading", { name: "No hay órdenes pendientes" })).toBeVisible();
    queue.mockResolvedValue(populated);
    await user.click(screen.getByRole("button", { name: "Actualizar bandeja" }));
    expect(await screen.findByRole("heading", { name: "Hemograma" })).toBeVisible();
    expect(queue).toHaveBeenCalledTimes(2);
  });

  it.each(["RECEPTION", "NURSE", "DOCTOR"])("conserva la ausencia de acceso para %s", async (role) => {
    const { queue } = await setup(role);
    expect(screen.queryByRole("button", { name: "Bandeja de laboratorio" })).not.toBeInTheDocument();
    expect(queue).not.toHaveBeenCalled();
  });

  it("presenta la orden y publica su resultado en el endpoint correcto", async () => {
    const { user, fetchMock } = await setup();
    await user.click(screen.getByRole("button", { name: "Bandeja de laboratorio" }));
    const title = await screen.findByRole("heading", { name: "Hemograma" });
    const card = within(title.closest("article")!);
    ["ORDEN #71", "Paciente ficticio laboratorio", "EP-91", "P2", "Observación", "PENDING"]
      .forEach((text) => expect(card.getByText(text)).toBeVisible());
    const result = card.getByRole("textbox", { name: "Resultado de laboratorio" });
    expect(result).toBeRequired();
    expect(result).toHaveAttribute("minlength", "3");
    await user.type(result, "Resultado simulado normal");
    await user.click(card.getByRole("button", { name: "Publicar resultado y completar" }));
    expect(await screen.findByRole("heading", { name: "No hay órdenes pendientes" })).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/tasks/71/complete", expect.objectContaining({
      method: "PATCH", body: JSON.stringify({ result: "Resultado simulado normal" }),
      headers: expect.objectContaining({ Authorization: "Bearer token-de-prueba" }),
    }));
  });

  it("conserva el formulario y resultado cuando la API rechaza la publicación", async () => {
    const { user, queue } = await setup("LAB", populated, true);
    await user.click(screen.getByRole("button", { name: "Bandeja de laboratorio" }));
    const result = await screen.findByRole("textbox", { name: "Resultado de laboratorio" });
    await user.type(result, "Resultado rechazado");
    await user.click(screen.getByRole("button", { name: "Publicar resultado y completar" }));
    expect(await screen.findByText(/El episodio está cerrado/)).toBeVisible();
    expect(result).toHaveValue("Resultado rechazado");
    expect(screen.getByRole("heading", { name: "Hemograma" })).toBeVisible();
    expect(queue).toHaveBeenCalledTimes(1);
  });
});
