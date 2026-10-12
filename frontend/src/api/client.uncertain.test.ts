import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acknowledgeInterruptedWrites, api, confirmWrite, establishSession, getUncertainWrites, inspectWrite, invalidateSession, needsInterruptedWriteReview, retryWrite, SessionInterruptedError, UncertainWriteError } from "./client";

const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response;
const path = "/episodes/12/medical-evaluation";
const original = { method: "POST", body: JSON.stringify({ diagnosis: "Ficticio", clinical_note: "Control" }), headers: { "If-Match": '"original"' } };
describe("Resultados inciertos compartidos", () => {
  const fetchMock = vi.fn();
  beforeEach(() => { establishSession("ficticio"); fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
  afterEach(() => { invalidateSession(); vi.unstubAllGlobals(); });
  it.each(["red", "servidor", "json"])("clasifica %s como incierto y reintenta contenido, clave y versión originales", async failure => {
    if (failure === "red") fetchMock.mockRejectedValueOnce(new Error("Red"));
    if (failure === "servidor") fetchMock.mockResolvedValueOnce(response({ detail: "Fallo" }, 503));
    if (failure === "json") fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw new Error("JSON"); } });
    await expect(api(path, original)).rejects.toBeInstanceOf(UncertainWriteError);
    const pending = getUncertainWrites()[0];
    expect(pending.path).toBe(path);
    fetchMock.mockResolvedValueOnce(response({ id: 12 }));
    await expect(retryWrite(pending.key)).resolves.toEqual({ id: 12 });
    expect(fetchMock.mock.calls[1][1]).toEqual(fetchMock.mock.calls[0][1]);
    expect(getUncertainWrites()).toEqual([]);
  });
  it("rechazos definitivos no quedan pendientes ni bloquean una nueva intención", async () => {
    fetchMock.mockResolvedValueOnce(response({ detail: "Permiso" }, 403));
    await expect(api(path, original)).rejects.toThrow("Permiso");
    expect(getUncertainWrites()).toEqual([]);
    fetchMock.mockResolvedValueOnce(response({ id: 12 }));
    await api(path, original);
    expect(fetchMock.mock.calls[1][1].headers["idempotency-key"]).not.toBe(fetchMock.mock.calls[0][1].headers["idempotency-key"]);
  });
  it("bloquea contenido o versión distintos y permite recursos independientes", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Red"));
    await expect(api(path, original)).rejects.toThrow("Resultado por confirmar");
    await expect(api(path, { ...original, body: "{}" })).rejects.toThrow("envío anterior");
    await expect(api(path, { ...original, headers: { "If-Match": '"otra"' } })).rejects.toThrow("envío anterior");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(response({ id: 12 }));
    await api("/episodes/12/vitals", { method: "POST", body: "{}" });
    expect(getUncertainWrites()).toHaveLength(1);
  });
  it("consultar solo hace GET; ausencia no consume la intención y confirmar sí", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Red"));
    await expect(api(path, original)).rejects.toThrow();
    const { key } = getUncertainWrites()[0];
    fetchMock.mockResolvedValueOnce(response({ status: "unknown" }));
    expect(await inspectWrite(key)).toEqual({ status: "unknown" });
    expect(fetchMock.mock.calls[1][1].method).toBeUndefined();
    expect(getUncertainWrites()).toHaveLength(1);
    fetchMock.mockResolvedValueOnce(response({ status: "confirmed", result: { id: 12 } }));
    expect((await inspectWrite(key)).status).toBe("confirmed");
    confirmWrite(key);
    expect(getUncertainWrites()).toEqual([]);
  });
  it("un fallo de lectura no se convierte en un guardado incierto", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Red"));
    await expect(api("/episodes/12")).rejects.toThrow("Red");
    expect(getUncertainWrites()).toEqual([]);
  });
  it("un reintento vencido no escribe pero permite consultar el recibo", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Red"));
    await expect(api(path, original)).rejects.toThrow();
    const { key } = getUncertainWrites()[0];
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now + 24 * 60 * 60 * 1000);
    await expect(retryWrite(key)).rejects.toThrow("expiró");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(response({ status: "confirmed", result: { id: 12 } }));
    expect((await inspectWrite(key)).status).toBe("confirmed");
    clock.mockRestore();
  });
  it("expiración y respuestas tardías no atraviesan sesiones", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
    const pending = api(path, original);
    invalidateSession();
    establishSession("otra-sesion");
    finish(response({ id: 12 }));
    await expect(pending).rejects.toBeInstanceOf(SessionInterruptedError);
    expect(getUncertainWrites()).toEqual([]);
    expect(needsInterruptedWriteReview()).toBe(true);
    await expect(api(path, original)).rejects.toThrow("Revisa los registros");
    acknowledgeInterruptedWrites();
    fetchMock.mockResolvedValueOnce(response({}, 401));
    await expect(api(path, original)).rejects.toBeInstanceOf(SessionInterruptedError);
    expect(getUncertainWrites()).toEqual([]);
  });
});
