import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import { establishSession, SESSION_EXPIRED_EVENT } from "./api/client";
import { readSpecimenDraft } from "./session/specimenDrafts";
import type { LaboratoryQueue } from "./types/clinical";

const fresh = (): LaboratoryQueue => ({ status_filter: "PENDING", total: 1, requested_by: "lab.demo", orders: [{
  id: 3, episode_id: 22, title: "Orden ficticia", service: "LAB", status: "PENDING", result: null,
  created_at: "2026-10-01T12:00:00Z", patient_name: "Paciente ficticio", priority: 3, location: "Observación", episode_status: "ACTIVE", workflow: "STRUCTURED",
  laboratory: { status: "PENDING", processing_context: "ACTIVE", published_results: 0, pending_results: 1, pending_reviews: 0, cancelled_analyses: 0, analyses: [],
    specimens: [{ id: 1, version: '"v1"', kind: "URINE", kind_description: null, collected_at: null, delivered_at: null, received_at: null, suitability: "UNKNOWN", assessed_at: null, analysis_ids: [1], historical_analysis_ids: [] }] },
}] });
const response = (data: unknown) => ({ ok: true, status: 200, json: async () => data }) as Response;
afterEach(() => vi.unstubAllGlobals());

async function open() {
  const user = userEvent.setup();
  await screen.findByRole("heading", { name: "Centro de control" });
  await user.click(screen.getByRole("button", { name: "Bandeja de laboratorio" }));
  const summary = await screen.findByText("Confirmar recepción", { selector: "summary" });
  const section = summary.closest("section")!;
  fireEvent.click(section.querySelector("details > summary")!); fireEvent.click(summary);
  return within(summary.closest("details")!);
}
function setup() {
  establishSession("token-ficticio");
  const queue = fresh();
  const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    if (path === "/auth/me") return response({ username: "lab.demo", role: "LAB" });
    if (path === "/auth/logout") return response({ message: "Sesión finalizada", username: "lab.demo" });
    if (path === "/dashboard") return response({ active: 0, open_alerts: 0, patients: [], requested_by: "lab.demo" });
    if (path === "/lab/orders") return response(JSON.parse(JSON.stringify(queue)));
    if (path === "/lab/sample-professionals") return response({ professionals: [] });
    if (path === "/lab/specimens/1/receipt" && init?.method === "POST") {
      queue.orders[0].laboratory!.specimens[0].received_at = "2026-10-01T12:00:00Z";
      queue.orders[0].laboratory!.specimens[0].version = '"v2"';
      return response({ id: 22, status: "ACTIVE", tasks: [], events: [], alerts: [], vitals: [] });
    }
    if (path === "/lab/specimens/1/repeat" && init?.method === "POST") {
      const lab = queue.orders[0].laboratory!;
      lab.specimens[0] = { ...lab.specimens[0], version: '"v2"', analysis_ids: [], historical_analysis_ids: [1] };
      lab.specimens.push({ ...lab.specimens[0], id: 2, version: '"new"', analysis_ids: [1], historical_analysis_ids: [], received_at: null, suitability: "UNKNOWN" });
      return response({ id: 22, status: "ACTIVE", tasks: [], events: [], alerts: [], vitals: [] });
    }
    throw new Error(`Ruta inesperada ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { queue, fetchMock };
}

it("confirma recepción desde bandeja, actualiza datos y limpia solo el formulario confirmado", async () => {
  const { fetchMock } = setup(); render(<App />); const f = await open();
  fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Recepción ficticia" } });
  fireEvent.click(f.getByRole("button", { name: "Confirmar recepción" }));
  await screen.findByText("Registro de muestra confirmado por el servidor.");
  await screen.findByText("Confirmar recepción · Ya registrado", { selector: "summary" });
  expect(f.getByLabelText("Motivo")).toHaveValue("");
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
});

function prepareRepeat(queue: LaboratoryQueue) {
  const lab = queue.orders[0].laboratory!;
  lab.specimens[0].suitability = "REJECTED";
  lab.analyses = [{ id: 1, title: "Analítica ficticia", version: '"a1"', cancelled_at: null, cancellation_reason: null,
    has_result: false, current_result: null, result_annulled: false, result_sequence: null,
    needs_medical_review: false, reviewed_at: null, satisfies_current_samples: false }];
}
async function repeatForm() {
  await open();
  const summary = screen.getByText("Solicitar nueva muestra", { selector: "summary" }); fireEvent.click(summary);
  const f = within(summary.closest("details")!);
  fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Nueva muestra ficticia" } });
  fireEvent.click(f.getByLabelText("Analítica ficticia · Analítica #1"));
  return f;
}
it("solicita reemplazo desde bandeja y consulta la muestra nueva sin repetir el envío", async () => {
  const { queue, fetchMock } = setup(); prepareRepeat(queue); render(<App />);
  const f = await repeatForm(); fireEvent.click(f.getByRole("button", { name: "Confirmar solicitud de nueva muestra" }));
  await screen.findByText("Registro de muestra confirmado por el servidor.");
  await screen.findByText("Muestra #2 · Orina", { selector: "summary" });
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
});
it("el conflicto de una repetición consulta versión actual aun con borrador sin guardar", async () => {
  const { queue, fetchMock } = setup(); prepareRepeat(queue); render(<App />);
  const f = await repeatForm(); queue.orders[0].laboratory!.specimens[0].version = '"changed"';
  fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ detail: { code: "version_conflict", message: "Muestra cambiada" } }) } as Response);
  fireEvent.click(f.getByRole("button", { name: "Confirmar solicitud de nueva muestra" }));
  await f.findByRole("button", { name: "He revisado los cambios; usar versión actual" });
  expect(f.getByLabelText("Motivo")).toHaveValue("Nueva muestra ficticia");
  expect(f.getByLabelText("Analítica ficticia · Analítica #1")).toBeChecked();
});

it("conserva el borrador al expirar sesión y exige revisar nueva versión tras volver", async () => {
  const { queue, fetchMock } = setup(); const view = render(<App />); const f = await open();
  fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Borrador conservado" } });
  await act(async () => window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)));
  await screen.findByRole("button", { name: "Entrar" });
  view.unmount();
  queue.orders[0].laboratory!.specimens[0].version = '"v2"'; establishSession("otra-sesion-ficticia");
  render(<App />); const recovered = await open();
  expect(recovered.getByLabelText("Motivo")).toHaveValue("Borrador conservado");
  expect(recovered.getByRole("button", { name: "Confirmar recepción" })).toBeDisabled();
  await waitFor(() => expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0));
});

it("reintenta el envío incierto con la misma clave y cuerpo sin borrar un texto posterior", async () => {
  const { fetchMock } = setup(); render(<App />); const f = await open();
  fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Motivo original" } });
  fetchMock.mockRejectedValueOnce(new Error("Fallo ficticio de conexión"));
  fireEvent.click(f.getByRole("button", { name: "Confirmar recepción" }));
  await screen.findByRole("heading", { name: "Muestra #1 · Recepción" });
  fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Nota posterior conservada" } });
  fireEvent.click(screen.getByRole("button", { name: "Reintentar operación original" }));
  await screen.findByText("Registro de muestra confirmado por el servidor.");
  const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
  expect(posts).toHaveLength(2);
  expect(posts[0][1]?.body).toBe(posts[1][1]?.body);
  expect(new Headers(posts[0][1]?.headers).get("Idempotency-Key")).toBe(new Headers(posts[1][1]?.headers).get("Idempotency-Key"));
  expect(f.getByLabelText("Motivo")).toHaveValue("Nota posterior conservada");
});

it("el cierre de sesión explícito elimina los borradores de muestra", async () => {
  setup(); render(<App />); const f = await open();
  fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Borrador para descartar" } });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: "Salir" }));
  await screen.findByRole("button", { name: "Entrar" });
  expect(readSpecimenDraft({ username: "lab.demo", role: "LAB" }, "/lab/specimens/1/receipt").draft).toBeUndefined();
});
