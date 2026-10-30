import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import OperationalDelaysPage from "./OperationalDelaysPage";
import { usePendingOperations } from "../hooks/usePendingOperations";
import { establishSession } from "../api/client";
import type { OperationalDelays, SessionUser } from "../types/clinical";

const user: SessionUser = { username: "coordinador.ficticio", role: "NURSE", can_coordinate: true };
const opened = vi.fn();
const clock = { state: "PENDING" as const, since: "2026-10-29T12:00:00+00:00", until: null, minutes: 60 };
const model: OperationalDelays = { generated_at: "2026-10-29T13:00:00+00:00", requested_by: user.username, patients: [{
  episode_id: 23, name: "Paciente ficticio", identity_status: "PROVISIONAL", priority: 3, location: "Espera", area_name: "Consulta",
  started_at: clock.since, stay_minutes: 60, triage: { ...clock, state: "COMPLETED", minutes: 10 },
  attention: [{ discipline: "DOCTOR", owner: { username: "medico.ficticio", display_name: "Médico ficticio" }, wait: { ...clock, state: "COMPLETED", minutes: 15 } },
    { discipline: "NURSE", owner: null, wait: { ...clock, minutes: null } }],
  laboratory: [{ stage: "LAB_RECEIPT", order_id: 19, resource_id: 3, title: "Muestra #3", since: clock.since, minutes: 20 },
    { stage: "LAB_REVIEW", order_id: 19, resource_id: 1, title: "Analítica ficticia", since: clock.since, minutes: 5 }],
}] };
const response = (value: unknown, status = 200) => ({ ok: status === 200, status, json: async () => value }) as Response;
function Harness({ person = user }: { person?: SessionUser }) {
  const operations = usePendingOperations();
  return <OperationalDelaysPage user={person} operations={operations} onOpenEpisode={opened} />;
}
function setup(value = model) {
  establishSession("token-ficticio");
  const fetchMock = vi.fn<typeof fetch>(async () => response(structuredClone(value)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); opened.mockReset(); });

it("separa estancia, espera completada y dato desconocido, con detalles cerrados", async () => {
  const fetchMock = setup(); render(<Harness />);
  const summary = await screen.findByText(/Paciente ficticio · EP-23/);
  const details = summary.closest("details")!;
  expect(screen.getByText(/Mayor antigüedad conocida: Recepción en laboratorio · 20 min/)).toBeVisible();
  expect(details).not.toHaveAttribute("open"); fireEvent.click(summary);
  expect(screen.getByText(/Estancia desde ingreso: 60 min/)).toBeVisible();
  expect(screen.getByText(/Medicina: Registrado · espera finalizada: 15 min/)).toBeVisible();
  expect(screen.getByText(/Enfermería: Pendiente · Sin dato fiable/)).toBeVisible();
  expect(screen.getByText(/Recepción en laboratorio · Orden #19/)).toBeVisible();
  expect(screen.getByText(/Desde entrega registrada:/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Abrir episodio EP-23" }));
  expect(opened).toHaveBeenCalledWith(23);
  expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe("/operations/delays");
});

it("filtra por fase pendiente, no por una espera ya finalizada", async () => {
  setup(); render(<Harness />); await screen.findByText(/Paciente ficticio · EP-23/);
  fireEvent.change(screen.getByLabelText("Fase pendiente"), { target: { value: "DOCTOR" } });
  expect(screen.queryByText(/Paciente ficticio · EP-23/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Fase pendiente"), { target: { value: "LAB_RECEIPT" } });
  expect(screen.getByText(/Paciente ficticio · EP-23/)).toBeVisible();
  expect(screen.getByText(/1 pendiente registrado · Mayor antigüedad conocida: Recepción en laboratorio/)).toBeVisible();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "EP-23" } });
  expect(screen.getByText(/Paciente ficticio · EP-23/)).toBeVisible();
});

it("distingue un inicio historico registrado de una espera aun pendiente", async () => {
  const value = structuredClone(model);
  value.patients[0].attention[0].wait.minutes = null;
  setup(value); render(<Harness />);
  fireEvent.click(await screen.findByText(/Paciente ficticio · EP-23/));
  expect(screen.getByText(/Medicina: Registrado · duración de espera no disponible/)).toBeVisible();
  fireEvent.change(screen.getByLabelText("Fase pendiente"), { target: { value: "DOCTOR" } });
  expect(screen.queryByText(/Paciente ficticio · EP-23/)).not.toBeInTheDocument();
});

it("cuenta pacientes y pagina sin mostrar 21 tarjetas a la vez", async () => {
  const value = structuredClone(model);
  value.patients = Array.from({ length: 21 }, (_, index) => ({ ...structuredClone(model.patients[0]), episode_id: index + 1, name: `Ficticio ${index + 1}` }));
  setup(value); render(<Harness />); await screen.findByText(/Ficticio 1 · EP-1/);
  expect(screen.getAllByText(/Ficticio \d+ · EP-/)).toHaveLength(20);
  expect(screen.queryByText(/Ficticio 21 · EP-21/)).not.toBeInTheDocument();
  const stats = within(screen.getByRole("region", { name: "Pacientes con pendientes por fase" }));
  expect(stats.getAllByText("21")).toHaveLength(2); // Nursing and medical review, never one per analytical row.
  fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
  expect(screen.getByText(/Ficticio 21 · EP-21/)).toBeVisible();
});

it("retira datos tras una denegacion de acceso y permite reintentar", async () => {
  const fetchMock = setup(); render(<Harness />); await screen.findByText(/Paciente ficticio · EP-23/);
  fetchMock.mockImplementationOnce(async () => response({ detail: "Permiso retirado" }, 403));
  fireEvent.click(screen.getByRole("button", { name: "Actualizar tablero" }));
  await screen.findByText(/Ya no tienes acceso/);
  expect(screen.queryByText(/Paciente ficticio · EP-23/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Actualizar tablero" }));
  await screen.findByText(/Paciente ficticio · EP-23/);
});

it("conserva datos anteriores con aviso si falla la actualizacion", async () => {
  const fetchMock = setup(); render(<Harness />); await screen.findByText(/Paciente ficticio · EP-23/);
  fetchMock.mockImplementationOnce(async () => { throw new Error("Conexion ficticia interrumpida"); });
  fireEvent.click(screen.getByRole("button", { name: "Actualizar tablero" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("alert")).toHaveTextContent("pueden estar desactualizados");
  expect(screen.getByText(/Paciente ficticio · EP-23/)).toBeVisible();
});

it("no muestra datos a una cuenta sin permiso ni aplica una lectura tras salir", async () => {
  const fetchMock = setup(); const view = render(<Harness person={{ ...user, can_coordinate: false }} />);
  expect(screen.getByRole("alert")).toBeVisible(); expect(fetchMock).not.toHaveBeenCalled();
  let finish!: (value: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  view.rerender(<Harness />); await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  view.rerender(<Harness person={{ ...user, can_coordinate: false }} />);
  await act(async () => { finish(response(model)); });
  expect(screen.queryByText(/Paciente ficticio · EP-23/)).not.toBeInTheDocument();
});

it("actualiza cada 15 segundos y no consulta con la pestana oculta", async () => {
  vi.useFakeTimers();
  const fetchMock = setup();
  await act(async () => { render(<Harness />); });
  expect(screen.getByText(/Paciente ficticio · EP-23/)).toBeVisible();
  const before = fetchMock.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  expect(fetchMock.mock.calls.length).toBe(before + 1);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
  expect(fetchMock.mock.calls.length).toBe(before + 1);
  vi.restoreAllMocks();
});
