import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import LaboratoryPage from "./LaboratoryPage";
import type { LaboratoryQueue } from "../types/clinical";

const base = { id: 1, episode_id: 42, title: "Activa", service: "LAB" as const, status: "PENDING" as const, result: null, created_at: "2026-10-16", patient_name: "Ficticio", priority: 3, location: "Observación", episode_status: "ACTIVE" as const, version: '"original"' };
const queue: LaboratoryQueue = { total: 2, status_filter: "PENDING", requested_by: "lab", orders: [base, { ...base, id: 2, title: "Cerrada", episode_status: "CLOSED" }] };
it("separa pendientes cerrados de ejecutables y no ofrece publicar los cerrados", () => {
  const complete = vi.fn(async () => {});
  render(<LaboratoryPage laboratoryQueue={queue} onRefresh={async () => {}} onCompleteOrder={complete} />);
  const active = screen.getByRole("region", { name: "Órdenes ejecutables" });
  const closed = screen.getByRole("region", { name: "Pendientes de episodios cerrados" });
  expect(within(active).getByText("Activa")).toBeVisible();
  expect(within(closed).getByText("Cerrada")).toBeVisible();
  expect(within(closed).queryByRole("textbox")).not.toBeInTheDocument();
  expect(within(closed).queryByRole("button")).not.toBeInTheDocument();
  fireEvent.submit(within(active).getByRole("button").closest("form")!);
  expect(complete).toHaveBeenCalledWith(expect.anything(), 1);
});
it("mantiene supervisor en consulta incluso para órdenes activas", () => {
  render(<LaboratoryPage laboratoryQueue={queue} canPublish={false} onRefresh={async () => {}} onCompleteOrder={async () => {}} />);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Publicar resultado y completar" })).not.toBeInTheDocument();
});
