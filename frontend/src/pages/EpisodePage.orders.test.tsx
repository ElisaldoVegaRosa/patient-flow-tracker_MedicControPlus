import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import EpisodePage from "./EpisodePage";
import { establishSession } from "../api/client";
import type { Episode } from "../types/clinical";

const base: Episode = { id: 22, name: "Paciente ficticio", birth_date: "1990-01-01", document: "TEST-ORDER",
  qr_token: "qr-ficticio", status: "ACTIVE", priority: 3, location: "Consulta", started_at: "2026-10-01T12:00:00Z",
  clinical_version: '"clinical"', tasks: [], alerts: [], vitals: [], events: [], laboratory: { orders: [] } };
afterEach(() => vi.unstubAllGlobals());
function show(episode = base) {
  establishSession("token-ficticio");
  const fetchMock = vi.fn(async () => ({ ok: true, status: 201, json: async () => episode }) as Response);
  vi.stubGlobal("fetch", fetchMock); const update = vi.fn();
  render(<EpisodePage episode={episode} user={{ username: "medico.demo", role: "DOCTOR", access_token: "token-ficticio" }} updateEpisode={update} showError={vi.fn()} />);
  return { fetchMock, update };
}

it("el episodio integrado separa la orden LAB del formulario de otras tareas", () => {
  show();
  const service = screen.getByLabelText("Servicio responsable");
  expect(within(service).queryByRole("option", { name: "Laboratorio" })).not.toBeInTheDocument();
  expect(service).toHaveValue("NURSING");
  expect(screen.getByRole("heading", { name: "Nueva orden de laboratorio" })).toBeInTheDocument();
});
it("el episodio anterior mantiene su orden simple de laboratorio", () => {
  show({ ...base, laboratory: undefined });
  expect(screen.getByLabelText("Servicio responsable")).toHaveValue("LAB");
  expect(screen.queryByRole("heading", { name: "Nueva orden de laboratorio" })).not.toBeInTheDocument();
});
it("crear desde el episodio actualiza el detalle y confirma el formulario exacto", async () => {
  const { fetchMock, update } = show();
  const panel = within(screen.getByRole("heading", { name: "Nueva orden de laboratorio" }).closest("section")!);
  fireEvent.change(panel.getByLabelText("Nombre de la orden"), { target: { value: "Orden ficticia" } });
  fireEvent.change(panel.getByLabelText("Nombre de analítica 1"), { target: { value: "Analítica ficticia" } });
  fireEvent.change(panel.getByLabelText("Tipo de muestra 1"), { target: { value: "SALIVA" } });
  fireEvent.change(panel.getByLabelText("Motivo"), { target: { value: "Solicitud ficticia" } });
  fireEvent.click(panel.getByLabelText("Muestra 1 para analítica 1"));
  fireEvent.click(panel.getByRole("button", { name: "Crear orden de laboratorio" }));
  await waitFor(() => expect(update).toHaveBeenCalledWith(base));
  const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(call[0]).toContain("/episodes/22/lab-orders");
  expect(new Headers(call[1].headers).get("If-Match")).toBe('"clinical"');
  expect(panel.getByLabelText("Nombre de la orden")).toHaveValue("");
});
