import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startQrCamera } from "../camera/qrCamera";
import ScanPage from "./ScanPage";

vi.mock("../camera/qrCamera", () => ({ startQrCamera: vi.fn(async () => {}) }));
const camera = vi.mocked(startQrCamera);

describe("Lector de pulsera", () => {
  beforeEach(() => { camera.mockReset().mockResolvedValue(undefined); });
  afterEach(() => vi.unstubAllGlobals());

  it("no solicita cámara al abrir y conserva la entrada manual", async () => {
    const submit = vi.fn(async () => {});
    render(<ScanPage onSubmit={submit} />);
    expect(camera).not.toHaveBeenCalled();
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), " qr-demo ");
    await user.click(screen.getByRole("button", { name: "Identificar paciente" }));
    expect(submit).toHaveBeenCalledExactlyOnceWith("qr-demo");
  });

  it("captura una sola vez, detiene cámara y espera confirmación", async () => {
    const submit = vi.fn(async () => {});
    render(<ScanPage onSubmit={submit} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Activar cámara" }));
    const [, signal, read] = camera.mock.calls[0];
    act(() => { read("qr-demo"); read("qr-otro"); });
    expect(signal.aborted).toBe(true);
    expect(screen.getByRole("textbox")).toHaveValue("qr-demo");
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("QR capturado");
    await user.click(screen.getByRole("button", { name: "Identificar paciente" }));
    expect(submit).toHaveBeenCalledExactlyOnceWith("qr-demo");
  });

  it("rechaza QR con URL sin consultar ni reemplazar el valor manual", async () => {
    const submit = vi.fn(async () => {});
    render(<ScanPage onSubmit={submit} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "qr-previo");
    await user.click(screen.getByRole("button", { name: "Activar cámara" }));
    act(() => camera.mock.calls[0][2]("https://otro.example/paciente"));
    expect(screen.getByRole("alert")).toHaveTextContent("No se consultó");
    expect(screen.getByRole("textbox")).toHaveValue("qr-previo");
    expect(submit).not.toHaveBeenCalled();
  });

  it("cancela permisos pendientes e ignora una captura tardía", async () => {
    camera.mockImplementation(() => new Promise(() => {}));
    render(<ScanPage onSubmit={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Activar cámara" }));
    await user.click(screen.getByRole("button", { name: "Cancelar cámara" }));
    const [, signal, read] = camera.mock.calls[0];
    expect(signal.aborted).toBe(true);
    act(() => read("qr-tardio"));
    expect(screen.getByRole("textbox")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Activar cámara" }));
    act(() => read("qr-viejo"));
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("bloquea doble confirmación mientras consulta y no reintenta automáticamente", async () => {
    let finish!: () => void;
    const submit = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    render(<ScanPage onSubmit={submit} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "qr-demo" } });
    const form = input.closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Consultando episodio…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Activar cámara" })).toBeDisabled();
    await act(async () => finish());
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("textbox")).toHaveValue("qr-demo");
  });

  it.each(["https://otro.example", "../otro", "qr/demo", "qr?demo", " "])("rechaza entrada manual no válida: %s", value => {
    const submit = vi.fn();
    render(<ScanPage onSubmit={submit} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value } });
    fireEvent.submit(input.closest("form")!);
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeVisible();
  });

  it("muestra error de inicio y permite volver a usar la entrada manual", async () => {
    camera.mockRejectedValue(new Error("Permiso de cámara denegado"));
    render(<ScanPage onSubmit={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Activar cámara" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Permiso de cámara denegado");
    expect(screen.getByRole("textbox")).toBeEnabled();
  });

  it("conserva el identificador ante error de consulta sin reintentar", async () => {
    const submit = vi.fn().mockRejectedValue(new Error("error interno"));
    render(<ScanPage onSubmit={submit} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "qr-demo");
    await user.click(screen.getByRole("button", { name: "Identificar paciente" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("no se reintentó");
    expect(submit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("textbox")).toHaveValue("qr-demo");
  });

  it("borra el token capturado cuando cambia la sesión en otra pestaña", async () => {
    render(<ScanPage onSubmit={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Activar cámara" }));
    act(() => camera.mock.calls[0][2]("qr-demo"));
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: "token" })));
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("muestra desconexión y descarta callbacks posteriores", async () => {
    render(<ScanPage onSubmit={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Activar cámara" }));
    act(() => camera.mock.calls[0][3]("Cámara desconectada"));
    expect(screen.getByRole("alert")).toHaveTextContent("Cámara desconectada");
    act(() => camera.mock.calls[0][2]("qr-tardio"));
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("libera cámara al desmontar", async () => {
    const view = render(<ScanPage onSubmit={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Activar cámara" }));
    view.unmount();
    expect(camera.mock.calls[0][1].aborted).toBe(true);
  });

  it.each(["pagehide", "storage", "visibilitychange"])("interrumpe captura ante %s", async event => {
    render(<ScanPage onSubmit={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Activar cámara" }));
    act(() => {
      if (event === "storage") window.dispatchEvent(new StorageEvent("storage", { key: "token" }));
      else if (event === "visibilitychange") {
        vi.spyOn(document, "hidden", "get").mockReturnValue(true);
        document.dispatchEvent(new Event(event));
      } else window.dispatchEvent(new Event(event));
    });
    expect(camera.mock.calls[0][1].aborted).toBe(true);
    expect(screen.getByRole("button", { name: "Activar cámara" })).toBeVisible();
    vi.restoreAllMocks();
  });
});
