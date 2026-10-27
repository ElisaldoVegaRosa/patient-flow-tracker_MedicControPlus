import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import StaffHistoryPage from "./StaffHistoryPage";
import StaffingTimeline from "../components/StaffingTimeline";
import { establishSession, invalidateSession } from "../api/client";
import type { StaffChange } from "../types/clinical";

const user = { username: "coord.demo", role: "NURSE", can_coordinate: true, access_token: "history-test" };
const event: StaffChange = { id: 1, resource: "shift", target_id: 2, actor: "otra.cuenta", action: "EXTEND", reason: "Prueba ficticia",
  created_at: "2026-10-25T21:00:00Z", old_value: JSON.stringify({ name: "Turno noche", ends_at: "2026-10-25T12:00:00Z" }),
  new_value: JSON.stringify({ name: "Turno noche", ends_at: "2026-10-26T00:00:00Z" }) };
afterEach(() => { invalidateSession(); vi.unstubAllGlobals(); });

it("presents another account's event as continuous readable history in 12-hour time", () => {
  const { container } = render(<StaffingTimeline changes={[event]} />);
  expect(screen.getByRole("heading", { name: "Horario del turno ampliado" })).toBeInTheDocument();
  expect(screen.getByText(/otra.cuenta/)).toHaveTextContent(/0?5:00.*p/);
  expect(screen.getByRole("table")).toHaveTextContent(/0?8:00.*p/);
  expect(container.querySelector("details")).toBeNull();
  expect(screen.queryByText(/EXTEND/)).not.toBeInTheDocument();
  expect(screen.queryByText(/version/)).not.toBeInTheDocument();
});

it("queries full history, applies filters, paginates and returns to planning", async () => {
  establishSession("history-test");
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    return { ok: true, status: 200, json: async () => ({ changes: [event], total: 21, page: Number(url.searchParams.get("page")), page_size: 20,
      has_more: url.searchParams.get("page") === "1", shifts: [{ id: 2, name: "Turno noche" }], professionals: [] }) } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  const back = vi.fn();
  render(<StaffHistoryPage user={user} onBack={back} />);
  await screen.findByText("21 registros encontrados · Página 1");
  fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-10-20" } });
  fireEvent.change(screen.getByLabelText("Turno"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).includes("start_date=2026-10-20&shift_id=2"))).toBe(true));
  await screen.findByText("21 registros encontrados · Página 1");
  fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  await screen.findByText("21 registros encontrados · Página 2");
  expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
  await screen.findByText("21 registros encontrados · Página 1");
  expect(String(fetchMock.mock.calls.at(-1)![0])).not.toContain("shift_id");
  fireEvent.click(screen.getByRole("button", { name: "Volver a personal y turnos" }));
  expect(back).toHaveBeenCalledOnce();
});

it("does not request general history without coordination permission", () => {
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  render(<StaffHistoryPage user={{ ...user, can_coordinate: false }} onBack={() => {}} />);
  expect(screen.getByText(/No tienes permiso/)).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("ignores a late history response after filters change", async () => {
  establishSession("history-test");
  let finishOld: (value: Response) => void = () => {};
  const response = (reason: string) => ({ ok: true, status: 200, json: async () => ({ changes: [{ ...event, reason }], total: 1,
    page: 1, page_size: 20, has_more: false, shifts: [], professionals: [] }) }) as Response;
  const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finishOld = resolve; }))
    .mockResolvedValue(response("Resultado del filtro actual"));
  vi.stubGlobal("fetch", fetchMock);
  render(<StaffHistoryPage user={user} onBack={() => {}} />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-10-20" } });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
  await screen.findByText("Motivo: Resultado del filtro actual");
  await act(async () => finishOld(response("Respuesta obsoleta")));
  expect(screen.queryByText("Motivo: Respuesta obsoleta")).not.toBeInTheDocument();
  expect(screen.getByText("Motivo: Resultado del filtro actual")).toBeInTheDocument();
});
