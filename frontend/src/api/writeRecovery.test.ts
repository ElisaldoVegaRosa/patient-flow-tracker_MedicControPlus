import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WRITE_REFERENCE_PREFIX, WriteReferences, writeReferenceOwner } from "../session/writeReferences";
const identity = { username: "medico-ficticio", role: "DOCTOR" };
const options = { method: "POST", body: JSON.stringify({ diagnosis: "Texto clínico de prueba", clinical_note: "Nota privada", disposition: "CONTINUE_OBSERVATION" }), headers: { "If-Match": '"version-private"' } };
const response = (status = 200, result: unknown = {}) => ({ ok: status < 400, status, json: async () => result }) as Response;
beforeEach(() => { vi.resetModules(); localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); });
async function client(user = identity, token = "ficticio") {
  const api = await import("./client");
  api.establishSession(token);
  await api.bindWriteRecovery(user);
  return api;
}

it("persiste antes de enviar y recupera un envío en curso tras reiniciar el cliente", async () => {
  const original = await client();
  let finish!: (response: Response) => void;
  const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; })).mockResolvedValue(response(200, { status: "confirmed", result: { id: 42 } }));
  vi.stubGlobal("fetch", fetchMock);
  const sent = original.api("/episodes/42/medical-evaluation", options).catch(error => error);
  expect(localStorage.length).toBe(2); // Session token plus one opaque reference.
  const key = new Headers(fetchMock.mock.calls[0][1].headers).get("Idempotency-Key")!;
  const raw = localStorage.getItem(WRITE_REFERENCE_PREFIX + key)!;
  for (const forbidden of ["Texto clínico", "Nota privada", "/episodes/42", "version-private", "ficticio"]) expect(raw).not.toContain(forbidden);
  vi.resetModules();
  const restored = await client(identity, "nueva-sesion");
  expect(restored.getRecoveredWrites().map(item => item.key)).toEqual([key]);
  expect(restored.getWriteBody(key)).toBeUndefined();
  await expect(restored.api("/episodes/42/medical-evaluation", options)).rejects.toThrow("envíos anteriores");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect((await restored.inspectRecoveredWrite(key)).status).toBe("confirmed");
  expect(fetchMock.mock.calls[1][1].method).toBeUndefined();
  restored.confirmRecoveredWrite(key);
  expect(restored.getRecoveredWrites()).toEqual([]);
  expect(localStorage.getItem(WRITE_REFERENCE_PREFIX + key)).toBeNull();
  finish(response());
  expect(await sent).toBeInstanceOf(original.SessionInterruptedError);
});

it.each([200, 401, 409, 422])("retira la referencia después de una respuesta definitiva %s", async status => {
  const c = await client();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(status, status === 200 ? {} : { detail: "Rechazo" })));
  await c.api("/episodes/42/medical-evaluation", options).catch(() => {});
  expect(Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter(key => key?.startsWith(WRITE_REFERENCE_PREFIX))).toHaveLength(0);
});

it("conserva la clave tras 503 y reintenta con la misma clave únicamente por acción explícita", async () => {
  const c = await client();
  const fetchMock = vi.fn().mockResolvedValueOnce(response(503)).mockResolvedValue(response());
  vi.stubGlobal("fetch", fetchMock);
  await expect(c.api("/episodes/42/medical-evaluation", options)).rejects.toThrow("Resultado por confirmar");
  const key = c.getUncertainWrites()[0].key;
  expect(localStorage.getItem(WRITE_REFERENCE_PREFIX + key)).not.toBeNull();
  expect(c.getRecoveredWrites()).toHaveLength(0);
  await c.retryWrite(key);
  expect(new Headers(fetchMock.mock.calls[1][1].headers).get("Idempotency-Key")).toBe(key);
  expect(localStorage.getItem(WRITE_REFERENCE_PREFIX + key)).toBeNull();
});

it("aisla usuario y rol después de cambiar de sesión sin perder la referencia anterior", async () => {
  const c = await client();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("Red")));
  await c.api("/episodes/42/medical-evaluation", options).catch(() => {});
  const key = c.getUncertainWrites()[0].key;
  c.invalidateSession();
  c.establishSession("otro-token");
  await c.bindWriteRecovery({ username: "otro", role: "DOCTOR" });
  expect(c.getRecoveredWrites()).toEqual([]);
  await expect(c.inspectRecoveredWrite(key)).rejects.toBeInstanceOf(c.SessionInterruptedError);
  await c.bindWriteRecovery({ ...identity, role: "NURSE" });
  expect(c.getRecoveredWrites()).toEqual([]);
  await c.bindWriteRecovery(identity);
  expect(c.getRecoveredWrites().map(item => item.key)).toEqual([key]);
});

it("una referencia desconocida sigue visible tras revisión manual y recarga, sin reenviar", async () => {
  const c = await client();
  const fetchMock = vi.fn().mockRejectedValueOnce(new Error("Red")).mockResolvedValueOnce(response(200, { status: "unknown" })).mockResolvedValue(response());
  vi.stubGlobal("fetch", fetchMock);
  await c.api("/episodes/42/medical-evaluation", options).catch(() => {});
  const key = c.getUncertainWrites()[0].key;
  c.invalidateSession(); c.establishSession("restored"); await c.bindWriteRecovery(identity);
  expect(await c.inspectRecoveredWrite(key)).toEqual({ status: "unknown" });
  expect(() => c.forgetRecoveredWrite(key)).toThrow();
  c.reviewRecoveredWrite(key);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  vi.resetModules();
  const restored = await client(identity, "restored");
  expect(restored.getRecoveredWrites()[0]).toMatchObject({ key, reviewed: true });
  await restored.api("/episodes/42/medical-evaluation", options);
  expect(new Headers(fetchMock.mock.calls[2][1].headers).get("Idempotency-Key")).not.toBe(key);
  expect(restored.getRecoveredWrites()[0].key).toBe(key);
  restored.forgetRecoveredWrite(key);
  expect(restored.getRecoveredWrites()).toEqual([]);
});

it("un 401 de un reintento conserva la referencia ambigua al volver a entrar", async () => {
  const c = await client();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("Respuesta perdida")).mockResolvedValue(response(401)));
  await c.api("/episodes/42/medical-evaluation", options).catch(() => {});
  await expect(c.api("/episodes/42/medical-evaluation", options)).rejects.toBeInstanceOf(c.SessionInterruptedError);
  c.establishSession("renewed"); await c.bindWriteRecovery(identity);
  expect(c.getRecoveredWrites()).toHaveLength(1);
});

it("si no puede guardar la referencia, bloquea el envío antes de fetch", async () => {
  const c = await client();
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  const originalSet = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key.startsWith(WRITE_REFERENCE_PREFIX)) throw new DOMException("Quota", "QuotaExceededError");
    originalSet.call(this, key, value);
  });
  await expect(c.api("/episodes/42/medical-evaluation", options)).rejects.toThrow("No se ha enviado");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("un registro corrupto bloquea las escrituras y conserva las consultas", async () => {
  localStorage.setItem(WRITE_REFERENCE_PREFIX + "invalid-journal-0001", "{");
  const c = await client();
  const fetchMock = vi.fn().mockResolvedValue(response()); vi.stubGlobal("fetch", fetchMock);
  expect(c.getWriteRecoveryError()).toContain("registro local");
  await expect(c.api("/episodes/42/medical-evaluation", options)).rejects.toThrow("No se ha enviado");
  await c.api("/dashboard");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(WRITE_REFERENCE_PREFIX + "invalid-journal-0001")).toBe("{");
});

it("detecta un token cambiado por otra pestaña antes de enviar y no borra ese token", async () => {
  const c = await client();
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  localStorage.setItem("token", "token-de-otro-usuario");
  await expect(c.api("/episodes/42/medical-evaluation", options)).rejects.toBeInstanceOf(c.SessionInterruptedError);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(localStorage.getItem("token")).toBe("token-de-otro-usuario");
});

it("no convierte un envío nuevo de otra pestaña en una recuperación de esta pantalla", async () => {
  const c = await client();
  const owner = await writeReferenceOwner("http://localhost:8000", identity);
  new WriteReferences(localStorage).remember({ owner, key: "other-tab-live-write-0058", kind: "evaluation", createdAt: Date.now(), reviewed: false });
  c.refreshWriteRecovery();
  expect(c.getRecoveredWrites()).toEqual([]);
  const fetchMock = vi.fn().mockResolvedValue(response()); vi.stubGlobal("fetch", fetchMock);
  await c.api("/episodes/42/vitals", options);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await c.bindWriteRecovery(identity); // Explicit recovery after re-entering does include it.
  expect(c.getRecoveredWrites()).toHaveLength(1);
});

it("bloquea envíos durante la vinculación y descarta una vinculación tardía de otra sesión", async () => {
  const c = await client();
  let finish!: (digest: ArrayBuffer) => void;
  const spy = vi.spyOn(crypto.subtle, "digest").mockImplementationOnce(() => new Promise<ArrayBuffer>(resolve => { finish = resolve; }));
  const binding = c.bindWriteRecovery(identity).catch(error => error);
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  await expect(c.api("/episodes/42/vitals", options)).rejects.toThrow("Comprobando");
  expect(fetchMock).not.toHaveBeenCalled();
  c.invalidateSession(); c.establishSession("other"); spy.mockRestore();
  await c.bindWriteRecovery({ username: "otro", role: "DOCTOR" });
  finish(new ArrayBuffer(32));
  expect(await binding).toBeInstanceOf(c.SessionInterruptedError);
  expect(c.getRecoveredWrites()).toEqual([]);
});

it("una respuesta ilegible conserva la referencia sin persistir datos clínicos", async () => {
  const c = await client();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError("JSON"); } }));
  await expect(c.api("/episodes/42/medical-evaluation", options)).rejects.toThrow("Resultado por confirmar");
  const key = c.getUncertainWrites()[0].key;
  expect(localStorage.getItem(WRITE_REFERENCE_PREFIX + key)).not.toContain("Texto clínico");
  c.invalidateSession(); c.establishSession("restored"); await c.bindWriteRecovery(identity);
  expect(c.getRecoveredWrites().map(item => item.key)).toEqual([key]);
});

it("consulta y retira daño propio confirmado sin reenviar ni perder la referencia sana", async () => {
  const owner = await writeReferenceOwner("http://localhost:8000", identity);
  const healthy = "healthy-reference-60";
  const damaged = "damaged-reference-60";
  new WriteReferences(localStorage).remember({ owner, key: healthy, kind: "evaluation", createdAt: 1000, reviewed: false });
  localStorage.setItem(WRITE_REFERENCE_PREFIX + damaged, JSON.stringify({ owner, createdAt: 0 }));
  const c = await client();
  const fetchMock = vi.fn().mockResolvedValue(response(200, { status: "confirmed" })); vi.stubGlobal("fetch", fetchMock);
  expect(c.getRecoveredWrites().map(item => item.key)).toEqual([healthy]);
  expect(c.getDamagedWriteReferences()).toEqual([{ key: damaged, consultable: true }]);
  await expect(c.api("/episodes/42/vitals", options)).rejects.toThrow("No se ha enviado");
  await c.inspectRecoveredWrite(healthy);
  c.confirmRecoveredWrite(healthy);
  expect(c.getWriteRecoveryError()).not.toBe("");
  await c.inspectDamagedWriteReference(damaged);
  expect(c.getWriteRecoveryError()).toBe("");
  expect(localStorage.getItem(WRITE_REFERENCE_PREFIX + damaged)).toBeNull();
  expect(fetchMock.mock.calls.every(([, options]) => !options.method)).toBe(true);
});
it.each(["unknown", "network"])("conserva daño tras resultado %s y sigue bloqueando", async result => {
  const owner = await writeReferenceOwner("http://localhost:8000", identity);
  const key = "damaged-reference-60";
  const raw = JSON.stringify({ owner, createdAt: 0 });
  localStorage.setItem(WRITE_REFERENCE_PREFIX + key, raw);
  const c = await client();
  const fetchMock = result === "network" ? vi.fn().mockRejectedValue(new Error("Red")) : vi.fn().mockResolvedValue(response(200, { status: "unknown" }));
  vi.stubGlobal("fetch", fetchMock);
  await c.inspectDamagedWriteReference(key).catch(() => {});
  expect(localStorage.getItem(WRITE_REFERENCE_PREFIX + key)).toBe(raw);
  await expect(c.api("/episodes/42/vitals", options)).rejects.toThrow("No se ha enviado");
  expect(fetchMock).toHaveBeenCalledOnce();
});
it("no consulta daño sin identidad y no toca otro propietario", async () => {
  const key = "unknown-reference-60";
  localStorage.setItem(WRITE_REFERENCE_PREFIX + key, "{");
  const c = await client();
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  await expect(c.inspectDamagedWriteReference(key)).rejects.toBeInstanceOf(c.SessionInterruptedError);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(localStorage.getItem(WRITE_REFERENCE_PREFIX + key)).toBe("{");
});
it.each(["storage", "session"])("no aplica confirmación tardía tras cambio de %s", async change => {
  const owner = await writeReferenceOwner("http://localhost:8000", identity);
  const key = "damaged-reference-60";
  const raw = JSON.stringify({ owner, createdAt: 0 });
  localStorage.setItem(WRITE_REFERENCE_PREFIX + key, raw);
  const c = await client();
  let finish!: (response: Response) => void;
  vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; })));
  const checking = c.inspectDamagedWriteReference(key).catch(error => error);
  if (change === "storage") localStorage.setItem(WRITE_REFERENCE_PREFIX + key, raw + " ");
  else { c.invalidateSession(); c.establishSession("another"); await c.bindWriteRecovery({ username: "otro", role: "DOCTOR" }); }
  finish(response(200, { status: "confirmed" }));
  expect(await checking).toBeInstanceOf(Error);
  expect(localStorage.getItem(WRITE_REFERENCE_PREFIX + key)).toBe(change === "storage" ? raw + " " : raw);
});
