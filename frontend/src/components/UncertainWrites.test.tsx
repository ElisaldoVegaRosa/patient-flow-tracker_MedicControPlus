import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, establishSession, invalidateSession } from "../api/client";
import { usePendingOperations } from "../hooks/usePendingOperations";
import UncertainWrites from "./UncertainWrites";

const response = (data: unknown) => ({ ok: true, status: 200, json: async () => data }) as Response;
describe("Revisión explícita de guardados inciertos", () => {
  afterEach(() => { invalidateSession(); vi.unstubAllGlobals(); });
  async function setup() {
    establishSession("ficticio");
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("Red"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(api("/episodes/12/medical-evaluation", { method: "POST", body: '{"diagnosis":"Ficticio"}' })).rejects.toThrow();
    const onConfirmed = vi.fn();
    const onRejected = vi.fn();
    function Harness({ onComplete = onConfirmed }: { onComplete?: typeof onConfirmed }) { return <UncertainWrites operations={usePendingOperations()} onConfirmed={onComplete} onRejected={onRejected} />; }
    const view = render(<Harness />);
    return { ...view, Harness, fetchMock, onConfirmed, onRejected };
  }
  it("consultar ausencia mantiene la advertencia y nunca reenvía", async () => {
    const { fetchMock, onConfirmed } = await setup();
    fetchMock.mockResolvedValueOnce(response({ status: "unknown" }));
    fireEvent.click(screen.getByText("Consultar resultado"));
    expect(await screen.findByText(/Esto no demuestra/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].method).toBeUndefined();
    expect(onConfirmed).not.toHaveBeenCalled();
  });
  it("un recibo confirmado actualiza la interfaz sin hacer otra escritura", async () => {
    const { fetchMock, onConfirmed } = await setup();
    fetchMock.mockResolvedValueOnce(response({ status: "confirmed", result: { id: 12 } }));
    fireEvent.click(screen.getByText("Consultar resultado"));
    await waitFor(() => expect(onConfirmed).toHaveBeenCalledWith("/episodes/12/medical-evaluation", { id: 12 }, '{"diagnosis":"Ficticio"}'));
    expect(screen.queryByRole("region", { name: "Guardados por confirmar" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("doble clic y consulta simultánea comparten bloqueo; reintento usa la clave original", async () => {
    const { fetchMock, onConfirmed } = await setup();
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
    const retry = screen.getByText("Reintentar operación original");
    fireEvent.click(retry);
    fireEvent.click(retry);
    fireEvent.click(screen.getByText("Consultar resultado"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]).toEqual(fetchMock.mock.calls[0][1]);
    await act(async () => { finish(response({ id: 12 })); });
    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });
  it("consulta tardía tras cambiar de sesión no confirma ni revive la operación", async () => {
    const { fetchMock, onConfirmed } = await setup();
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
    fireEvent.click(screen.getByText("Consultar resultado"));
    act(() => { invalidateSession(); establishSession("otra"); });
    await act(async () => { finish(response({ status: "confirmed", result: { id: 12 } })); });
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(screen.queryByText("Guardados por confirmar")).not.toBeInTheDocument();
  });
  it("un rechazo definitivo del reintento se informa aunque desaparezca el pendiente", async () => {
    const { fetchMock, onRejected } = await setup();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ detail: { code: "version_conflict", message: "Datos modificados" } }) });
    fireEvent.click(screen.getByText("Reintentar operación original"));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Guardados por confirmar" })).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onRejected).toHaveBeenCalledWith("/episodes/12/medical-evaluation", expect.objectContaining({ message: "Datos modificados" }));
  });
  it("tras cambiar de sesión exige revisar antes de otra escritura; aceptar no envía", async () => {
    const { fetchMock } = await setup();
    act(() => { invalidateSession(); establishSession("otra"); });
    expect(screen.getByRole("region", { name: "Revisión tras cambiar de sesión" })).toBeInTheDocument();
    await expect(api("/episodes/12/vitals", { method: "POST", body: "{}" })).rejects.toThrow("Revisa los registros");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("He revisado los registros; continuar"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(response({ id: 12 }));
    await api("/episodes/12/vitals", { method: "POST", body: "{}" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("una consulta tardía utiliza el contexto actual después de navegar", async () => {
    const { fetchMock, onConfirmed, Harness, rerender } = await setup();
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
    fireEvent.click(screen.getByText("Consultar resultado"));
    const currentContext = vi.fn();
    rerender(<Harness onComplete={currentContext} />);
    await act(async () => { finish(response({ status: "confirmed", result: { id: 12 } })); });
    expect(currentContext).toHaveBeenCalledTimes(1);
    expect(onConfirmed).not.toHaveBeenCalled();
  });
});
