import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import DashboardPage from "./DashboardPage";
import EpisodeHistoryPage from "./EpisodeHistoryPage";
import SupervisorPage from "./SupervisorPage";
import LaboratoryPage from "./LaboratoryPage";
import type { Episode, LaboratoryQueue, SupervisorData } from "../types/clinical";

const first: Episode = { id: 20, name: "José Lara", birth_date: "1990-01-01", document: "DEMO-20", qr_token: "qr-demo",
  status: "ACTIVE", priority: 2, location: "Observación", started_at: "2026-10-17T12:00:00Z", vitals: [], alerts: [], tasks: [], events: [] };
const second = { ...first, id: 120, name: "Ana Pérez", priority: 3 };
const dashboard = { active: 2, open_alerts: 0, patients: [first, second], requested_by: "supervisor" };
const refresh = vi.fn(async () => {});
const searchBox = () => screen.getByRole("searchbox", { name: "Buscar por nombre o episodio" });
const search = (query: string) => fireEvent.change(searchBox(), { target: { value: query } });

it("filtra el control, conserva métricas y búsqueda al actualizar y abre el EP visible", () => {
  const open = vi.fn(async () => {});
  const { rerender } = render(<DashboardPage dashboard={dashboard} onRefresh={refresh} onOpenEpisode={open} />);
  const metrics = screen.getAllByRole("article").map(card => card.textContent);
  search("lara JOSE");
  expect(screen.getByRole("row", { name: /José Lara/ })).toBeVisible();
  expect(screen.queryByRole("row", { name: /Ana Pérez/ })).not.toBeInTheDocument();
  expect(screen.getByText("Mostrando 1 de 2 pacientes.")).toBeVisible();
  expect(screen.getAllByRole("article").map(card => card.textContent)).toEqual(metrics);
  fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
  expect(open).toHaveBeenCalledWith(20);
  rerender(<DashboardPage dashboard={{ ...dashboard, patients: [second] }} onRefresh={refresh} onOpenEpisode={open} />);
  expect(searchBox()).toHaveValue("lara JOSE");
  expect(screen.getByText("No hay coincidencias con la búsqueda.")).toBeVisible();
  expect(screen.queryByText("No hay pacientes activos.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));
  expect(screen.getByRole("row", { name: /Ana Pérez/ })).toBeVisible();
});

it("busca un EP exacto en historial, conserva el total y permite limpiar", () => {
  const open = vi.fn(async () => {});
  const episodes = [first, second].map(episode => ({ ...episode, status: "CLOSED", assigned_to: null, closed_at: first.started_at, event_count: 2, alert_count: 0, task_count: 0 }));
  render(<EpisodeHistoryPage historyData={{ total: 2, requested_by: "supervisor", episodes }} onRefresh={refresh} onOpenEpisode={open} />);
  search(" ep-20 ");
  expect(screen.queryByRole("row", { name: /Ana Pérez/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Ver línea de tiempo" }));
  expect(open).toHaveBeenCalledWith(20);
  expect(screen.getByRole("article")).toHaveTextContent("2Episodios históricos");
  search("No existe");
  expect(screen.getByText("No hay coincidencias con la búsqueda.")).toBeVisible();
  expect(screen.queryByText("No existen episodios históricos")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));
  expect(screen.getAllByRole("button", { name: "Ver línea de tiempo" })).toHaveLength(2);
});

it("combina búsqueda y filtros del supervisor sin alterar indicadores generales", () => {
  const data: SupervisorData = { metrics: { active_patients: 2, high_priority_patients: 1, patients_at_risk: 1, open_alerts: 1, pending_tasks: 0 },
    rules: { evaluated_episodes: 2, generated_alerts: 0 }, generated_at: first.started_at, requested_by: "supervisor",
    patients: [first, second].map((patient, index) => ({ ...patient, at_risk: index === 1, open_alert_count: index, pending_task_count: 0, waiting_minutes: 10 })) };
  function Harness() {
    const [filter, setFilter] = useState("ALL");
    return <SupervisorPage supervisorData={data} supervisorFilter={filter} onFilterChange={setFilter} rulesMessage="" evaluatingRules={false}
      onLoadDemo={refresh} onEvaluateRules={refresh} onRefresh={refresh} onOpenEpisode={vi.fn(async () => {})} />;
  }
  render(<Harness />);
  const metrics = screen.getAllByRole("article").map(card => card.textContent);
  search("20");
  fireEvent.click(screen.getByRole("button", { name: "Con alertas" }));
  expect(screen.getByText("No hay coincidencias con la búsqueda y el filtro actual.")).toBeVisible();
  expect(screen.getByText("Mostrando 0 de 1 pacientes.")).toBeVisible();
  expect(screen.getAllByRole("article").map(card => card.textContent)).toEqual(metrics);
  fireEvent.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));
  expect(screen.getByRole("button", { name: "Con alertas" })).toHaveClass("active-filter");
  expect(screen.getByRole("row", { name: /Ana Pérez/ })).toBeVisible();
  expect(screen.queryByRole("row", { name: /José Lara/ })).not.toBeInTheDocument();
});

const queue: LaboratoryQueue = { total: 3, status_filter: "ALL", requested_by: "laboratorio", orders: [
  { id: 1, episode_id: 20, patient_name: first.name, title: "Orden José", service: "LAB", status: "PENDING", result: null, created_at: first.started_at, priority: 2, location: "Observación", episode_status: "ACTIVE" },
  { id: 2, episode_id: 120, patient_name: second.name, title: "Orden Ana", service: "LAB", status: "PENDING", result: null, created_at: first.started_at, priority: 3, location: "Observación", episode_status: "CLOSED" },
  { id: 3, episode_id: 20, patient_name: first.name, title: "Orden corregible", service: "LAB", status: "COMPLETED", result: "Resultado previo", created_at: first.started_at, priority: 2, location: "Observación", episode_status: "ACTIVE" },
] };

it("filtra laboratorio sin desmontar resultados o correcciones ni enviarlos al buscar", () => {
  const complete = vi.fn(async () => {});
  const change = vi.fn(async () => true);
  render(<LaboratoryPage laboratoryQueue={queue} onRefresh={refresh} onCompleteOrder={complete} onChangeResult={change} />);
  const input = screen.getByRole("textbox", { name: "Resultado de laboratorio" });
  const corrected = screen.getByRole("textbox", { name: "Resultado corregido" });
  fireEvent.change(input, { target: { value: "Resultado sin guardar" } });
  fireEvent.change(corrected, { target: { value: "Corrección sin guardar" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Motivo de la acción" }), { target: { value: "Motivo local" } });
  search("120");
  expect(input).toBeInTheDocument();
  expect(input).not.toBeVisible();
  expect(corrected).not.toBeVisible();
  expect(screen.getByRole("heading", { name: "Orden Ana" })).toBeVisible();
  const closed = screen.getByRole("region", { name: "Pendientes de episodios cerrados" });
  expect(within(closed).queryByRole("textbox")).not.toBeInTheDocument();
  search("Ausente");
  expect(screen.getByText("No hay coincidencias con la búsqueda y el filtro actual.")).toBeVisible();
  expect(input).toHaveValue("Resultado sin guardar");
  fireEvent.keyDown(searchBox(), { key: "Enter" });
  fireEvent.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));
  expect(input).toBeVisible();
  expect(input).toHaveValue("Resultado sin guardar");
  expect(corrected).toBeVisible();
  expect(corrected).toHaveValue("Corrección sin guardar");
  expect(screen.getByRole("textbox", { name: "Motivo de la acción" })).toHaveValue("Motivo local");
  expect(screen.getByText("Mostrando 3 de 3 órdenes.")).toBeVisible();
  expect(complete).not.toHaveBeenCalled();
  expect(change).not.toHaveBeenCalled();
});

it("mantiene laboratorio en consulta y busca dentro del estado seleccionado", () => {
  const filter = vi.fn(async () => {});
  const completed = { ...queue, status_filter: "COMPLETED", total: 1, orders: [queue.orders[2]] };
  render(<LaboratoryPage laboratoryQueue={completed} canPublish={false} onRefresh={refresh} onCompleteOrder={vi.fn(async () => {})} onFilterChange={filter} />);
  search("120");
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Registrar corrección" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Completadas y anuladas" })).not.toBeInTheDocument();
  expect(filter).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("combobox", { name: "Mostrar órdenes" }), { target: { value: "PENDING" } });
  expect(filter).toHaveBeenCalledWith("PENDING");
});

it.each(["control", "historial", "laboratorio", "supervisor"])("distingue una lista vacía en %s de una búsqueda sin coincidencias", page => {
  if (page === "control") render(<DashboardPage dashboard={{ ...dashboard, patients: [], active: 0 }} onRefresh={refresh} onOpenEpisode={vi.fn(async () => {})} />);
  if (page === "historial") render(<EpisodeHistoryPage historyData={{ total: 0, requested_by: "supervisor", episodes: [] }} onRefresh={refresh} onOpenEpisode={vi.fn(async () => {})} />);
  if (page === "laboratorio") render(<LaboratoryPage laboratoryQueue={{ ...queue, orders: [], total: 0 }} onRefresh={refresh} onCompleteOrder={vi.fn(async () => {})} />);
  if (page === "supervisor") render(<SupervisorPage supervisorData={{ metrics: { active_patients: 0, high_priority_patients: 0, patients_at_risk: 0, open_alerts: 0, pending_tasks: 0 },
    rules: { evaluated_episodes: 0, generated_alerts: 0 }, patients: [], generated_at: first.started_at, requested_by: "supervisor" }}
    supervisorFilter="ALL" rulesMessage="" evaluatingRules={false} onFilterChange={vi.fn()} onLoadDemo={refresh} onEvaluateRules={refresh} onRefresh={refresh} onOpenEpisode={vi.fn(async () => {})} />);
  search("20");
  expect(screen.queryByText(/No hay coincidencias/)).not.toBeInTheDocument();
  expect(screen.getByText(page === "control" || page === "supervisor" ? "No hay pacientes activos." : page === "historial" ? "No existen episodios históricos" : "No hay órdenes en este filtro")).toBeVisible();
});
