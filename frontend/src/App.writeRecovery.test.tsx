import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import { establishSession } from "./api/client";
import { WRITE_REFERENCE_PREFIX, WriteReferences, writeReferenceOwner } from "./session/writeReferences";
import type { Episode } from "./types/clinical";
const identity = { username: "qa58", role: "DOCTOR" };
const key = "recovered-evaluation-0058";
const episode: Episode = { id: 42, name: "Paciente ficticio 58", document: "QA-58", birth_date: "1990-01-01", qr_token: "qr58", status: "ACTIVE", priority: 3, location: "Observación", started_at: "2026-10-12T12:00:00Z", alerts: [], tasks: [], vitals: [], events: [], clinical_version: '"version58"' };
afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function setup(confirmedInitially = false) {
  establishSession("qa58-token");
  const owner = await writeReferenceOwner("http://localhost:8000", identity);
  new WriteReferences(localStorage).remember({ owner, key, kind: "evaluation", createdAt: Date.now(), reviewed: false });
  let confirmed = confirmedInitially;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const data: Record<string, unknown> = { "/auth/me": identity, "/dashboard": { active: 1, open_alerts: 0, patients: [episode], requested_by: identity.username }, "/episodes/42": episode, "/write-result": confirmed ? { status: "confirmed", result: episode } : { status: "unknown" } };
    if (options?.method === "POST") return { ok: true, status: 200, json: async () => episode } as Response;
    if (!(path in data)) throw new Error(`Unexpected ${path}`);
    return { ok: true, status: 200, json: async () => data[path] } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  return { fetchMock, confirm: () => { confirmed = true; } };
}
it("restaura la sesión, consulta su recibo por GET y no recrea la evaluación", async () => {
  const { fetchMock } = await setup(true);
  await screen.findByText(/El servidor confirmó un envío anterior/);
  expect(localStorage.getItem(WRITE_REFERENCE_PREFIX + key)).toBeNull();
  expect(fetchMock.mock.calls.every(([, options]) => !options?.method || options.method === "GET")).toBe(true);
});
it("confirmar un recibo recuperado conserva formularios nuevos y permite una operación nueva explícita", async () => {
  const { fetchMock, confirm } = await setup();
  await screen.findByText(/Sin confirmación/);
  fireEvent.click(await screen.findByRole("button", { name: "Abrir" }));
  await screen.findByRole("heading", { name: episode.name });
  fireEvent.change(screen.getByLabelText("Diagnóstico o impresión clínica"), { target: { value: "Diagnóstico actual" } });
  fireEvent.change(screen.getByLabelText("Nota de evaluación"), { target: { value: "Contenido actual" } });
  fireEvent.change(screen.getByLabelText("Nota de alta"), { target: { value: "Alta local sin enviar" } });
  confirm();
  await act(async () => fireEvent.click(screen.getByText("Consultar resultado anterior")));
  await screen.findByText(/El servidor confirmó un envío anterior/);
  expect(screen.getByLabelText("Diagnóstico o impresión clínica")).toHaveValue("Diagnóstico actual");
  expect(screen.getByLabelText("Nota de alta")).toHaveValue("Alta local sin enviar");
  expect(fetchMock.mock.calls.every(([, options]) => !options?.method || options.method === "GET")).toBe(true);
  fireEvent.submit(screen.getByRole("button", { name: "Guardar evaluación médica" }).closest("form")!);
  await waitFor(() => expect(fetchMock.mock.calls.some(([, options]) => options?.method === "POST")).toBe(true));
  const write = fetchMock.mock.calls.find(([, options]) => options?.method === "POST")!;
  expect(new Headers(write[1]?.headers).get("Idempotency-Key")).not.toBe(key);
  expect(JSON.parse(String(write[1]?.body)).diagnosis).toBe("Diagnóstico actual");
});
