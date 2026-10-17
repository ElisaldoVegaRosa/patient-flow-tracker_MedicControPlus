import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import EpisodePage from "./EpisodePage";
import EpisodeHistoryPage from "./EpisodeHistoryPage";
import LaboratoryPage from "./LaboratoryPage";
import RetainedDrafts from "../components/RetainedDrafts";
import type { Episode, LaboratoryQueue } from "../types/clinical";

const date = "2026-10-17T12:00:00Z";
const base: Episode = {
  id: 42, name: "Paciente ficticio", birth_date: "1990-01-01", document: "DEMO-42",
  qr_token: "demo-qr", status: "ACTIVE", priority: 3, location: "Observación",
  started_at: date, vitals: [], tasks: [], alerts: [], events: [],
};
const supervisor = { username: "supervisor", role: "SUPERVISOR", access_token: "ficticio" };

it.each([["ACTIVE", "Activo"], ["CLOSED", "Cerrado"], ["ANNULLED", "Anulado"]])(
  "presenta el episodio %s en español", (status, label) => {
    render(<EpisodePage episode={{ ...base, status }} user={supervisor} updateEpisode={vi.fn()} showError={vi.fn()} />);
    expect(screen.getByText(`Episodio EP-42 · ${label}`)).toBeVisible();
  },
);

it("traduce eventos y correcciones sin reescribir las notas o sus originales", () => {
  const episode: Episode = { ...base, status: "CLOSED",
    tasks: [{ id: 7, episode_id: 42, service: "MEDICAL", status: "ANNULLED", title: "Orden ficticia", result: null }],
    events: [
      { id: 1, episode_id: 42, type: "DISCHARGE", note: "Nota literal: ACTIVE y DISCHARGE", current_note: "Nota rectificada: LAB", username: "medico", created_at: date },
      { id: 2, episode_id: 42, type: "EPISODE_REOPENED", note: "Reapertura de prueba", username: "medico", created_at: date },
      { id: 3, episode_id: 42, type: "ARRIVAL_ANNULLED", note: "Ingreso por error", username: "recepcion", created_at: date },
      { id: 4, episode_id: 42, type: "FUTURE_EVENT", note: "Evento de otra versión", username: "medico", created_at: date },
    ],
    record_changes: [
      { id: 1, episode_id: 42, target_type: "EPISODE", target_id: 42, action: "REOPEN", old_value: "CLOSED", new_value: "ACTIVE", reason: "Alta por error", username: "medico", created_at: date },
      { id: 2, episode_id: 42, target_type: "EVENT", target_id: 1, action: "CORRECT", old_value: "CORRECT", new_value: "NURSING", reason: "Transcripción", username: "medico", created_at: date },
    ],
  };
  render(<EpisodePage episode={episode} user={supervisor} updateEpisode={vi.fn()} showError={vi.fn()} />);
  expect(screen.getByText("Alta médica")).toBeVisible();
  expect(screen.getByText("Episodio reabierto")).toBeVisible();
  expect(screen.getByText("Ingreso anulado")).toBeVisible();
  expect(screen.getByText("Código no reconocido (FUTURE_EVENT)")).toBeVisible();
  expect(screen.getByText("Equipo médico")).toBeVisible();
  expect(screen.getByText("#7 · Anulada")).toBeVisible();
  expect(screen.getByText("Episodio #42 · Reapertura")).toBeVisible();
  expect(screen.getByText("Anterior: Cerrado")).toBeVisible();
  expect(screen.getByText("Nuevo: Activo")).toBeVisible();
  expect(screen.getByText("Evento #1 · Corrección")).toBeVisible();
  expect(screen.getByText("Anterior: CORRECT")).toBeVisible();
  expect(screen.getByText("Nuevo: NURSING")).toBeVisible();
  expect(screen.getByText("Nota rectificada: LAB")).toBeVisible();
  fireEvent.click(screen.getByText("Ver texto original"));
  expect(screen.getByText("Nota literal: ACTIVE y DISCHARGE")).toBeVisible();
  expect(episode.record_changes?.[0].old_value).toBe("CLOSED");
});

it("traduce severidad y transiciones de alertas activas y resueltas", () => {
  render(<EpisodePage episode={{ ...base, alerts: [
    { id: 1, episode_id: 42, reason: "Alerta de prueba", severity: "CRITICAL", status: "ACTIVE", responsible: null, created_at: date, updated_at: date,
      history: [{ id: 1, alert_id: 1, old_status: null, new_status: "ACTIVE", username: "medico" }] },
    { id: 2, episode_id: 42, reason: "Alerta anterior", severity: "HIGH", status: "RESOLVED", responsible: null, created_at: date, updated_at: date,
      history: [{ id: 2, alert_id: 2, old_status: "ESCALATED", new_status: "RESOLVED", username: "medico" }] },
  ] }} user={supervisor} updateEpisode={vi.fn()} showError={vi.fn()} />);
  expect(screen.getByText("Crítica · Alerta de prueba")).toBeVisible();
  expect(screen.getByText("Activa")).toBeVisible();
  fireEvent.click(screen.getByText(/Alertas resueltas/));
  expect(screen.getByText("Alta · Alerta anterior")).toBeVisible();
  expect(screen.getByText("Resuelta")).toBeVisible();
  screen.getAllByText(/Ver historial/).forEach(summary => fireEvent.click(summary));
  expect(screen.getByText("Creada → Activa")).toBeVisible();
  expect(screen.getByText("Escalada → Resuelta")).toBeVisible();
});

it("traduce laboratorio y conserva el valor de filtro enviado al controlador", () => {
  const onFilterChange = vi.fn(async () => {});
  const laboratoryQueue: LaboratoryQueue = { status_filter: "COMPLETED", total: 1, requested_by: "laboratorio", orders: [
    { id: 7, episode_id: 42, title: "Orden de prueba", service: "LAB", status: "COMPLETED", result: "Resultado literal: COMPLETED", created_at: date,
      patient_name: base.name, priority: 3, location: base.location, episode_status: "CLOSED",
      record_changes: [{ id: 1, episode_id: 42, target_type: "TASK", target_id: 7, action: "ANNUL", old_value: "CORRECT", new_value: null, reason: "Prueba", username: "laboratorio", created_at: date }] },
  ] };
  render(<LaboratoryPage laboratoryQueue={laboratoryQueue} canPublish={false} onRefresh={vi.fn(async () => {})} onCompleteOrder={vi.fn(async () => {})} onFilterChange={onFilterChange} />);
  expect(screen.getByText("Completada")).toBeVisible();
  expect(screen.getByText("Resultado vigente: Resultado literal: COMPLETED")).toBeVisible();
  fireEvent.click(screen.getByText("Ver correcciones y resultados anteriores"));
  expect(screen.getByText("Anulación · Motivo: Prueba")).toBeVisible();
  expect(screen.getByText("Anterior: CORRECT")).toBeVisible();
  fireEvent.change(screen.getByRole("combobox", { name: "Mostrar órdenes" }), { target: { value: "PENDING" } });
  expect(onFilterChange).toHaveBeenCalledWith("PENDING");
});

it("muestra estados históricos en español y abre el episodio con su identificador", () => {
  const onOpenEpisode = vi.fn(async () => {});
  render(<EpisodeHistoryPage historyData={{ total: 2, requested_by: "supervisor", episodes: [
    { ...base, assigned_to: null, closed_at: date, status: "CLOSED", event_count: 1, alert_count: 0, task_count: 0 },
    { ...base, id: 43, assigned_to: null, closed_at: date, status: "ANNULLED", event_count: 1, alert_count: 0, task_count: 0 },
  ] }} onRefresh={vi.fn(async () => {})} onOpenEpisode={onOpenEpisode} />);
  const row = screen.getByText("Cerrado").closest("tr")!;
  expect(screen.getByText("Anulado")).toBeVisible();
  fireEvent.click(within(row).getByRole("button", { name: "Ver línea de tiempo" }));
  expect(onOpenEpisode).toHaveBeenCalledWith(42);
});

it("traduce opciones de borradores y conserva el texto libre que coincide con códigos", () => {
  render(<RetainedDrafts drafts={[
    { kind: "order", episodeId: 42, fields: { service: "LAB", title: "LAB" } },
    { kind: "evaluation", episodeId: 42, fields: { disposition: "ORDER_TESTS", diagnosis: "ORDER_TESTS" } },
  ]} />);
  expect(screen.getByText("Laboratorio")).toBeVisible();
  expect(screen.getByText("Solicitar pruebas u órdenes")).toBeVisible();
  expect(screen.getByText("LAB")).toBeVisible();
  expect(screen.getByText("ORDER_TESTS")).toBeVisible();
});
