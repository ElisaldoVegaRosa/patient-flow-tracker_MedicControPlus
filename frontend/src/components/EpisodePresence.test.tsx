import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import EpisodePresence from "./EpisodePresence";
import { establishSession, getUncertainWrites, invalidateSession } from "../api/client";
import { REQUEST_TIMEOUT_MS } from "../api/requestLifetime";
import { PRESENCE_INTERVAL } from "../hooks/useEpisodePresence";
import type { EpisodePresenceData } from "../types/clinical";

const identity = { username: "qa61", role: "DOCTOR" };
const empty: EpisodePresenceData = { active: true, ttl_seconds: 45, members: [] };
const colleague: EpisodePresenceData = { ...empty, members: [{ username: "colega", role: "NURSE", tabs: 2, sessions: 2, editing_tabs: 1 }] };
const response = (data = empty) => ({ ok: true, status: 200, json: async () => data }) as Response;
beforeEach(() => { vi.useFakeTimers(); establishSession("presence-test-session"); vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible"); });
afterEach(() => { invalidateSession(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });
function Harness({ id = 42 }: { id?: number }) {
  const root = useRef<HTMLDivElement>(null);
  return <div ref={root}><input aria-label="Texto local" defaultValue="" />
    <EpisodePresence episodeId={id} user={identity} root={root} isEditing={() => Boolean(root.current?.querySelector("input")?.value)} />
  </div>;
}
async function setup(data = empty) {
  const fetchMock = vi.fn().mockResolvedValue(response(data)); vi.stubGlobal("fetch", fetchMock);
  const view = render(<Harness />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  return { ...view, fetchMock };
}
const puts = (mock: ReturnType<typeof vi.fn>) => mock.mock.calls.filter(([, options]) => options.method === "PUT");

it("muestra otras sesiones sin enviar texto clínico ni crear referencias de escritura", async () => {
  const { fetchMock } = await setup(colleague);
  expect(screen.getByRole("region", { name: "Presencia en el episodio" })).toHaveTextContent("colega · NURSE · 2 pestañas en 2 sesiones · 1 con cambios sin guardar");
  expect(JSON.parse(puts(fetchMock)[0][1].body)).toEqual({ mode: "VIEW", sequence: 1 });
  expect(new Headers(puts(fetchMock)[0][1].headers).has("Idempotency-Key")).toBe(false);
  expect(localStorage.length).toBe(1);
  expect(getUncertainWrites()).toEqual([]);
});
it("detecta edición y retorno a consulta conservando los campos locales", async () => {
  const { fetchMock } = await setup();
  fireEvent.change(screen.getByLabelText("Texto local"), { target: { value: "Nota privada que no se transmite" } });
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  expect(JSON.parse(puts(fetchMock).at(-1)![1].body)).toEqual({ mode: "EDIT", sequence: 2 });
  expect(screen.getByLabelText("Texto local")).toHaveValue("Nota privada que no se transmite");
  expect(String(puts(fetchMock).at(-1)![1].body)).not.toContain("Nota privada");
  fireEvent.change(screen.getByLabelText("Texto local"), { target: { value: "" } });
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  expect(JSON.parse(puts(fetchMock).at(-1)![1].body).mode).toBe("VIEW");
});
it("renueva cada 15 segundos y pausa al ocultar, retomando al volver", async () => {
  const { fetchMock } = await setup();
  await act(async () => { await vi.advanceTimersByTimeAsync(PRESENCE_INTERVAL); });
  expect(puts(fetchMock)).toHaveLength(2);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  await act(async () => { await vi.advanceTimersByTimeAsync(45_000); });
  expect(puts(fetchMock)).toHaveLength(2);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect(puts(fetchMock)).toHaveLength(3);
});
it("un fallo conserva el último dato como incierto y se recupera sin afectar edición", async () => {
  const { fetchMock } = await setup();
  fireEvent.change(screen.getByLabelText("Texto local"), { target: { value: "Local" } });
  fetchMock.mockRejectedValueOnce(new Error("Offline"));
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  expect(screen.getByText(/no confirma que estés trabajando a solas/)).toBeVisible();
  expect(screen.queryByText(/No se detectaron otras sesiones/)).not.toBeInTheDocument();
  expect(screen.getByLabelText("Texto local")).toHaveValue("Local");
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(screen.queryByText(/no confirma que estés trabajando a solas/)).not.toBeInTheDocument();
});
it("un heartbeat vencido libera la espera y retoma el sondeo sin entradas inciertas", async () => {
  const fetchMock = vi.fn().mockImplementationOnce(() => new Promise(() => {})).mockResolvedValue(response()); vi.stubGlobal("fetch", fetchMock);
  render(<Harness />);
  await act(async () => { await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS); });
  expect(screen.getByText(/no confirma que estés trabajando a solas/)).toBeVisible();
  await act(async () => { await vi.advanceTimersByTimeAsync(PRESENCE_INTERVAL); });
  expect(puts(fetchMock)).toHaveLength(2);
  expect(getUncertainWrites()).toEqual([]);
});
it("la navegación libera el episodio anterior y no aplica respuestas tardías", async () => {
  const { fetchMock, rerender } = await setup();
  let finish!: (response: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  await act(async () => rerender(<Harness id={43} />));
  await act(async () => finish(response(colleague)));
  expect(screen.queryByText(/colega ·/)).not.toBeInTheDocument();
  const deleted = fetchMock.mock.calls.find(([, options]) => options.method === "DELETE")!;
  expect(String(deleted[0])).toContain("/episodes/42/presence/");
  expect(String(puts(fetchMock).at(-1)![0])).toContain("/episodes/43/presence/");
});
it("al restaurar desde bfcache renueva con otro identificador después de liberar", async () => {
  const { fetchMock } = await setup();
  const firstPath = puts(fetchMock)[0][0];
  await act(async () => window.dispatchEvent(new Event("pagehide")));
  await act(async () => window.dispatchEvent(new Event("pageshow")));
  expect(puts(fetchMock).at(-1)![0]).not.toBe(firstPath);
  expect(JSON.parse(puts(fetchMock).at(-1)![1].body).sequence).toBe(1);
  expect(fetchMock.mock.calls.find(([, options]) => options.method === "DELETE")![0]).toBe(firstPath);
});
it("no libera un episodio con la credencial de una sesión nueva", async () => {
  const { fetchMock, unmount } = await setup();
  establishSession("new-session");
  unmount();
  expect(fetchMock.mock.calls.some(([, options]) => options.method === "DELETE")).toBe(false);
});
it("identifica el propio usuario en otras pestañas sin prometer exclusividad", async () => {
  await setup({ ...colleague, members: [{ username: "qa61", role: "DOCTOR", tabs: 1, sessions: 1, editing_tabs: 0 }] });
  expect(screen.getByRole("region", { name: "Presencia en el episodio" })).toHaveTextContent("tu usuario en otra pestaña o sesión");
  expect(screen.getByText(/este aviso no reserva el episodio/)).toBeVisible();
});
