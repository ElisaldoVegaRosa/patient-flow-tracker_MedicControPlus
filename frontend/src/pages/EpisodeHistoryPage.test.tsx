import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import EpisodeHistoryPage from "./EpisodeHistoryPage";
import { establishSession } from "../api/client";
import type { HistoryData } from "../types/clinical";

const row = (id: number): HistoryData["episodes"][number] => ({ id, name: `Paciente ficticio ${id}`, document: "DOC-TEST",
  status: "CLOSED", priority: 3, location: "Consulta", assigned_to: null,
  started_at: "2026-11-23T12:00:00Z", closed_at: "2026-11-24T03:30:00Z", event_count: 2, alert_count: 0, task_count: 1 });
const body = (offset = 0, total = 21): HistoryData => ({ total, offset, limit: 20, requested_by: "medico", episodes: total === 0 ? [] : [row(offset + 1)] });
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response;
const box = () => screen.getByRole("searchbox", { name: "Buscar por nombre, documento o episodio" });
const form = () => screen.getByRole("form", { name: "Filtros del historial de episodios" });
const turn = async () => { await act(async () => { await Promise.resolve(); }); };
beforeEach(() => establishSession("general-history-ficticio"));
afterEach(() => vi.unstubAllGlobals());

it("consulta una página al entrar, abre la visita y muestra fecha dominicana en 12 horas", async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response(body()));
  vi.stubGlobal("fetch", fetchMock);
  const open = vi.fn(async () => {});
  render(<EpisodeHistoryPage onOpenEpisode={open} />);
  await screen.findByText("Paciente ficticio 1");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(String(fetchMock.mock.calls[0][0])).toContain("/episodes/history?limit=20&offset=0");
  expect(screen.getByText("23/11/2026, 11:30 p. m.")).toBeVisible();
  expect(screen.getByText("Mostrando 1 de 21 episodios · Página 1.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Ver línea de tiempo" }));
  expect(open).toHaveBeenCalledWith(1);
});

it("aplica filtros solo al solicitarlo, pagina, conserva filtros al actualizar y los limpia", async () => {
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(async input => response(body(Number(new URL(String(input)).searchParams.get("offset")))));
  vi.stubGlobal("fetch", fetchMock);
  render(<EpisodeHistoryPage onOpenEpisode={vi.fn(async () => {})} />);
  await screen.findByText("Paciente ficticio 1");
  fireEvent.change(box(), { target: { value: "  DOC-123  " } });
  fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "ANNULLED" } });
  fireEvent.change(screen.getByLabelText("Cierre desde"), { target: { value: "2026-11-01" } });
  fireEvent.change(screen.getByLabelText("Cierre hasta"), { target: { value: "2026-11-24" } });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.submit(form());
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  const expected = "q=DOC-123&status=ANNULLED&closed_from=2026-11-01&closed_to=2026-11-24&limit=20&offset=";
  expect(String(fetchMock.mock.calls[1][0])).toContain(expected + "0");
  await userEvent.click(await screen.findByRole("button", { name: "Página siguiente" }));
  await screen.findByText("Paciente ficticio 21");
  expect(String(fetchMock.mock.calls[2][0])).toContain(expected + "20");
  expect(screen.getByRole("button", { name: "Página siguiente" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Actualizar historial" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
  expect(String(fetchMock.mock.calls[3][0])).toContain(expected + "20");
  await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
  await screen.findByText("Paciente ficticio 1");
  expect(box()).toHaveValue("");
  expect(String(fetchMock.mock.calls[4][0])).toContain("/episodes/history?limit=20&offset=0");
});

it("no consulta un rango invertido y permite corregirlo", async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response(body()));
  vi.stubGlobal("fetch", fetchMock);
  render(<EpisodeHistoryPage onOpenEpisode={vi.fn(async () => {})} />);
  await screen.findByText("Paciente ficticio 1");
  fireEvent.change(screen.getByLabelText("Cierre desde"), { target: { value: "2026-11-25" } });
  fireEvent.change(screen.getByLabelText("Cierre hasta"), { target: { value: "2026-11-24" } });
  fireEvent.submit(form());
  expect(screen.getByLabelText("Cierre hasta")).toBeInvalid();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText("Cierre hasta"), { target: { value: "2026-11-26" } });
  expect(screen.getByLabelText("Cierre hasta")).toBeValid();
  fireEvent.submit(form());
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
});

it("distingue historial vacío de filtros sin coincidencias", async () => {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(response(body(0, 0))));
  render(<EpisodeHistoryPage onOpenEpisode={vi.fn(async () => {})} />);
  await screen.findByRole("heading", { name: "No existen episodios históricos" });
  fireEvent.change(box(), { target: { value: "Ausente" } });
  fireEvent.submit(form());
  await screen.findByText("No hay coincidencias con los filtros aplicados.");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

it("oculta resultados anteriores tras un error y reintenta la misma consulta", async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(response(body())).mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue(response(body()));
  vi.stubGlobal("fetch", fetchMock);
  render(<EpisodeHistoryPage onOpenEpisode={vi.fn(async () => {})} />);
  await screen.findByText("Paciente ficticio 1");
  await userEvent.click(screen.getByRole("button", { name: "Actualizar historial" }));
  await screen.findByRole("alert");
  expect(screen.queryByText("Paciente ficticio 1")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Reintentar historial" }));
  await screen.findByText("Paciente ficticio 1");
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it("descarta una consulta anterior aunque termine después y cancela al salir", async () => {
  let late!: (value: Response) => void;
  let signal: AbortSignal | undefined;
  const fetchMock = vi.fn<typeof fetch>().mockImplementationOnce((_input, options) => {
    signal = options?.signal as AbortSignal;
    return new Promise(resolve => { late = resolve; });
  }).mockResolvedValue(response({ ...body(), episodes: [row(50)] }));
  vi.stubGlobal("fetch", fetchMock);
  const view = render(<EpisodeHistoryPage onOpenEpisode={vi.fn(async () => {})} />);
  fireEvent.change(box(), { target: { value: "EP-50" } });
  fireEvent.submit(form());
  await screen.findByText("Paciente ficticio 50");
  expect(signal?.aborted).toBe(true);
  await act(async () => late(response(body())));
  expect(screen.queryByText("Paciente ficticio 1")).not.toBeInTheDocument();
  expect(screen.getByText("Paciente ficticio 50")).toBeVisible();
  view.unmount();
  await turn();
});

it("rechaza metadatos de otra página y bloquea apertura durante un guardado", async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(response(body(20))).mockResolvedValue(response(body()));
  vi.stubGlobal("fetch", fetchMock);
  const open = vi.fn(async () => {});
  render(<EpisodeHistoryPage onOpenEpisode={open} openingBlocked />);
  await screen.findByRole("alert");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Reintentar historial" }));
  await screen.findByText("Paciente ficticio 1");
  expect(screen.getByRole("button", { name: "Ver línea de tiempo" })).toBeDisabled();
  expect(open).not.toHaveBeenCalled();
});
