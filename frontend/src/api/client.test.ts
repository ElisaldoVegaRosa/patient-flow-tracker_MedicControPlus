import { afterEach, describe, expect, it, vi } from "vitest";
import { api, establishSession, invalidateSession, SESSION_EXPIRED_EVENT, SessionInterruptedError } from "./client";

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
