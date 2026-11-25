import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { Episode, PatientEpisodeHistoryData } from "./types/clinical";

vi.mock("./components/EpisodePresence", () => ({ default: () => null }));

const current: Episode = { id: 42, patient_id: 7, name: "Paciente historial ficticio", document: "HISTORY-APP", birth_date: "1990-01-01",
  status: "ACTIVE", priority: 3, location: "Consulta", qr_token: "history-app-qr", started_at: "2026-11-24T12:00:00Z",
  consultation_reason: "Motivo actual ficticio", consultation_reason_version: '"reason-42"', clinical_version: '"clinical-42"',
  vitals: [], tasks: [], alerts: [], events: [] };
const previous: Episode = { ...current, id: 10, status: "CLOSED", closed_at: "2026-11-01T14:00:00Z", consultation_reason: "Motivo anterior ficticio" };
const history: PatientEpisodeHistoryData = { source_episode_id: 42, patient_id: 7, total: 1, offset: 0, limit: 5, requested_by: "medico",
  episodes: [{ id: 10, status: "CLOSED", priority: 3, location: "Consulta", started_at: "2026-11-01T12:00:00Z",
    closed_at: "2026-11-01T14:00:00Z", consultation_reason: "Motivo anterior ficticio" }] };
const response = (data: unknown) => ({ ok: true, status: 200, json: async () => data }) as Response;

async function setup(role = "DOCTOR") {
  localStorage.setItem("token", "historial-ficticio");
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(async input => {
    const path = new URL(String(input)).pathname;
    if (path === "/auth/me") return response({ username: role === "RECEPTION" ? "recepcion" : "medico", role });
    if (path === "/dashboard") return response({ active: 1, open_alerts: 0, patients: [{ ...current, open_alert_count: 0, pending_task_count: 0 }], requested_by: "demo" });
    if (path === "/episodes/42") return response(current);
    if (path === "/episodes/42/patient-history") return response(history);
    if (path === "/episodes/10") return response(previous);
    throw new Error(`Petición inesperada: ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole("button", { name: "Abrir" }));
  await screen.findByText(/Episodio EP-42/);
  return { user, fetchMock };
}
const openedPrevious = (fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) => fetchMock.mock.calls.some(([input]) => new URL(String(input)).pathname === "/episodes/10");

describe("Abrir un episodio histórico desde el paciente", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("permite leer el historial sin perder la evaluación y exige decidir antes de navegar", async () => {
    const { user, fetchMock } = await setup();
    fireEvent.change(screen.getByLabelText("Diagnóstico o impresión clínica"), { target: { value: "Diagnostico ficticio sin guardar" } });
    fireEvent.change(screen.getByLabelText("Nota de evaluación"), { target: { value: "Nota ficticia que debe conservarse" } });
    await user.click(screen.getByRole("button", { name: "Consultar historial del paciente" }));
    await screen.findByRole("heading", { name: "EP-10 · Cerrado" });
    expect(screen.getByLabelText("Nota de evaluación")).toHaveValue("Nota ficticia que debe conservarse");
    await user.click(screen.getByRole("button", { name: "Abrir episodio EP-10" }));
    expect(await screen.findByRole("dialog", { name: "Cambios médicos sin guardar" })).toBeVisible();
    expect(openedPrevious(fetchMock)).toBe(false);
    await user.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(screen.getByLabelText("Diagnóstico o impresión clínica")).toHaveValue("Diagnostico ficticio sin guardar");
    await user.click(screen.getByRole("button", { name: "Abrir episodio EP-10" }));
    await user.click(screen.getByRole("button", { name: "Descartar y salir" }));
    await screen.findByText(/Episodio EP-10/);
    expect(openedPrevious(fetchMock)).toBe(true);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST" || init?.method === "PATCH")).toBe(false);
  });

  it("respeta el aviso de una corrección operativa sin guardar", async () => {
    const { user, fetchMock } = await setup("RECEPTION");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await user.click(screen.getByText("Corregir motivo de consulta"));
    fireEvent.change(screen.getByLabelText("Motivo de consulta corregido"), { target: { value: "Edicion ficticia sin guardar" } });
    await user.click(screen.getByRole("button", { name: "Consultar historial del paciente" }));
    await screen.findByRole("heading", { name: "EP-10 · Cerrado" });
    await user.click(screen.getByRole("button", { name: "Abrir episodio EP-10" }));
    expect(confirm).toHaveBeenCalledWith("Hay una corrección o motivo sin guardar. ¿Descartar esos campos y salir?");
    expect(openedPrevious(fetchMock)).toBe(false);
    expect(screen.getByLabelText("Motivo de consulta corregido")).toHaveValue("Edicion ficticia sin guardar");
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Abrir episodio EP-10" }));
    await screen.findByText(/Episodio EP-10/);
    expect(screen.queryByText("Corregir motivo de consulta")).not.toBeInTheDocument();
  });

  it("una respuesta tardía no cambia la última visita elegida", async () => {
    const { user, fetchMock } = await setup();
    const original = fetchMock.getMockImplementation()!;
    let finish!: (value: Response) => void;
    fetchMock.mockImplementation(async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === "/episodes/42/patient-history") return response({ ...history, total: 2, episodes: [history.episodes[0], { ...history.episodes[0], id: 11 }] });
      if (path === "/episodes/10") return new Promise<Response>(resolve => { finish = resolve; });
      if (path === "/episodes/11") return response({ ...previous, id: 11 });
      return original(input, init);
    });
    await user.click(screen.getByRole("button", { name: "Consultar historial del paciente" }));
    await screen.findByRole("heading", { name: "EP-10 · Cerrado" });
    await user.click(screen.getByRole("button", { name: "Abrir episodio EP-10" }));
    await user.click(screen.getByRole("button", { name: "Abrir episodio EP-11" }));
    await screen.findByText(/Episodio EP-11/);
    await act(async () => finish(response(previous)));
    expect(screen.queryByText(/Episodio EP-10/)).not.toBeInTheDocument();
    expect(screen.getByText(/Episodio EP-11/)).toBeVisible();
  });

  it("una respuesta tardía no vuelve al episodio tras salir al centro de control", async () => {
    const { user, fetchMock } = await setup();
    const original = fetchMock.getMockImplementation()!;
    let finish!: (value: Response) => void;
    fetchMock.mockImplementation(async (input, init) => new URL(String(input)).pathname === "/episodes/10"
      ? new Promise<Response>(resolve => { finish = resolve; }) : original(input, init));
    await user.click(screen.getByRole("button", { name: "Consultar historial del paciente" }));
    await screen.findByRole("heading", { name: "EP-10 · Cerrado" });
    await user.click(screen.getByRole("button", { name: "Abrir episodio EP-10" }));
    await user.click(screen.getByRole("button", { name: "Centro de control" }));
    await act(async () => finish(response(previous)));
    expect(screen.getByRole("heading", { name: "Centro de control" })).toBeVisible();
    expect(screen.queryByText(/Episodio EP-10/)).not.toBeInTheDocument();
  });

  it("elegir seguir editando cancela una apertura anterior todavía pendiente", async () => {
    const { user, fetchMock } = await setup("RECEPTION");
    const original = fetchMock.getMockImplementation()!;
    let finish!: (value: Response) => void;
    fetchMock.mockImplementation(async (input, init) => new URL(String(input)).pathname === "/episodes/10"
      ? new Promise<Response>(resolve => { finish = resolve; }) : original(input, init));
    await user.click(screen.getByRole("button", { name: "Consultar historial del paciente" }));
    await screen.findByRole("heading", { name: "EP-10 · Cerrado" });
    await user.click(screen.getByRole("button", { name: "Abrir episodio EP-10" }));
    await user.click(screen.getByText("Corregir motivo de consulta"));
    fireEvent.change(screen.getByLabelText("Motivo de consulta corregido"), { target: { value: "Edicion posterior a la apertura pendiente" } });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await user.click(screen.getByRole("button", { name: "Centro de control" }));
    await act(async () => finish(response(previous)));
    expect(screen.getByText(/Episodio EP-42/)).toBeVisible();
    expect(screen.getByLabelText("Motivo de consulta corregido")).toHaveValue("Edicion posterior a la apertura pendiente");
  });

  it("bloquea cambiar de episodio mientras se confirma una evaluación médica", async () => {
    const { user, fetchMock } = await setup();
    const original = fetchMock.getMockImplementation()!;
    let finish!: (value: Response) => void;
    fetchMock.mockImplementation(async (input, init) => new URL(String(input)).pathname === "/episodes/42/medical-evaluation"
      ? new Promise<Response>(resolve => { finish = resolve; }) : original(input, init));
    await user.click(screen.getByRole("button", { name: "Consultar historial del paciente" }));
    await screen.findByRole("heading", { name: "EP-10 · Cerrado" });
    fireEvent.change(screen.getByLabelText("Diagnóstico o impresión clínica"), { target: { value: "Diagnostico ficticio" } });
    fireEvent.change(screen.getByLabelText("Nota de evaluación"), { target: { value: "Nota ficticia para comprobar guardado pendiente" } });
    await user.click(screen.getByRole("button", { name: "Guardar evaluación médica" }));
    const link = screen.getByRole("button", { name: "Abrir episodio EP-10" });
    expect(link).toBeDisabled();
    await user.click(link);
    expect(openedPrevious(fetchMock)).toBe(false);
    await act(async () => finish(response(current)));
    expect(link).toBeEnabled();
    expect(screen.getByText("Evaluación guardada")).toBeVisible();
  });
});
