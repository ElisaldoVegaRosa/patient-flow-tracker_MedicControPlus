import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import jsQR from "jsqr";
import { startQrCamera } from "./qrCamera";

vi.mock("jsqr", () => ({ default: vi.fn() }));
const decode = vi.mocked(jsQR);

describe("Ciclo de vida de cámara QR", () => {
  const stop = vi.fn();
  const track = new EventTarget();
  const stream = { getTracks: () => [{ stop }], getVideoTracks: () => [track] } as unknown as MediaStream;
  const acquire = vi.fn();
  let video: HTMLVideoElement;
  let controller: AbortController;
  let read = vi.fn<(value: string) => void>();
  let error = vi.fn<(message: string) => void>();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: acquire } });
    acquire.mockReset().mockResolvedValue(stream);
    stop.mockReset();
    decode.mockReset().mockReturnValue(null);
    video = document.createElement("video");
    Object.defineProperties(video, {
      readyState: { value: 4 }, videoWidth: { value: 1920 }, videoHeight: { value: 1080 },
    });
    vi.spyOn(video, "play").mockResolvedValue();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray(640 * 360 * 4) }),
    } as unknown as CanvasRenderingContext2D);
    controller = new AbortController();
    read = vi.fn<(value: string) => void>();
    error = vi.fn<(message: string) => void>();
  });
  afterEach(() => {
    controller.abort();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  const start = () => startQrCamera(video, controller.signal, read, error);

  it("pide solo vídeo, reduce resolución y libera tras una única lectura", async () => {
    decode.mockReturnValue({ data: "qr-demo" } as ReturnType<typeof jsQR>);
    await start();
    expect(acquire).toHaveBeenCalledWith(expect.objectContaining({ audio: false }));
    expect(video.srcObject).toBe(stream);
    await vi.advanceTimersByTimeAsync(1000);
    expect(read).toHaveBeenCalledExactlyOnceWith("qr-demo");
    expect(decode).toHaveBeenCalledExactlyOnceWith(expect.any(Uint8ClampedArray), 640, 360, { inversionAttempts: "attemptBoth" });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
  });

  it("detiene fotogramas y recursos al cancelar", async () => {
    await start();
    controller.abort();
    await vi.advanceTimersByTimeAsync(1000);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(decode).not.toHaveBeenCalled();
  });

  it("libera un permiso que se concede después de cancelar", async () => {
    let resolve!: (value: MediaStream) => void;
    acquire.mockImplementation(() => new Promise<MediaStream>(done => { resolve = done; }));
    const pending = start();
    await vi.waitFor(() => expect(acquire).toHaveBeenCalled());
    controller.abort();
    resolve(stream);
    await pending;
    expect(stop).toHaveBeenCalledTimes(1);
    expect(video.play).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it("no pide permiso cuando ya fue cancelado", async () => {
    controller.abort();
    await start();
    expect(acquire).not.toHaveBeenCalled();
  });

  it("cancelar durante la carga del lector no pide permiso después", async () => {
    const pending = start();
    controller.abort();
    await pending;
    expect(acquire).not.toHaveBeenCalled();
  });

  it("cancelar mientras se reproduce vídeo libera recursos sin leer", async () => {
    let finish!: () => void;
    vi.mocked(video.play).mockImplementation(() => new Promise<void>(done => { finish = done; }));
    const pending = start();
    await vi.waitFor(() => expect(video.play).toHaveBeenCalled());
    controller.abort();
    finish();
    await pending;
    await vi.advanceTimersByTimeAsync(1000);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
    expect(read).not.toHaveBeenCalled();
    expect(decode).not.toHaveBeenCalled();
  });

  it("rechaza contexto inseguro sin pedir permiso", async () => {
    vi.stubGlobal("isSecureContext", false);
    await expect(start()).rejects.toThrow("HTTPS o localhost");
    expect(acquire).not.toHaveBeenCalled();
  });

  it("informa API ausente", async () => {
    vi.stubGlobal("navigator", {});
    await expect(start()).rejects.toThrow("no ofrece acceso");
  });

  it.each([
    ["NotAllowedError", "Permiso de cámara denegado"],
    ["NotFoundError", "No se encontró una cámara"],
    ["NotReadableError", "No se pudo iniciar"],
  ])("informa %s sin filtrar detalles internos", async (name, message) => {
    acquire.mockRejectedValue(new DOMException("detalle privado", name));
    await expect(start()).rejects.toThrow(message);
    expect(read).not.toHaveBeenCalled();
  });

  it("libera stream si no puede reproducir vídeo", async () => {
    vi.mocked(video.play).mockRejectedValue(new Error("fallo"));
    await expect(start()).rejects.toThrow("No se pudo iniciar");
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("informa desconexión sin nuevas lecturas", async () => {
    await start();
    track.dispatchEvent(new Event("ended"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(error).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("desconectó"));
    expect(decode).not.toHaveBeenCalled();
  });

  it("detiene recursos ante error del decodificador", async () => {
    decode.mockImplementation(() => { throw new Error("bad pixels"); });
    await start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(error).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
