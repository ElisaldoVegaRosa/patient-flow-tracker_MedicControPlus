import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import type { Episode, LaboratoryQueue } from "./types/clinical";

const order = { id: 71, episode_id: 91, title: "Hemograma ficticio", service: "LAB", status: "COMPLETED",
  result: "Resultado inicial ficticio", created_at: "2026-10-17T12:00:00Z", patient_name: "Paciente ficticio",
  priority: 3, location: "Observación", episode_status: "ACTIVE", version: '"version-original"' };
const empty: LaboratoryQueue = { status_filter: "PENDING", total: 0, orders: [], requested_by: "lab" };
const completed: LaboratoryQueue = { ...empty, status_filter: "COMPLETED", total: 1, orders: [order] };
const episode: Episode = { id: 91, name: "Paciente ficticio", birth_date: "1990-01-01", document: "TEST-LIFE",
  qr_token: "qr-life", status: "ACTIVE", priority: 3, location: "Observación", started_at: "2026-10-17T12:00:00Z",
  vitals: [], alerts: [], events: [], tasks: [{ ...order, version: '"version-nueva"', result: "Resultado corregido ficticio" }] };

afterEach(() => vi.unstubAllGlobals());

it("consulta completadas, corrige con versión y motivo, y conserva la orden visible", async () => {
  localStorage.setItem("token", "token-local");
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    let data: unknown;
    if (url.pathname === "/auth/me") data = { username: "laboratorio", role: "LAB" };
    else if (url.pathname === "/dashboard") data = { active: 0, open_alerts: 0, patients: [], requested_by: "laboratorio" };
    else if (url.pathname === "/lab/orders") data = url.searchParams.get("status") === "PENDING" ? empty : completed;
    else if (url.pathname === "/tasks/71/result" && init?.method === "PATCH") {
      completed.orders[0] = { ...order, result: "Resultado corregido ficticio", version: '"version-nueva"' };
      data = episode;
    } else throw new Error(`Ruta inesperada: ${url.pathname}`);
    return { ok: true, status: 200, json: async () => data } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "Centro de control" });
  await user.click(screen.getByRole("button", { name: "Bandeja de laboratorio" }));
  await user.selectOptions(screen.getByRole("combobox", { name: "Mostrar órdenes" }), "COMPLETED");
  expect(await screen.findByRole("heading", { name: "Completadas y anuladas" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "Órdenes ejecutables" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Pendientes de episodios cerrados" })).not.toBeInTheDocument();
  const card = within((await screen.findByRole("heading", { name: "Hemograma ficticio" })).closest("article")!);
  expect(card.getByText(/Resultado inicial ficticio/)).toBeVisible();
  expect(card.queryByRole("button", { name: /Publicar resultado/ })).not.toBeInTheDocument();
  await user.type(card.getByRole("textbox", { name: "Resultado corregido" }), "Resultado corregido ficticio");
  await user.type(card.getByRole("textbox", { name: "Motivo de la acción" }), "Error de transcripción");
  expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(false);
  await user.click(card.getByRole("button", { name: "Registrar corrección" }));
  await waitFor(() => expect(card.getByText(/Resultado corregido ficticio/)).toBeVisible());
  await waitFor(() => expect(window.dispatchEvent(new Event("beforeunload", { cancelable: true }))).toBe(true));
  const patch = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/tasks/71/result") && init?.method === "PATCH")!;
  expect(JSON.parse(String(patch[1]?.body))).toEqual({ action: "CORRECT", reason: "Error de transcripción", value: "Resultado corregido ficticio" });
  expect(new Headers(patch[1]?.headers).get("If-Match")).toBe('"version-original"');
  expect(new Headers(patch[1]?.headers).get("Idempotency-Key")).toBeTruthy();
});
