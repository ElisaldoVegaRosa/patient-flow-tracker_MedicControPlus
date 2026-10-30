import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import { establishSession } from "./api/client";
import { readSpecimenDraft } from "./session/specimenDrafts";
import type { LaboratoryOrder } from "./types/clinical";

afterEach(() => vi.unstubAllGlobals());
const response = (data: unknown) => ({ ok: true, status: 200, json: async () => data }) as Response;
function setup() {
  establishSession("token-ficticio");
  const order: LaboratoryOrder = { id: 3, episode_id: 22, title: "Orden ficticia", service: "LAB", status: "PENDING", result: null,
    created_at: "2026-10-01T12:00:00Z", patient_name: "Paciente ficticio", priority: 3, location: "Observación", episode_status: "ACTIVE", workflow: "STRUCTURED",
    laboratory: { status: "PENDING", processing_context: "ACTIVE", published_results: 0, pending_results: 1, pending_reviews: 0, cancelled_analyses: 0, specimens: [],
      analyses: [{ id: 5, title: "Analítica ficticia", version: '"analysis"', reviewer_username: "medico.demo", cancelled_at: null, cancellation_reason: null,
        has_result: false, current_result: null, result_annulled: false, result_sequence: null, needs_medical_review: false, reviewed_at: null,
        satisfies_current_samples: false, required_specimens: [{ id: 1, received_at: "2026-10-01T12:00:00Z", suitability: "ACCEPTED" }], versions: [] }] } };
  let done = false;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/me") return response({ username: "lab.demo", role: "LAB" });
    if (url.pathname === "/dashboard") return response({ active: 0, open_alerts: 0, patients: [], requested_by: "lab.demo" });
    if (url.pathname === "/lab/sample-professionals") return response({ professionals: [] });
    if (url.pathname === "/lab/orders") return response({ status_filter: url.searchParams.get("status") ?? "PENDING", total: done ? 0 : 1, orders: done ? [] : [order], requested_by: "lab.demo" });
    if (url.pathname === "/lab/analyses/5/results" && init?.method === "POST") { done = true; return response({ id: 22, status: "ACTIVE", tasks: [], events: [], vitals: [], alerts: [] }); }
    throw new Error(`Ruta inesperada ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetchMock); render(<App />); return fetchMock;
}
async function open() {
  const user = userEvent.setup(); await screen.findByRole("heading", { name: "Centro de control" });
  await user.click(screen.getByRole("button", { name: "Bandeja de laboratorio" }));
  fireEvent.click(await screen.findByText("Ver analíticas (1)", { selector: "summary" }));
  const summary = screen.getByText("Publicar resultado de esta analítica", { selector: "summary" }); fireEvent.click(summary);
  const f = within(summary.closest("details")!);
  fireEvent.change(f.getByLabelText("Resultado de la analítica"), { target: { value: "Resultado original ficticio" } });
  fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Publicación ficticia" } });
  fireEvent.change(f.getByLabelText("Muestras fuente del resultado"), { target: { value: "1" } });
  return f;
}

it("publica desde bandeja con versión de analítica, confirma y actualiza el filtro", async () => {
  const fetchMock = setup(); const f = await open();
  fireEvent.click(f.getByRole("button", { name: "Publicar resultado de esta analítica" }));
  await screen.findByText("Registro de resultado confirmado por el servidor.");
  await screen.findByRole("heading", { name: "No hay órdenes en este filtro" });
  const calls = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
  expect(calls).toHaveLength(1);
  expect(new Headers(calls[0][1]?.headers).get("If-Match")).toBe('"analysis"');
  expect(readSpecimenDraft({ username: "lab.demo", role: "LAB" }, "/lab/analyses/5/results").draft).toBeUndefined();
});

it("reintenta la publicación original y conserva un texto escrito después del error", async () => {
  const fetchMock = setup(); const f = await open();
  fetchMock.mockRejectedValueOnce(new Error("Fallo ficticio de conexión"));
  fireEvent.click(f.getByRole("button", { name: "Publicar resultado de esta analítica" }));
  await screen.findByRole("heading", { name: "Analítica #5 · Publicar resultado" });
  fireEvent.change(f.getByLabelText("Resultado de la analítica"), { target: { value: "Texto posterior conservado" } });
  fireEvent.click(screen.getByRole("button", { name: "Reintentar operación original" }));
  await screen.findByText("Registro de resultado confirmado por el servidor.");
  const calls = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(calls[0][1]?.body).toBe(calls[1][1]?.body);
  expect(new Headers(calls[0][1]?.headers).get("Idempotency-Key")).toBe(new Headers(calls[1][1]?.headers).get("Idempotency-Key"));
  expect(readSpecimenDraft({ username: "lab.demo", role: "LAB" }, "/lab/analyses/5/results").draft?.fields.result).toBe("Texto posterior conservado");
});
