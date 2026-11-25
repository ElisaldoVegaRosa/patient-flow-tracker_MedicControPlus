import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PatientEpisodeHistory from "./PatientEpisodeHistory";
import { establishSession } from "../api/client";
import type { Episode, PatientEpisodeHistoryData } from "../types/clinical";

const source: Episode = { id: 42, patient_id: 7, name: "Paciente ficticio", document: "HISTORY-UI", birth_date: "1990-01-01",
  status: "ACTIVE", priority: 3, location: "Consulta", qr_token: "history-qr", started_at: "2026-11-24T12:00:00Z",
  vitals: [], tasks: [], alerts: [], events: [] };
const user = { username: "medico", role: "DOCTOR" };
const row = (id: number): PatientEpisodeHistoryData["episodes"][number] => ({ id, status: id === 19 ? "ANNULLED" : "CLOSED",
  priority: 3, location: "Consulta", started_at: "2026-11-01T13:00:00Z", closed_at: "2026-11-02T14:00:00Z",
  consultation_reason: id === 20 ? null : id === 21 ? "Motivo ficticio\n<script>solo texto</script>" : `Motivo ficticio EP-${id}` });
const body = (offset = 0, episodeId = 42, patientId = 7): PatientEpisodeHistoryData => ({
  source_episode_id: episodeId, patient_id: patientId, requested_by: "medico", total: 6, offset, limit: 5,
  episodes: (offset === 0 ? [21, 20, 19, 18, 17] : [16]).map(row),
});
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response;
const consult = () => screen.getByRole("button", { name: "Consultar historial del paciente" });

describe("Historial por ficha desde el episodio", () => {
  beforeEach(() => establishSession("historial-ficticio"));
  afterEach(() => vi.unstubAllGlobals());

  it("consulta solo al pedirlo, muestra motivos y horas dominicanas y abre el episodio elegido", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response(body()));
    vi.stubGlobal("fetch", fetchMock);
    const open = vi.fn();
    render(<PatientEpisodeHistory episode={source} user={user} onOpenEpisode={open} />);
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.click(consult());
    await screen.findByRole("heading", { name: "EP-21 · Cerrado" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/episodes/42/patient-history?limit=5&offset=0");
    expect(screen.getByText("Mostrando 1–5 de 6 episodios.")).toBeVisible();
    const first = screen.getByRole("heading", { name: "EP-21 · Cerrado" }).closest("article")!;
    expect(first.textContent).toContain("Motivo ficticio\n<script>solo texto</script>");
    expect(first.querySelector("script")).toBeNull();
    expect(within(first).getByText("Ingreso: 01/11/2026, 09:00 a. m.")).toBeVisible();
    const missing = screen.getByRole("heading", { name: "EP-20 · Cerrado" }).closest("article")!;
    expect(missing).toHaveTextContent("Motivo de consulta: No registrado");
    expect(screen.getByRole("heading", { name: "EP-19 · Anulado" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Abrir episodio EP-21" }));
    expect(open).toHaveBeenCalledExactlyOnceWith(21);
  });

  it("pagina sin mezclar las filas y actualizar vuelve al inicio", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async input => {
      const offset = Number(new URL(String(input)).searchParams.get("offset"));
      return response(body(offset));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<PatientEpisodeHistory episode={source} user={user} />);
    await userEvent.click(consult());
    await screen.findByRole("heading", { name: "EP-21 · Cerrado" });
    expect(screen.getByRole("button", { name: "Página anterior del historial del paciente" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Página siguiente del historial del paciente" }));
    await screen.findByRole("heading", { name: "EP-16 · Cerrado" });
    expect(screen.queryByRole("heading", { name: "EP-21 · Cerrado" })).not.toBeInTheDocument();
    expect(screen.getByText("Mostrando 6–6 de 6 episodios.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Página siguiente del historial del paciente" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Actualizar historial del paciente" }));
    await screen.findByRole("heading", { name: "EP-21 · Cerrado" });
    expect(new URL(String(fetchMock.mock.calls.at(-1)![0])).searchParams.get("offset")).toBe("0");
  });

  it("un guardado pendiente permite leer pero bloquea abrir otro episodio", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response(body()));
    vi.stubGlobal("fetch", fetchMock);
    const open = vi.fn();
    const view = render(<PatientEpisodeHistory episode={source} user={user} openingBlocked onOpenEpisode={open} />);
    await userEvent.click(consult());
    await screen.findByRole("heading", { name: "EP-21 · Cerrado" });
    const link = screen.getByRole("button", { name: "Abrir episodio EP-21" });
    expect(link).toBeDisabled();
    await userEvent.click(link);
    expect(open).not.toHaveBeenCalled();
    view.rerender(<PatientEpisodeHistory episode={source} user={user} onOpenEpisode={open} />);
    await userEvent.click(link);
    expect(open).toHaveBeenCalledWith(21);
  });

  it.each(["RECEPTION", "DOCTOR", "SUPERVISOR"])("permite consultar a %s sin enviar escrituras", async role => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response({ ...body(), total: 0, episodes: [] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<PatientEpisodeHistory episode={source} user={{ ...user, role }} />);
    await userEvent.click(consult());
    await screen.findByText("No hay otros episodios cerrados o anulados en esta ficha.");
    expect(fetchMock.mock.calls[0][1]?.method).toBeUndefined();
    expect(screen.queryByRole("button", { name: /Página siguiente/ })).not.toBeInTheDocument();
  });

  it.each(["NURSE", "LAB", "ADMISSION", "ACCOUNT_ADMIN"])("%s no obtiene acceso por el nuevo control", role => {
    const fetchMock = vi.fn<typeof fetch>(); vi.stubGlobal("fetch", fetchMock);
    render(<PatientEpisodeHistory episode={source} user={{ ...user, role }} />);
    expect(screen.queryByRole("region", { name: "Historial del paciente" })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("un error permite reintentar sin mostrar datos incompletos", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(response(body()));
    vi.stubGlobal("fetch", fetchMock);
    render(<PatientEpisodeHistory episode={source} user={user} />);
    await userEvent.click(consult());
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo consultar el historial del paciente");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar historial del paciente" }));
    await screen.findByRole("heading", { name: "EP-21 · Cerrado" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("retira las filas anteriores si el servidor rechaza la actualización", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(response(body()))
      .mockResolvedValueOnce(response({ detail: "Sin permiso" }, 403));
    vi.stubGlobal("fetch", fetchMock);
    render(<PatientEpisodeHistory episode={source} user={user} />);
    await userEvent.click(consult());
    await screen.findByRole("heading", { name: "EP-21 · Cerrado" });
    await userEvent.click(screen.getByRole("button", { name: "Actualizar historial del paciente" }));
    await screen.findByRole("alert");
    expect(screen.queryByRole("heading", { name: "EP-21 · Cerrado" })).not.toBeInTheDocument();
  });

  it("permite volver al inicio si la página queda vacía al cambiar los episodios", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(response(body()))
      .mockResolvedValueOnce(response({ ...body(5), total: 3, episodes: [] }))
      .mockResolvedValueOnce(response({ ...body(), total: 3, episodes: [row(21), row(20), row(19)] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<PatientEpisodeHistory episode={source} user={user} />);
    await userEvent.click(consult());
    await screen.findByRole("heading", { name: "EP-21 · Cerrado" });
    await userEvent.click(screen.getByRole("button", { name: "Página siguiente del historial del paciente" }));
    await screen.findByText("Esta página ya no contiene episodios. Actualiza o vuelve a la página anterior.");
    await userEvent.click(screen.getByRole("button", { name: "Actualizar historial del paciente" }));
    await screen.findByText("Mostrando 1–3 de 3 episodios.");
  });

  it.each(["source", "patient"])("rechaza una respuesta de otro contexto: %s", mismatch => {
    const result = body(0, mismatch === "source" ? 99 : 42, mismatch === "patient" ? 99 : 7);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response(result));
    vi.stubGlobal("fetch", fetchMock);
    render(<PatientEpisodeHistory episode={source} user={user} />);
    fireEvent.click(consult());
    return screen.findByRole("alert").then(() => {
      expect(screen.queryByRole("heading", { name: "EP-21 · Cerrado" })).not.toBeInTheDocument();
    });
  });

  it("un cambio de episodio cancela la lectura anterior y no revela su respuesta tardía", async () => {
    let finish!: (value: Response) => void;
    const fetchMock = vi.fn<typeof fetch>().mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }))
      .mockResolvedValueOnce(response({ ...body(0, 43, 8), total: 1, episodes: [row(31)] }));
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<PatientEpisodeHistory episode={source} user={user} />);
    await userEvent.click(consult());
    view.rerender(<PatientEpisodeHistory episode={{ ...source, id: 43, patient_id: 8 }} user={user} />);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    await userEvent.click(consult());
    await screen.findByRole("heading", { name: "EP-31 · Cerrado" });
    await act(async () => finish(response(body())));
    expect(screen.getByRole("heading", { name: "EP-31 · Cerrado" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "EP-21 · Cerrado" })).not.toBeInTheDocument();
  });

  it("no consulta una ficha ausente y retira la información al perder el permiso", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response(body()));
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<PatientEpisodeHistory episode={{ ...source, patient_id: undefined }} user={user} />);
    expect(screen.queryByRole("region", { name: "Historial del paciente" })).not.toBeInTheDocument();
    view.rerender(<PatientEpisodeHistory episode={source} user={user} />);
    await userEvent.click(consult());
    await screen.findByRole("heading", { name: "EP-21 · Cerrado" });
    view.rerender(<PatientEpisodeHistory episode={source} user={{ ...user, role: "NURSE" }} />);
    expect(screen.queryByRole("heading", { name: "EP-21 · Cerrado" })).not.toBeInTheDocument();
  });
});
