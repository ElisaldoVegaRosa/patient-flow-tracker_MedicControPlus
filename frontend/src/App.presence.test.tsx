import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { establishSession, invalidateSession } from "./api/client";
import type { Episode } from "./types/clinical";

const initial: Episode = { id: 42, name: "Paciente presencia", birth_date: "1990-01-01", document: "QA-61", qr_token: "qa61", status: "ACTIVE", priority: 3, location: "Observación", assigned_to: "Equipo", started_at: "2026-10-12T10:00:00Z", vitals: [], alerts: [], tasks: [], events: [], triage_version: '"triage-original"', clinical_version: '"clinical-original"' };
beforeEach(() => { establishSession("presence-integration"); vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible"); });
afterEach(() => { invalidateSession(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function setup(role = "DOCTOR") {
  let episode = structuredClone(initial);
  const fetchMock = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    let data: unknown;
    if (path.includes("/presence/")) data = { active: episode.status === "ACTIVE", ttl_seconds: 45, members: [{ username: "colega", role: "NURSE", tabs: 1, sessions: 1, editing_tabs: 1 }] };
    else if (path === "/auth/me") data = { username: "qa61", role };
    else if (path === "/dashboard") data = { active: 1, open_alerts: 0, patients: [episode], requested_by: "qa61" };
    else if (path === "/episodes/42") data = episode;
    else if (path === "/episodes/42/triage" && options?.method === "POST") return { ok: false, status: 409, json: async () => ({ detail: { code: "version_conflict", message: "Cambios de otra sesión" } }) } as Response;
    else throw new Error(`Unexpected ${path}`);
    return { ok: true, status: 200, json: async () => data } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Abrir" }));
  await screen.findByRole("region", { name: "Presencia en el episodio" });
  await screen.findByText(/colega · NURSE/);
  return { fetchMock, close: () => { episode = { ...episode, status: "CLOSED", closed_at: initial.started_at }; } };
}
it("integra presencia con cambios locales y conserva el control de versiones al guardar", async () => {
  const { fetchMock } = await setup("NURSE");
  fireEvent.change(screen.getByLabelText("Personal responsable"), { target: { value: "Texto local" } });
  await waitFor(() => expect(fetchMock.mock.calls.some(([path, options]) => String(path).includes("/presence/") && options?.method === "PUT" && JSON.parse(String(options.body)).mode === "EDIT")).toBe(true));
  fireEvent.submit(screen.getByRole("button", { name: "Guardar triaje y asignación" }).closest("form")!);
  await screen.findAllByText(/Cambios de otra sesión/);
  expect(screen.getByLabelText("Personal responsable")).toHaveValue("Texto local");
  const clinical = fetchMock.mock.calls.find(([path]) => String(path).endsWith("/triage"))!;
  expect(new Headers(clinical[1]?.headers).has("Idempotency-Key")).toBe(true);
  expect(new Headers(clinical[1]?.headers).get("If-Match")).toBe(initial.triage_version);
  const leases = fetchMock.mock.calls.filter(([path, options]) => String(path).includes("/presence/") && options?.method === "PUT");
  expect(leases.every(([, options]) => !String(options?.body).includes("Texto local") && !new Headers(options?.headers).has("Idempotency-Key"))).toBe(true);
});
it("al cerrar el episodio remoto retira presencia y conserva el texto pendiente", async () => {
  const { fetchMock, close } = await setup();
  fireEvent.change(screen.getByLabelText("Diagnóstico o impresión clínica"), { target: { value: "Pendiente local" } });
  close();
  await act(async () => window.dispatchEvent(new Event("focus")));
  await screen.findByText("Episodio EP-42 · CLOSED");
  expect(screen.queryByRole("region", { name: "Presencia en el episodio" })).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Texto local conservado" })).toHaveTextContent("Pendiente local");
  expect(fetchMock.mock.calls.some(([path, options]) => String(path).includes("/presence/") && options?.method === "DELETE")).toBe(true);
});
