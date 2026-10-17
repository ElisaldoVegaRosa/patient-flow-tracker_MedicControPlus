import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { Episode, LaboratoryQueue } from "./types/clinical";

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

const episode: Episode = {
  id: 91, name: "Paciente ficticio laboratorio", birth_date: "1990-01-01", document: "TEST-LAB",
  qr_token: "qr-lab", status: "ACTIVE", priority: 2, location: "Observación",
  started_at: "2026-10-07T12:00:00Z", vitals: [], alerts: [], events: [],
  tasks: [{ id: 71, episode_id: 91, title: "Hemograma", service: "LAB", status: "PENDING", result: null, version: '"lab-original"' }],
};

describe("Bandeja de laboratorio", () => {
  beforeEach(() => localStorage.setItem("token", "token-de-prueba"));
  afterEach(() => vi.unstubAllGlobals());

  async function setup(role = "LAB", initial = populated, reject = false, withEpisode = false) {
    const queue = vi.fn().mockResolvedValue(initial);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      let data: unknown;
      if (url.pathname === "/auth/me") data = { username: "demo", role };
      else if (url.pathname === "/dashboard") {
        data = { active: withEpisode ? 1 : 0, open_alerts: 0, patients: withEpisode ? [episode] : [], requested_by: "demo" };
      } else if (url.pathname === "/episodes/91") data = episode;
      else if (url.pathname === "/lab/orders") {
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

  it("desde el episodio abre el formulario y solo publica el resultado escrito con su version", async () => {
    const queueData = { ...populated, orders: populated.orders.map(order => ({ ...order, version: '"lab-original"' })) };
    const { user, fetchMock } = await setup("LAB", queueData, false, true);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    await user.click(await screen.findByRole("button", { name: "Registrar resultado en laboratorio" }));
    const field = await screen.findByRole("textbox", { name: "Resultado de laboratorio" });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(0);
    await user.type(field, "Resultado ficticio escrito desde la bandeja");
    await user.click(screen.getByRole("button", { name: "Publicar resultado y completar" }));
    expect(await screen.findByRole("heading", { name: "No hay órdenes en este filtro" })).toBeVisible();
    const patches = fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");
    expect(patches).toHaveLength(1);
    expect(JSON.parse(String(patches[0][1]?.body))).toEqual({ result: "Resultado ficticio escrito desde la bandeja" });
    expect(new Headers(patches[0][1]?.headers).get("If-Match")).toBe('"lab-original"');
  });

  it("supervisor puede consultar desde el episodio sin formulario ni publicacion", async () => {
    const { user, fetchMock } = await setup("SUPERVISOR", populated, false, true);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    await user.click(await screen.findByRole("button", { name: "Consultar laboratorio" }));
    expect(await screen.findByText("Consulta de laboratorio. Solo laboratorio puede publicar resultados.")).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Resultado de laboratorio" })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(0);
  });

  it("si el episodio se cierra antes de abrir la bandeja conserva consulta sin publicar", async () => {
    const closed = { ...populated, orders: populated.orders.map(order => ({ ...order, episode_status: "CLOSED" })) };
    const { user, fetchMock } = await setup("LAB", closed, false, true);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    await user.click(await screen.findByRole("button", { name: "Registrar resultado en laboratorio" }));
    expect(await screen.findByText(/El episodio está cerrado. Esta orden pendiente/)).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Resultado de laboratorio" })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(0);
  });

  it.each(["LAB", "SUPERVISOR"])("permite abrir y actualizar la bandeja vacía para %s", async (role) => {
    const { user, queue } = await setup(role, empty);
    await user.click(screen.getByRole("button", { name: "Bandeja de laboratorio" }));
    expect(await screen.findByRole("heading", { name: "No hay órdenes en este filtro" })).toBeVisible();
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
    expect(await screen.findByRole("heading", { name: "No hay órdenes en este filtro" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Texto local conservado" })).not.toBeInTheDocument();
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

// Isolate existing clinical flows; presence composition has its own integration tests.
vi.mock("./components/EpisodePresence", () => ({ default: () => null }));
