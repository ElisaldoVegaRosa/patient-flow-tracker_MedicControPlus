import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { acknowledgeInterruptedWrites, api, bindWriteRecovery, confirmWrite, establishSession, getUncertainWrites, inspectWrite, invalidateSession, retryWrite, SessionInterruptedError, UncertainWriteError } from "./client";
import { REQUEST_TIMEOUT_MS, RequestTimeoutError } from "./requestLifetime";
import { WRITE_REFERENCE_PREFIX } from "../session/writeReferences";
import { usePendingOperations } from "../hooks/usePendingOperations";
import { LIVE_REFRESH_INTERVAL, useLiveRefresh } from "../hooks/useLiveRefresh";

const path = "/episodes/42/medical-evaluation";
const options = { method: "POST", body: JSON.stringify({ diagnosis: "Prueba ficticia" }) };
const response = (result: unknown = {}) => ({ ok: true, status: 200, json: async () => result }) as Response;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const tick = (ms = REQUEST_TIMEOUT_MS) => vi.advanceTimersByTimeAsync(ms);
beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); establishSession("ficticio59"); acknowledgeInterruptedWrites(); });
afterEach(() => { invalidateSession(); acknowledgeInterruptedWrites(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

it.each(["/dashboard", "/auth/login", "/scan/qr-ficticio"])("vence %s sin reenvío automático ni guardado incierto", async url => {
  const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
  vi.stubGlobal("fetch", fetchMock);
  const result = api(url, url === "/auth/login" ? { method: "POST", body: "{}" } : {}).catch(error => error);
  await tick();
  expect(await result).toBeInstanceOf(RequestTimeoutError);
  expect(fetchMock.mock.calls[0]).toBeDefined();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(getUncertainWrites()).toEqual([]);
  expect(vi.getTimerCount()).toBe(0);
});

it("el mismo plazo cubre cabeceras y cuerpo y descarta una respuesta tardía", async () => {
  const headers = deferred<Response>(); const body = deferred<unknown>();
  const fetchMock = vi.fn().mockReturnValue(headers.promise);
  vi.stubGlobal("fetch", fetchMock);
  const result = api("/dashboard").catch(error => error);
  await tick(REQUEST_TIMEOUT_MS - 1_000);
  headers.resolve({ ...response(), json: () => body.promise });
  await tick(1_000);
  expect(await result).toBeInstanceOf(RequestTimeoutError);
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  body.resolve({ sensitive: "No debe aplicarse" });
  await tick(0);
  expect(await result).toBeInstanceOf(RequestTimeoutError);
});

it.each(["headers", "body"])("escritura con %s pendiente conserva clave y referencia; consultar confirma sin otro POST", async phase => {
  await bindWriteRecovery({ username: "qa59", role: "DOCTOR" });
  const pending = deferred<Response>();
  const fetchMock = vi.fn().mockImplementationOnce(() => phase === "headers" ? pending.promise : Promise.resolve({ ...response(), json: () => new Promise(() => {}) })).mockResolvedValue(response({ status: "confirmed", result: { id: 42 } }));
  vi.stubGlobal("fetch", fetchMock);
  const result = api(path, options).catch(error => error);
  const key = new Headers(fetchMock.mock.calls[0][1].headers).get("Idempotency-Key")!;
  await tick();
  expect(await result).toBeInstanceOf(UncertainWriteError);
  expect(getUncertainWrites()[0].key).toBe(key);
  expect(localStorage.getItem(WRITE_REFERENCE_PREFIX + key)).not.toBeNull();
  // The server can commit after the browser stopped waiting.
  pending.resolve(response({ id: 42 }));
  await tick(0);
  expect(getUncertainWrites()).toHaveLength(1);
  expect((await inspectWrite(key)).status).toBe("confirmed");
  confirmWrite(key);
  expect(localStorage.getItem(WRITE_REFERENCE_PREFIX + key)).toBeNull();
  expect(fetchMock.mock.calls.filter(([, request]) => request.method === "POST")).toHaveLength(1);
});

it("reintento explícito tras vencimiento usa la misma clave y un transporte nuevo", async () => {
  const fetchMock = vi.fn().mockImplementationOnce(() => new Promise(() => {})).mockResolvedValue(response({ id: 42 }));
  vi.stubGlobal("fetch", fetchMock);
  const result = api(path, options).catch(error => error);
  await tick(); await result;
  await retryWrite(getUncertainWrites()[0].key);
  expect(fetchMock.mock.calls[1][1].headers).toEqual(fetchMock.mock.calls[0][1].headers);
  expect(fetchMock.mock.calls[1][1].signal.aborted).toBe(false);
  expect(fetchMock.mock.calls[1][1].signal).not.toBe(fetchMock.mock.calls[0][1].signal);
  expect(getUncertainWrites()).toEqual([]);
});

it("señal ya cancelada no adquiere clave ni envía; cancelación durante envío permite reintento explícito", async () => {
  const fetchMock = vi.fn().mockImplementationOnce(() => new Promise(() => {})).mockResolvedValue(response());
  vi.stubGlobal("fetch", fetchMock);
  const external = new AbortController(); external.abort();
  await expect(api(path, { ...options, signal: external.signal })).rejects.toMatchObject({ name: "AbortError" });
  expect(fetchMock).not.toHaveBeenCalled();
  const active = new AbortController();
  const result = api(path, { ...options, signal: active.signal }).catch(error => error);
  active.abort();
  expect(await result).toBeInstanceOf(UncertainWriteError);
  await retryWrite(getUncertainWrites()[0].key);
  expect(fetchMock.mock.calls[1][1].signal.aborted).toBe(false);
});

it("cambiar sesión aborta lecturas y escrituras anteriores sin afectar la nueva ni borrar referencias", async () => {
  await bindWriteRecovery({ username: "qa59", role: "DOCTOR" });
  const fresh = deferred<Response>();
  const fetchMock = vi.fn().mockImplementationOnce(() => new Promise(() => {})).mockImplementationOnce(() => new Promise(() => {})).mockReturnValueOnce(fresh.promise);
  vi.stubGlobal("fetch", fetchMock);
  const read = api("/dashboard").catch(error => error);
  const write = api(path, options).catch(error => error);
  const key = new Headers(fetchMock.mock.calls[1][1].headers).get("Idempotency-Key")!;
  await tick(10_000);
  establishSession("sesion-nueva");
  expect(await read).toBeInstanceOf(SessionInterruptedError);
  expect(await write).toBeInstanceOf(SessionInterruptedError);
  expect(localStorage.getItem(WRITE_REFERENCE_PREFIX + key)).not.toBeNull();
  const newer = api("/dashboard");
  await tick(20_000);
  expect(fetchMock.mock.calls[2][1].signal.aborted).toBe(false);
  fresh.resolve(response({ current: true }));
  expect(await newer).toEqual({ current: true });
  expect(vi.getTimerCount()).toBe(0);
});

it("token cambiado en otra pestaña interrumpe la espera sin borrar el token nuevo", async () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  const result = api("/dashboard").catch(error => error);
  localStorage.setItem("token", "otra-pestana");
  window.dispatchEvent(new StorageEvent("storage", { key: "token" }));
  expect(await result).toBeInstanceOf(SessionInterruptedError);
  expect(localStorage.getItem("token")).toBe("otra-pestana");
});

it("salir localmente permite terminar la revocación remota sin afectar una sesión posterior", async () => {
  const revoked = deferred<Response>();
  const fetchMock = vi.fn().mockReturnValueOnce(revoked.promise).mockResolvedValue(response({ current: true }));
  vi.stubGlobal("fetch", fetchMock);
  const logout = api("/auth/logout", { method: "POST" }).catch(error => error);
  invalidateSession(); establishSession("sesion-posterior");
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);
  expect(await api("/dashboard")).toEqual({ current: true });
  revoked.resolve(response({ logged_out: true }));
  expect(await logout).toBeInstanceOf(SessionInterruptedError);
  expect(localStorage.getItem("token")).toBe("sesion-posterior");
  await tick();
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);
});

it("limpia temporizadores y listener externo al terminar con éxito", async () => {
  const external = new AbortController();
  const remove = vi.spyOn(external.signal, "removeEventListener");
  const scheduled = vi.spyOn(globalThis, "setTimeout");
  const cleared = vi.spyOn(globalThis, "clearTimeout");
  const fetchMock = vi.fn().mockResolvedValue(response()); vi.stubGlobal("fetch", fetchMock);
  await api("/dashboard", { signal: external.signal });
  const deadline = scheduled.mock.calls.findIndex(([, delay]) => delay === REQUEST_TIMEOUT_MS);
  expect(deadline).toBeGreaterThanOrEqual(0);
  expect(cleared).toHaveBeenCalledWith(scheduled.mock.results[deadline].value);
  expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  external.abort(); await tick();
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);
});

it("libera el bloqueo de envío y permite consultar el resultado", async () => {
  const { result } = renderHook(() => usePendingOperations());
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  let finished!: Promise<unknown>;
  act(() => { const release = result.current.start("evaluation")!; finished = api(path, options).catch(error => error).finally(release); });
  expect(result.current.hasPending()).toBe(true);
  await act(async () => { await tick(); await finished; });
  expect(result.current.hasPending()).toBe(false);
  expect(getUncertainWrites()).toHaveLength(1);
});

it("el sondeo conserva datos ante timeout y vuelve a consultar después", async () => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const apply = vi.fn();
  const fetchMock = vi.fn().mockImplementationOnce(() => new Promise(() => {})).mockResolvedValue(response());
  vi.stubGlobal("fetch", fetchMock);
  const { result, unmount } = renderHook(() => useLiveRefresh({ context: "dashboard", paused: () => false, load: async signal => { await api("/dashboard", { signal }); return apply; } }));
  await act(async () => { await tick(LIVE_REFRESH_INTERVAL); await tick(); });
  expect(result.current.error).toContain("tiempo de espera"); expect(apply).not.toHaveBeenCalled();
  await act(async () => { await tick(LIVE_REFRESH_INTERVAL); });
  expect(apply).toHaveBeenCalledOnce(); expect(result.current.error).toBe("");
  unmount(); expect(vi.getTimerCount()).toBe(0);
});
