import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, establishSession } from "../api/client";
import { LIVE_REFRESH_INTERVAL, useLiveRefresh } from "./useLiveRefresh";

beforeEach(() => { vi.useFakeTimers(); vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible"); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });
const tick = () => act(async () => { await vi.advanceTimersByTimeAsync(LIVE_REFRESH_INTERVAL); });

it("consulta cada 15 segundos y comparte el bloqueo con actualizaciones manuales", async () => {
  let resolve!: (apply: () => void) => void;
  const apply = vi.fn();
  const load = vi.fn(() => new Promise<() => void>(done => { resolve = done; }));
  const { result } = renderHook(() => useLiveRefresh({ context: "dashboard", paused: () => false, load }));
  expect(load).not.toHaveBeenCalled();
  await tick();
  await act(async () => { void result.current.refresh(); window.dispatchEvent(new Event("focus")); });
  await tick();
  expect(load).toHaveBeenCalledTimes(1);
  await act(async () => resolve(apply));
  expect(apply).toHaveBeenCalledTimes(1);
  await tick();
  expect(load).toHaveBeenCalledTimes(2);
});

it("pausa oculta y durante operaciones; vuelve a consultar al regresar", async () => {
  const visible = vi.spyOn(document, "visibilityState", "get");
  let paused = true;
  const apply = vi.fn();
  const load = vi.fn(async () => apply);
  renderHook(() => useLiveRefresh({ context: "lab", paused: () => paused, load }));
  await tick();
  expect(load).not.toHaveBeenCalled();
  paused = false;
  visible.mockReturnValue("hidden");
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  await tick();
  expect(load).not.toHaveBeenCalled();
  visible.mockReturnValue("visible");
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect(load).toHaveBeenCalledTimes(1);
  expect(apply).toHaveBeenCalledTimes(1);
});

it.each(["navigation", "session", "hidden", "write"])("descarta respuestas anteriores tras %s", async reason => {
  let resolve!: (apply: () => void) => void;
  const apply = vi.fn();
  let paused = false;
  const load = vi.fn(() => new Promise<() => void>(done => { resolve = done; }));
  const { rerender } = renderHook(({ context }) => useLiveRefresh({ context, paused: () => paused, load }), { initialProps: { context: "episode:1" } });
  await tick();
  if (reason === "navigation") rerender({ context: "episode:2" });
  if (reason === "session") establishSession("other-session");
  if (reason === "hidden") { vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden"); act(() => document.dispatchEvent(new Event("visibilitychange"))); }
  if (reason === "write") paused = true;
  await act(async () => resolve(apply));
  expect(apply).not.toHaveBeenCalled();
});

it("muestra un fallo conservando la última actualización y lo limpia al recuperar", async () => {
  const load = vi.fn(async () => () => {});
  const { result } = renderHook(() => useLiveRefresh({ context: "supervisor", paused: () => false, load }));
  await tick();
  const updated = result.current.updated;
  load.mockRejectedValueOnce(new Error("Sin conexión"));
  await tick();
  expect(result.current.error).toBe("Sin conexión");
  expect(result.current.updated).toBe(updated);
  await act(async () => result.current.refresh());
  expect(result.current.error).toBe("");
});

it("no consulta después de desmontar ni en una pantalla sin contexto", async () => {
  const load = vi.fn(async () => () => {});
  const { unmount } = renderHook(() => useLiveRefresh({ context: null, paused: () => false, load }));
  await tick();
  unmount();
  await tick();
  expect(load).not.toHaveBeenCalled();
});

it("descarta una lectura si hubo un envío que ya terminó antes de recibirla", async () => {
  let resolve!: (apply: () => void) => void;
  const apply = vi.fn();
  const load = () => new Promise<() => void>(done => { resolve = done; });
  renderHook(() => useLiveRefresh({ context: "episode:1", paused: () => false, load }));
  await tick();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })));
  await api("/episodes/1/vitals", { method: "POST", body: "{}" });
  await act(async () => resolve(apply));
  expect(apply).not.toHaveBeenCalled();
});

it("al regresar espera la lectura anterior y consulta de nuevo sin aplicar la respuesta oculta", async () => {
  const visible = vi.spyOn(document, "visibilityState", "get");
  let resolve!: (apply: () => void) => void;
  const old = vi.fn();
  const latest = vi.fn();
  const load = vi.fn().mockImplementationOnce(() => new Promise<() => void>(done => { resolve = done; })).mockResolvedValue(latest);
  renderHook(() => useLiveRefresh({ context: "lab", paused: () => false, load }));
  await tick();
  visible.mockReturnValue("hidden");
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  visible.mockReturnValue("visible");
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(load).toHaveBeenCalledTimes(1);
  await act(async () => resolve(old));
  expect(old).not.toHaveBeenCalled();
  expect(load).toHaveBeenCalledTimes(2);
  expect(latest).toHaveBeenCalledTimes(1);
});
