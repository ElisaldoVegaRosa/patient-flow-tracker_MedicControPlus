import { afterEach, describe, expect, it, vi } from "vitest";
import { acknowledgeInterruptedWrites, api, establishSession, invalidateSession, SESSION_EXPIRED_EVENT, SessionInterruptedError } from "./client";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const response = (status: number, value: unknown = {}) => ({
  ok: status < 400, status, json: async () => value,
}) as Response;

describe("Interrupción centralizada de sesión", () => {
  afterEach(() => { invalidateSession(); vi.unstubAllGlobals(); });

  it("agrupa 401 concurrentes y no invalida una sesión nueva por un 401 tardío", async () => {
    establishSession("sesion-anterior");
    const first = deferred<Response>();
    const second = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise));
    const expired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    try {
      const a = api('/dashboard').catch((e: unknown) => e);
      const b = api('/episodes/42').catch((e: unknown) => e);
      first.resolve(response(401));
      expect(await a).toBeInstanceOf(SessionInterruptedError);
      expect(expired).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('token')).toBeNull();
      establishSession('sesion-nueva');
      second.resolve(response(401));
      expect(await b).toBeInstanceOf(SessionInterruptedError);
      expect(expired).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('token')).toBe('sesion-nueva');
    } finally {
      window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
    }
  });

  it.each(['éxito', 'error de red'])("rechaza %s tardío de la sesión anterior", async (outcome) => {
    establishSession('anterior');
    const pending = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending.promise));
    const result = api('/episodes/42').catch((e: unknown) => e);
    establishSession('nueva');
    if (outcome === 'éxito') pending.resolve(response(200, { id: 42 }));
    else pending.reject(new Error('Red antigua'));
    expect(await result).toBeInstanceOf(SessionInterruptedError);
  });

  it("login rechazado no dispara expiración ni recarga", async () => {
    const expired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(401, { detail: 'Credenciales inválidas' })));
    try {
      await expect(api('/auth/login')).rejects.toThrow('Credenciales inválidas');
      expect(expired).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
    }
  });
});


describe("Intenciones de escritura", () => {
  afterEach(() => { invalidateSession(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  const write = { method: "POST", body: JSON.stringify({ diagnosis: "Ficticio" }) };
  const key = (mock: ReturnType<typeof vi.fn>, call: number) => new Headers(mock.mock.calls[call][1].headers).get("Idempotency-Key");

  it("conserva la clave tras respuesta perdida, sin reenvio automatico; exito consume la intencion", async () => {
    establishSession("test-session");
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("Network fictitious"))
      .mockResolvedValue(response(200));
    vi.stubGlobal("fetch", fetchMock);
    await expect(api("/episodes/53/medical-evaluation", write)).rejects.toThrow("Network fictitious");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await api("/episodes/53/medical-evaluation", write);
    expect(key(fetchMock, 0)).toBe(key(fetchMock, 1));
    await api("/episodes/53/medical-evaluation", write);
    expect(key(fetchMock, 2)).not.toBe(key(fetchMock, 1));
  });

  it("comparte clave en envios concurrentes de la misma intencion y distingue contenido", async () => {
    establishSession("test-session");
    const first = deferred<Response>();
    const fetchMock = vi.fn().mockReturnValue(first.promise);
    vi.stubGlobal("fetch", fetchMock);
    const a = api("/episodes", write);
    const b = api("/episodes", write);
    const c = api("/episodes", { ...write, body: JSON.stringify({ diagnosis: "Otra" }) });
    expect(key(fetchMock, 0)).toBe(key(fetchMock, 1));
    expect(key(fetchMock, 2)).not.toBe(key(fetchMock, 0));
    first.resolve(response(200));
    await Promise.all([a, b, c]);
  });

  it("una respuesta tardia no elimina la clave de una intencion posterior", async () => {
    establishSession("test-session");
    const first = deferred<Response>();
    const second = deferred<Response>();
    const third = deferred<Response>();
    const fetchMock = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
      .mockReturnValueOnce(third.promise).mockResolvedValue(response(200));
    vi.stubGlobal("fetch", fetchMock);
    const a = api("/episodes", write);
    const b = api("/episodes", write);
    first.resolve(response(200));
    await a;
    const c = api("/episodes", write).catch((error: unknown) => error);
    second.resolve(response(200));
    await b;
    third.reject(new Error("Lost response"));
    await c;
    await api("/episodes", write);
    expect(key(fetchMock, 2)).toBe(key(fetchMock, 3));
    expect(key(fetchMock, 0)).not.toBe(key(fetchMock, 2));
  });

  it("retiene clave tras 503 y crea otra tras un rechazo definitivo", async () => {
    establishSession("test-session");
    const fetchMock = vi.fn().mockResolvedValueOnce(response(503, { detail: "Busy" }))
      .mockResolvedValueOnce(response(422, { detail: "Invalid" })).mockResolvedValue(response(200));
    vi.stubGlobal("fetch", fetchMock);
    await expect(api("/episodes", write)).rejects.toThrow("Busy");
    await expect(api("/episodes", write)).rejects.toThrow("Invalid");
    await api("/episodes", write);
    expect(key(fetchMock, 0)).toBe(key(fetchMock, 1));
    expect(key(fetchMock, 1)).not.toBe(key(fetchMock, 2));
  });

  it("no traslada una intencion ambigua a otra sesion", async () => {
    establishSession("old-session");
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("Network fictitious")).mockResolvedValue(response(200));
    vi.stubGlobal("fetch", fetchMock);
    await expect(api("/episodes", write)).rejects.toThrow();
    establishSession("new-session");
    await expect(api("/episodes", write)).rejects.toThrow("Revisa los registros");
    acknowledgeInterruptedWrites();
    await api("/episodes", write);
    expect(key(fetchMock, 0)).not.toBe(key(fetchMock, 1));
  });

  it("respeta clave explicita y normaliza Headers", async () => {
    establishSession("test-session");
    const fetchMock = vi.fn().mockResolvedValue(response(200));
    vi.stubGlobal("fetch", fetchMock);
    await api("/episodes", { ...write, headers: new Headers({ "Idempotency-Key": "explicit-53b-operation" }) });
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("Idempotency-Key")).toBe("explicit-53b-operation");
  });

  it("no aplica claves a lectura, acceso o salida", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200));
    vi.stubGlobal("fetch", fetchMock);
    await api("/dashboard");
    await api("/auth/login", write);
    await api("/auth/logout", write);
    for (let i = 0; i < 3; i++) expect(key(fetchMock, i)).toBeNull();
  });

  it("una clave ambigua vencida exige comprobar el resultado, sin nueva solicitud", async () => {
    establishSession("test-session");
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network fictitious"));
    vi.stubGlobal("fetch", fetchMock);
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    await expect(api("/episodes", write)).rejects.toThrow();
    vi.mocked(Date.now).mockReturnValue(now + 24 * 60 * 60 * 1000);
    await expect(api("/episodes", write)).rejects.toThrow("clave expir");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});


it("explica errores 422 de campos sin declararlos inciertos", async () => {
  establishSession("test-validation");
  const fetchMock = vi.fn().mockResolvedValue(response(422, { detail: [{ loc: ["body", "name"], msg: "Valor inválido" }] }));
  vi.stubGlobal("fetch", fetchMock);
  try {
    await expect(api("/episodes", { method: "POST", body: JSON.stringify({ name: "   " }) })).rejects.toThrow("name: Valor inválido");
    fetchMock.mockResolvedValue(response(201, { id: 1 }));
    await expect(api("/episodes", { method: "POST", body: JSON.stringify({ name: "Corregido" }) })).resolves.toEqual({ id: 1 });
    const first = new Headers(fetchMock.mock.calls[0][1].headers).get("Idempotency-Key");
    const second = new Headers(fetchMock.mock.calls[1][1].headers).get("Idempotency-Key");
    expect(second).not.toBe(first);
  } finally { invalidateSession(); vi.unstubAllGlobals(); }
});
