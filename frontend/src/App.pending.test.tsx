import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import { establishSession } from "./api/client";
import type { Episode, LaboratoryQueue } from "./types/clinical";

const episode: Episode = { id: 53, name: "Paciente ficticio 53A", birth_date: "1990-01-01", document: "TEST-53A", qr_token: "qr-53a", status: "ACTIVE", priority: 3, location: "Recepci\u00f3n", started_at: "2026-10-11T12:00:00Z", vitals: [], alerts: [], tasks: [], events: [] };
const queue: LaboratoryQueue = { total: 2, status_filter: "PENDING", requested_by: "demo", orders: [1, 2].map(id => ({ id, episode_id: 53, title: `Orden ficticia ${id}`, service: "LAB", status: "PENDING", result: null, created_at: "2026-10-11T12:00:00Z", patient_name: episode.name, priority: 3, location: "Triaje", episode_status: "ACTIVE" })) };
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response;
const flows = [
  { key: "arrival", role: "RECEPTION", nav: "Nuevo ingreso", button: "Crear episodio y pulsera", pending: "Registrando llegada\u2026", path: "/episodes", fields: [["Nombre completo", episode.name], ["Fecha de nacimiento", episode.birth_date], ["Documento", episode.document]], payload: { name: episode.name, birth_date: episode.birth_date, document: episode.document, priority: 3, location: episode.location }, success: episode },
  { key: "lab", role: "LAB", nav: "Bandeja de laboratorio", button: "Publicar resultado y completar", pending: "Publicando resultado\u2026", path: "/tasks/1/complete", fields: [["Resultado de laboratorio", "Resultado ficticio 53A"]], payload: { result: "Resultado ficticio 53A" }, success: episode },
  { key: "demo", role: "SUPERVISOR", nav: "Panel de supervisor", button: "Cargar datos de demostraci\u00f3n", pending: "Cargando datos\u2026", path: "/demo/seed", fields: [], payload: null, success: { message: "Demo ficticio", created: 0, existing: 12 } },
  { key: "rules", role: "SUPERVISOR", nav: "Panel de supervisor", button: "Evaluar reglas temporales", pending: "Evaluando reglas temporales", path: "/rules/evaluate", fields: [], payload: null, success: { evaluated_episodes: 1, generated_alerts: 0 } },
];
async function setup(flow: typeof flows[number]) {
  establishSession("test-token");
  const writes = vi.fn();
  let currentQueue = queue;
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (init?.method && init.method !== "GET") return writes(path, init);
    const data: Record<string, unknown> = {
      "/auth/me": { username: "demo", role: flow.role },
      "/dashboard": { active: 0, open_alerts: 0, patients: [], requested_by: "demo" },
      "/supervisor/dashboard": { metrics: { active_patients: 0, high_priority_patients: 0, patients_at_risk: 0, open_alerts: 0, pending_tasks: 0 }, rules: { evaluated_episodes: 0, generated_alerts: 0 }, patients: [], generated_at: "2026-10-11T12:00:00Z", requested_by: "demo" },
      "/lab/orders": currentQueue,
      "/scan/qr-53a": { ...episode, tasks: queue.orders.map(order => ({ ...order, title: order.title })) },
    };
    if (!(path in data)) throw new Error(`Unexpected GET ${path}`);
    return Promise.resolve(response(data[path]));
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(window, "alert").mockImplementation(() => {});
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: flow.nav }));
  await screen.findAllByRole("button", { name: flow.button });
  const scope = flow.key === "lab" ? within(screen.getByText("Orden ficticia 1").closest("article")!) : screen;
  for (const [label, value] of flow.fields) fireEvent.change(scope.getByLabelText(label), { target: { value } });
  const button = scope.getByRole("button", { name: flow.button });
  const submit = () => button.closest("form") ? fireEvent.submit(button.closest("form")!) : fireEvent.click(button);
  return { writes, scope, button, submit, setQueue: (value: LaboratoryQueue) => { currentQueue = value; } };
}
afterEach(() => vi.unstubAllGlobals());

it("comparte el bloqueo de laboratorio al abrir el episodio", async () => {
  const { writes, submit } = await setup(flows[1]);
  let resolve!: (value: Response) => void;
  writes.mockReturnValueOnce(new Promise<Response>(done => { resolve = done; }));
  submit();
  fireEvent.click(screen.getByRole("button", { name: "Escanear pulsera" }));
  fireEvent.change(screen.getByPlaceholderText("Token de la pulsera"), { target: { value: episode.qr_token } });
  fireEvent.click(screen.getByRole("button", { name: "Identificar paciente" }));
  await screen.findByRole("heading", { name: episode.name });
  expect(screen.getByRole("button", { name: "Completando\u2026" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Completar" })).toBeEnabled();
  expect(writes).toHaveBeenCalledTimes(1);
  resolve(response({ detail: "Error ficticio" }, 422));
  await waitFor(() => expect(screen.getAllByRole("button", { name: "Completar" })).toHaveLength(2));
});

it("cerrar sesion bloquea dos eventos antes del siguiente render", async () => {
  const { writes } = await setup(flows[0]);
  let resolve!: (value: Response) => void;
  writes.mockReturnValueOnce(new Promise<Response>(done => { resolve = done; }));
  const button = screen.getByRole("button", { name: "Salir" });
  act(() => { fireEvent.click(button); fireEvent.click(button); });
  expect(writes).toHaveBeenCalledTimes(1);
  expect(writes.mock.calls[0][0]).toBe("/auth/logout");
  await screen.findByRole("button", { name: "Entrar" });
  await act(async () => { resolve(response({ message: "ok" })); });
});

it.each(flows)("$key bloquea duplicados, conserva payload y completa con exito", async flow => {
  const { writes, scope, button, submit, setQueue } = await setup(flow);
  let resolve!: (value: Response) => void;
  writes.mockReturnValueOnce(new Promise<Response>(done => { resolve = done; }));
  act(() => { submit(); submit(); });
  expect(writes).toHaveBeenCalledTimes(1);
  expect(button).toBeDisabled();
  expect(button).toHaveTextContent(flow.pending);
  for (const [label, value] of flow.fields) {
    expect(scope.getByLabelText(label)).toBeDisabled();
    expect(scope.getByLabelText(label)).toHaveValue(value);
  }
  expect(writes.mock.calls[0][0]).toBe(flow.path);
  if (flow.payload) expect(JSON.parse(writes.mock.calls[0][1].body)).toEqual(flow.payload);
  if (flow.key === "lab") setQueue({ ...queue, total: 1, orders: [queue.orders[1]] });
  resolve(response(flow.success));
  if (flow.key === "arrival") await screen.findByRole("heading", { name: episode.name });
  else if (flow.key === "lab") await waitFor(() => expect(screen.queryByText("Orden ficticia 1")).not.toBeInTheDocument());
  else await waitFor(() => expect(button).toBeEnabled());
});

it.each(flows.flatMap(flow => ["API", "red", "401"].map(failure => ({ flow, failure }))))("$flow.key libera tras $failure sin reenviar automaticamente", async ({ flow, failure }) => {
  const { writes, scope, button, submit } = await setup(flow);
  if (failure === "red") writes.mockRejectedValueOnce(new Error("Fallo ficticio 53A"));
  else writes.mockResolvedValueOnce(response({ detail: "Fallo ficticio 53A" }, failure === "401" ? 401 : 422));
  submit();
  if (failure === "401") {
    await screen.findByRole("button", { name: "Entrar" });
    expect(localStorage.getItem("token")).toBeNull();
  } else {
    await screen.findByText(/Fallo ficticio 53A/);
    expect(button).toBeEnabled();
    for (const [label, value] of flow.fields) expect(scope.getByLabelText(label)).toHaveValue(value);
    writes.mockResolvedValueOnce(response(flow.success));
    submit();
    await waitFor(() => expect(writes).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText(flow.pending)).not.toBeInTheDocument());
  }
  expect(writes).toHaveBeenCalledTimes(failure === "401" ? 1 : 2);
});

it("cancelar carga demo libera el bloqueo sin enviar", async () => {
  const { writes, button, submit } = await setup(flows[2]);
  vi.mocked(window.confirm).mockReturnValueOnce(false);
  submit();
  expect(writes).not.toHaveBeenCalled();
  expect(button).toBeEnabled();
  writes.mockResolvedValueOnce(response(flows[2].success));
  submit();
  await waitFor(() => expect(button).toBeEnabled());
  expect(writes).toHaveBeenCalledTimes(1);
});

it("laboratorio mantiene dos ordenes y desbloqueos independientes", async () => {
  const { writes, button, submit } = await setup(flows[1]);
  let resolve!: (value: Response) => void;
  writes.mockReturnValueOnce(new Promise<Response>(done => { resolve = done; }));
  submit();
  const second = within(screen.getByText("Orden ficticia 2").closest("article")!);
  fireEvent.change(second.getByLabelText("Resultado de laboratorio"), { target: { value: "Resultado segundo" } });
  const secondButton = second.getByRole("button", { name: flows[1].button });
  expect(secondButton).toBeEnabled();
  writes.mockResolvedValueOnce(response(episode));
  fireEvent.submit(secondButton.closest("form")!);
  await waitFor(() => expect(secondButton).toBeEnabled());
  expect(button).toBeDisabled();
  resolve(response(episode));
  await waitFor(() => expect(button).toBeEnabled());
});

it.each(["exito", "API", "red"])("login bloquea duplicados y libera tras %s", async outcome => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  const button = screen.getByRole("button", { name: "Entrar" });
  const form = button.closest("form")!;
  let resolve!: (value: Response) => void;
  let reject!: (reason: Error) => void;
  fetchMock.mockReturnValueOnce(new Promise<Response>((done, fail) => { resolve = done; reject = fail; }));
  act(() => { fireEvent.submit(form); fireEvent.submit(form); });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(button).toBeDisabled();
  expect(screen.getByLabelText("Usuario")).toBeDisabled();
  expect(screen.getByLabelText("Contrase\u00f1a")).toBeDisabled();
  if (outcome === "red") reject(new Error("Login ficticio fallido"));
  else if (outcome === "API") resolve(response({ detail: "Login ficticio fallido" }, 401));
  else {
    fetchMock.mockResolvedValue(response({ active: 0, open_alerts: 0, patients: [], requested_by: "demo" }));
    resolve(response({ username: "demo", role: "RECEPTION", access_token: "new-test-token" }));
  }
  if (outcome === "exito") await screen.findByRole("heading", { name: "Centro de control" });
  else {
    await screen.findByText("Login ficticio fallido");
    expect(button).toBeEnabled();
    expect(screen.getByLabelText("Contrase\u00f1a")).toHaveValue("demo123");
  }
});
