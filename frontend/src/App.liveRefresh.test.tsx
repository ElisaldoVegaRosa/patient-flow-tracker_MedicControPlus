import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import { establishSession, invalidateSession, SESSION_EXPIRED_EVENT } from "./api/client";
import type { Episode, LaboratoryQueue, SupervisorData } from "./types/clinical";

const initial: Episode = { id: 42, name: "Paciente actualización", birth_date: "1990-01-01", document: "QA-57", qr_token: "qa57", status: "ACTIVE", priority: 3, location: "Observación", assigned_to: "Equipo original", started_at: "2026-10-12T10:00:00Z", vitals: [], alerts: [], tasks: [], events: [], triage_version: '"triage-original"', clinical_version: '"clinical-original"' };
beforeEach(() => { establishSession("qa57-session"); vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible"); });
afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function prepare(role = "NURSE") {
  let episode = structuredClone(initial);
  let failed = false;
  let queue: LaboratoryQueue = { total: 1, status_filter: "PENDING", requested_by: "qa57", orders: [{ id: 8, episode_id: 42, title: "Hemograma", service: "LAB", status: "PENDING", result: null, created_at: initial.started_at, patient_name: initial.name, priority: 3, location: initial.location, episode_status: "ACTIVE", version: '"lab-original"' }] };
  let supervisor: SupervisorData = { metrics: { active_patients: 1, high_priority_patients: 0, patients_at_risk: 0, open_alerts: 0, pending_tasks: 0 }, rules: { evaluated_episodes: 1, generated_alerts: 0 }, patients: [], generated_at: initial.started_at, requested_by: "qa57" };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path === "/auth/login") return { ok: true, status: 200, json: async () => ({ username: "otro-usuario", role, access_token: "qa57-new-session" }) } as Response;
    if (failed && path !== "/auth/me") throw new Error("Failed to fetch");
    if (options?.method === "PATCH" || options?.method === "POST") return { ok: false, status: 409, json: async () => ({ detail: { code: "version_conflict", message: "Versión anterior" } }) } as Response;
    const data: Record<string, unknown> = {
      "/auth/me": { username: "qa57", role },
      "/dashboard": { active: 1, open_alerts: 0, patients: [episode], requested_by: "qa57" },
      "/episodes/42": episode, "/lab/orders": queue, "/supervisor/dashboard": supervisor,
    };
    if (!(path in data)) throw new Error(`Unexpected ${path}`);
    return { ok: true, status: 200, json: async () => data[path] } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  return { fetchMock, update: (value: Partial<Episode>) => { episode = { ...episode, ...value }; }, fail: (value: boolean) => { failed = value; }, queue: (value: LaboratoryQueue) => { queue = value; }, supervisor: (value: Partial<SupervisorData>) => { supervisor = { ...supervisor, ...value }; } };
}
async function refresh() { await act(async () => { window.dispatchEvent(new Event("focus")); }); }
async function openEpisode() {
  fireEvent.click(await screen.findByRole("button", { name: "Abrir" }));
  await screen.findByRole("heading", { name: initial.name });
}

it("actualiza el dashboard por GET y avisa cuando falla sin borrar los datos", async () => {
  const app = prepare();
  await screen.findByRole("button", { name: "Abrir" });
  app.update({ name: "Nombre actualizado" });
  await refresh();
  expect(screen.getByText("Nombre actualizado")).toBeVisible();
  app.fail(true);
  await refresh();
  expect(screen.getByRole("alert")).toHaveTextContent("La información puede estar desactualizada");
  expect(screen.getByText("Nombre actualizado")).toBeVisible();
  app.fail(false);
  fireEvent.click(screen.getByRole("button", { name: "Reintentar actualización" }));
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  expect(app.fetchMock.mock.calls.every(([, options]) => !options?.method || options.method === "GET")).toBe(true);
});

it("actualiza triaje limpio; conserva campos y versión del triaje editado", async () => {
  const app = prepare();
  await openEpisode();
  app.update({ priority: 2, assigned_to: "Equipo remoto", triage_version: '"triage-remote"' });
  await refresh();
  expect(screen.getByLabelText("Prioridad")).toHaveValue("2");
  expect(screen.getByLabelText("Personal responsable")).toHaveValue("Equipo remoto");
  fireEvent.change(screen.getByLabelText("Personal responsable"), { target: { value: "Equipo local" } });
  app.update({ priority: 1, assigned_to: "Equipo posterior", triage_version: '"triage-latest"' });
  await refresh();
  expect(screen.getByLabelText("Personal responsable")).toHaveValue("Equipo local");
  expect(screen.getByLabelText("Prioridad")).toHaveValue("2");
  // Further editing after refresh must not silently renew the draft version.
  fireEvent.change(screen.getByLabelText("Área o ubicación"), { target: { value: "Triaje" } });
  fireEvent.submit(screen.getByRole("button", { name: "Guardar triaje y asignación" }).closest("form")!);
  await screen.findAllByText(/Versión anterior/);
    const call = app.fetchMock.mock.calls.find(([path, options]) => String(path).endsWith("/triage") && options?.method === "POST")!;
  expect(new Headers(call[1]?.headers).get("If-Match")).toBe('"triage-remote"');
});

it("conserva evaluación y nota de alta cuando otra sesión cierra el episodio", async () => {
  const app = prepare("DOCTOR");
  await openEpisode();
  fireEvent.change(screen.getByLabelText("Diagnóstico o impresión clínica"), { target: { value: "LAB" } });
  fireEvent.change(screen.getByLabelText("Nota de alta"), { target: { value: "Nota local pendiente" } });
  app.update({ status: "CLOSED", closed_at: initial.started_at });
  await refresh();
  expect(screen.getByText("Episodio EP-42 · CLOSED")).toBeVisible();
  expect(within(screen.getByRole("region", { name: "Texto local conservado" })).getByText("LAB", { exact: true })).toBeVisible();
  expect(screen.getByRole("region", { name: "Texto local conservado" })).toHaveTextContent("Nota local pendiente");
  expect(screen.queryByRole("button", { name: "Guardar evaluación médica" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Cerrar episodio · Alta médica" })).not.toBeInTheDocument();
  expect(app.fetchMock.mock.calls.every(([, options]) => !options?.method || options.method === "GET")).toBe(true);
});

it("conserva un resultado LAB y su versión; retiene texto si la orden desaparece", async () => {
  const app = prepare("LAB");
  fireEvent.click(await screen.findByRole("button", { name: "Bandeja de laboratorio" }));
  const field = await screen.findByLabelText("Resultado de laboratorio");
  fireEvent.change(field, { target: { value: "Resultado local pendiente" } });
  const remoteQueue: LaboratoryQueue = { total: 1, status_filter: "PENDING", requested_by: "qa57", orders: [{ id: 8, episode_id: 42, title: "Hemograma actualizado", service: "LAB", status: "PENDING", result: null, created_at: initial.started_at, patient_name: initial.name, priority: 2, location: "Laboratorio", episode_status: "ACTIVE", version: '"lab-latest"' }] };
  app.queue(remoteQueue);
  await refresh();
  expect(screen.getByLabelText("Resultado de laboratorio")).toHaveValue("Resultado local pendiente");
  expect(screen.getByText("Hemograma actualizado")).toBeVisible();
  fireEvent.submit(screen.getByRole("button", { name: "Publicar resultado y completar" }).closest("form")!);
  await screen.findAllByText(/Versión anterior/);
  const call = app.fetchMock.mock.calls.find(([, options]) => options?.method === "PATCH")!;
  expect(new Headers(call[1]?.headers).get("If-Match")).toBe('"lab-original"');
  app.queue({ ...remoteQueue, total: 0, orders: [] });
  await refresh();
  expect(screen.getByRole("region", { name: "Texto local conservado" })).toHaveTextContent("Resultado local pendiente");
  expect(screen.queryByRole("button", { name: "Publicar resultado y completar" })).not.toBeInTheDocument();
});

it("actualiza supervisor conservando el filtro seleccionado", async () => {
  const app = prepare("SUPERVISOR");
  fireEvent.click(await screen.findByRole("button", { name: "Panel de supervisor" }));
  await screen.findByRole("heading", { name: "Centro de control del supervisor" });
  const filter = screen.getByRole("button", { name: "P1–P2" });
  fireEvent.click(filter);
  app.supervisor({ rules: { evaluated_episodes: 7, generated_alerts: 0 } });
  await refresh();
  expect(filter).toHaveClass("active-filter");
  expect(screen.getByText(/7 episodios activos/)).toBeVisible();
});

it("descarta texto retenido al expirar la sesión y no lo muestra a otro usuario", async () => {
  const app = prepare("DOCTOR");
  await openEpisode();
  fireEvent.change(screen.getByLabelText("Nota de alta"), { target: { value: "Texto del usuario anterior" } });
  app.update({ status: "CLOSED" });
  await refresh();
  expect(screen.getByRole("region", { name: "Texto local conservado" })).toBeVisible();
  act(() => { invalidateSession(); window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)); });
  fireEvent.click(await screen.findByRole("button", { name: "Entrar" }));
  await screen.findByRole("button", { name: "Abrir" });
  expect(screen.queryByText("Texto del usuario anterior")).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Texto local conservado" })).not.toBeInTheDocument();
});
