import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { api, bindWriteRecovery, establishSession, getRecoveredWrites, invalidateSession } from "../api/client";
import { usePendingOperations } from "../hooks/usePendingOperations";
import { WRITE_REFERENCE_PREFIX, WriteReferences, writeReferenceOwner } from "../session/writeReferences";
import { REQUEST_TIMEOUT_MS } from "../api/requestLifetime";
import RecoveredWrites from "./RecoveredWrites";
const identity = { username: "qa58", role: "DOCTOR" };
const response = (data: unknown) => ({ ok: true, status: 200, json: async () => data }) as Response;
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); });
async function setup(result: "unknown" | "confirmed" | "network" = "unknown") {
  establishSession("old-session"); await bindWriteRecovery(identity);
  const fetchMock = vi.fn().mockRejectedValueOnce(new Error("Red")); vi.stubGlobal("fetch", fetchMock);
  await api("/episodes/42/medical-evaluation", { method: "POST", body: '{"diagnosis":"Contenido privado"}' }).catch(() => {});
  invalidateSession(); establishSession("restored-session"); await bindWriteRecovery(identity);
  const key = getRecoveredWrites()[0].key;
  if (result === "network") fetchMock.mockRejectedValue(new Error("Red"));
  else fetchMock.mockResolvedValue(response({ status: result, result: result === "confirmed" ? { id: 42 } : undefined }));
  const onConfirmed = vi.fn();
  function Harness({ onComplete = onConfirmed }: { onComplete?: typeof onConfirmed }) { return <RecoveredWrites user={identity} operations={usePendingOperations()} onConfirmed={onComplete} />; }
  const view = render(<Harness />);
  return { ...view, fetchMock, onConfirmed, key, Harness };
}
it("consulta al entrar y confirma por GET sin reintento ni contenido original", async () => {
  const { fetchMock, onConfirmed, key } = await setup("confirmed");
  await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][1].method).toBeUndefined();
  expect(screen.queryByText("Reintentar operación original")).not.toBeInTheDocument();
  expect(localStorage.getItem(WRITE_REFERENCE_PREFIX + key)).toBeNull();
  expect(screen.queryByRole("region", { name: "Envíos recuperados por revisar" })).not.toBeInTheDocument();
});
it("ausencia mantiene el aviso y bloquea nuevos envíos hasta revisión explícita", async () => {
  const { fetchMock, key } = await setup();
  await screen.findByText(/Sin confirmación/);
  await expect(api("/episodes/42/vitals", { method: "POST", body: "{}" })).rejects.toThrow("envíos anteriores");
  expect(fetchMock).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByText("He revisado los registros; habilitar nuevos envíos"));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(screen.getByText(/Revisión manual registrada/)).toBeVisible();
  expect(getRecoveredWrites()[0]).toMatchObject({ key, reviewed: true });
  expect(screen.getByText("Consultar resultado anterior")).toBeVisible();
  fireEvent.click(screen.getByText("Retirar aviso revisado"));
  expect(localStorage.getItem(WRITE_REFERENCE_PREFIX + key)).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("un fallo de consulta conserva la referencia y permite volver a consultar", async () => {
  const { fetchMock, key } = await setup("network");
  await screen.findByText(/No se pudo consultar/);
  expect(localStorage.getItem(WRITE_REFERENCE_PREFIX + key)).not.toBeNull();
  fetchMock.mockResolvedValue(response({ status: "confirmed", result: { id: 42 } }));
  fireEvent.click(screen.getByText("Consultar resultado anterior"));
  await waitFor(() => expect(localStorage.getItem(WRITE_REFERENCE_PREFIX + key)).toBeNull());
  expect(fetchMock.mock.calls.slice(1).every(([, options]) => !options.method)).toBe(true);
});
it("doble consulta comparte bloqueo y una respuesta tardía usa el contexto actual", async () => {
  const { fetchMock, onConfirmed, Harness, rerender } = await setup();
  await screen.findByText(/Sin confirmación/);
  let finish!: (response: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
  const button = screen.getByText("Consultar resultado anterior");
  fireEvent.click(button); fireEvent.click(button);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  const current = vi.fn(); rerender(<Harness onComplete={current} />);
  await act(async () => finish(response({ status: "confirmed", result: { id: 42 } })));
  expect(current).toHaveBeenCalledTimes(1);
  expect(onConfirmed).not.toHaveBeenCalled();
});
it("no confirma una consulta tardía después de cambiar de usuario", async () => {
  const { fetchMock, onConfirmed, key } = await setup();
  await screen.findByText(/Sin confirmación/);
  let finish!: (response: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByText("Consultar resultado anterior"));
  await act(async () => { invalidateSession(); establishSession("other"); await bindWriteRecovery({ username: "otro", role: "DOCTOR" }); });
  await act(async () => finish(response({ status: "confirmed", result: { id: 42 } })));
  expect(onConfirmed).not.toHaveBeenCalled();
  expect(localStorage.getItem(WRITE_REFERENCE_PREFIX + key)).not.toBeNull();
  expect(screen.queryByRole("region", { name: "Envíos recuperados por revisar" })).not.toBeInTheDocument();
});
it("refleja la retirada de una referencia desde otra pestaña sin reenviar", async () => {
  const { key, fetchMock } = await setup();
  await screen.findByText(/Sin confirmación/);
  localStorage.removeItem(WRITE_REFERENCE_PREFIX + key);
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: WRITE_REFERENCE_PREFIX + key })));
  expect(screen.queryByRole("region", { name: "Envíos recuperados por revisar" })).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("una consulta vencida libera el bloqueo y permite consultar la referencia siguiente", async () => {
  vi.useFakeTimers();
  try {
    establishSession("recibos59");
    const owner = await writeReferenceOwner("http://localhost:8000", identity);
    const registry = new WriteReferences(localStorage);
    const keys = ["first-reference-59", "second-reference-59"];
    keys.forEach((key, index) => registry.remember({ owner, key, kind: "evaluation", createdAt: Date.now() + index, reviewed: false }));
    await bindWriteRecovery(identity);
    const fetchMock = vi.fn().mockImplementationOnce(() => new Promise(() => {})).mockResolvedValue(response({ status: "confirmed" }));
    vi.stubGlobal("fetch", fetchMock);
    const onConfirmed = vi.fn();
    function Harness() { return <RecoveredWrites user={identity} operations={usePendingOperations()} onConfirmed={onConfirmed} />; }
    const view = render(<Harness />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onConfirmed).toHaveBeenCalledOnce();
    expect(localStorage.getItem(WRITE_REFERENCE_PREFIX + keys[0])).not.toBeNull();
    expect(localStorage.getItem(WRITE_REFERENCE_PREFIX + keys[1])).toBeNull();
    expect(screen.getByText("Consultar resultado anterior")).toBeEnabled();
    expect(fetchMock.mock.calls.every(([, options]) => !options.method)).toBe(true);
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(WRITE_REFERENCE_PREFIX + keys[0])).not.toBeNull();
  } finally { vi.useRealTimers(); }
});
