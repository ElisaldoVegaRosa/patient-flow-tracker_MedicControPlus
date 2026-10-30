import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import LegacyLaboratoryOrders from "./LegacyLaboratoryOrders";
import type { ClinicalTask, Episode } from "../types/clinical";

const tasks: ClinicalTask[] = [
  { id: 1, episode_id: 22, title: "Antigua pendiente", service: "LAB", status: "PENDING", result: null },
  { id: 2, episode_id: 22, title: "Antigua completada", service: "LAB", status: "COMPLETED", result: "Resultado ficticio anterior" },
  { id: 3, episode_id: 22, title: "Antigua anulada", service: "LAB", status: "ANNULLED", result: "Texto previo sin vigencia" },
  { id: 4, episode_id: 22, title: "Orden con muestras", service: "LAB", status: "PENDING", result: null },
];
const episode: Episode = { id: 22, name: "Paciente ficticio", birth_date: "1990-01-01", document: "DEMO-OLD",
  qr_token: "qr-ficticio", status: "ACTIVE", priority: 3, location: "Consulta", started_at: "2026-10-28T12:00:00Z",
  tasks, alerts: [], vitals: [], events: [], laboratory: { orders: [], legacy_order_ids: [1, 2, 3] } };
it("identifica las órdenes anteriores por datos del servidor y muestra estado y texto vigente", () => {
  render(<LegacyLaboratoryOrders episode={episode} />);
  fireEvent.click(screen.getByText("Órdenes anteriores de laboratorio (3)"));
  expect(screen.getByText("Pendientes de resolver: 1.")).toBeVisible();
  expect(screen.getByText("Resultado vigente: Resultado ficticio anterior")).toBeVisible();
  expect(screen.queryByText(/Orden con muestras/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Texto previo sin vigencia/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
it("sin órdenes anteriores explícitas no inventa una clasificación", () => {
  render(<LegacyLaboratoryOrders episode={{ ...episode, laboratory: { orders: [] } }} />);
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
});
it("completada sin texto indica la ausencia sin inventar resultados ni revisión", () => {
  render(<LegacyLaboratoryOrders episode={{ ...episode, tasks: [{ ...tasks[1], result: null }], laboratory: { orders: [], legacy_order_ids: [2] } }} />);
  fireEvent.click(screen.getByText("Órdenes anteriores de laboratorio (1)"));
  expect(screen.getByText("Resultado vigente: Sin texto registrado")).toBeVisible();
  expect(screen.getByText(/No tienen desglose de muestras/)).toBeVisible();
});
