import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LaboratoryPage from "./LaboratoryPage";
import type { LaboratoryOrder, LaboratorySummary } from "../types/clinical";

const summary: LaboratorySummary = {
  status: "PARTIAL", processing_context: "ACTIVE", published_results: 1,
  pending_results: 1, pending_reviews: 1, cancelled_analyses: 0,
  analyses: [{ id: 1, title: "Analítica ficticia", cancelled_at: null, cancellation_reason: null,
    has_result: true, current_result: "Resultado literal PARTIAL", result_annulled: false, result_sequence: 1,
    needs_medical_review: true, reviewed_at: null, satisfies_current_samples: false }],
  specimens: [{ id: 1, kind: "BLOOD", kind_description: null, collected_at: null, delivered_at: null,
    received_at: "2026-10-28T14:00:00+00:00", suitability: "ACCEPTED", assessed_at: "2026-10-28T14:01:00+00:00",
    analysis_ids: [1], historical_analysis_ids: [] }],
};
const base: LaboratoryOrder = { id: 1, episode_id: 22, title: "Orden nueva ficticia", workflow: "STRUCTURED",
  service: "LAB", status: "PENDING", result: null, created_at: "2026-10-28T14:00:00+00:00",
  patient_name: "Paciente ficticio", priority: 3, location: "Observación", episode_status: "ACTIVE", laboratory: summary };

function show(orders: LaboratoryOrder[], filter = "ALL", canPublish = true) {
  const complete = vi.fn(async () => {}), correct = vi.fn(async () => true);
  render(<LaboratoryPage laboratoryQueue={{ orders, total: orders.length, status_filter: filter, requested_by: "laboratorio" }}
    canPublish={canPublish} onRefresh={vi.fn(async () => {})} onCompleteOrder={complete} onChangeResult={correct} />);
  return { complete, correct };
}

describe("consulta de órdenes por muestras", () => {
  it("muestra parciales y revisión separada, con detalles cerrados y sin acciones antiguas", () => {
    const { complete, correct } = show([base]);
    expect(screen.getByText("Resultados parciales")).toBeVisible();
    expect(screen.getByText(/Pendientes de revisión médica: 1/)).toBeVisible();
    expect(screen.getByText("Ver analíticas (1)").closest("details")).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("Ver analíticas (1)"));
    expect(screen.getByText("Resultado vigente: Resultado literal PARTIAL")).toBeVisible();
    expect(screen.getByText("Revisión médica: Pendiente")).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Resultado de laboratorio" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Publicar resultado|Registrar corrección|Anular vigencia/ })).not.toBeInTheDocument();
    expect(complete).not.toHaveBeenCalled(); expect(correct).not.toHaveBeenCalled();
  });

  it.each(["COMPLETED", "COMPLETED_WITH_CANCELLATIONS", "CANCELLED"] as const)("agrupa %s como terminal aunque la tarea portadora siga pendiente", status => {
    show([{ ...base, laboratory: { ...summary, status, pending_results: 0 } }], "COMPLETED");
    const group = screen.getByRole("region", { name: "Completadas y anuladas" });
    expect(within(group).getByText(base.title)).toBeVisible();
    expect(screen.queryByRole("region", { name: "Órdenes ejecutables" })).not.toBeInTheDocument();
    expect(screen.getByText(/Pendientes de revisión médica: 1/)).toBeVisible();
  });

  it("muestra seguimiento tras alta, sin el mensaje antiguo de imposibilidad de publicar", () => {
    show([{ ...base, episode_status: "CLOSED", laboratory: { ...summary, processing_context: "FOLLOWUP" } }]);
    expect(screen.getByRole("region", { name: "Pendientes de episodios cerrados" })).toBeVisible();
    expect(screen.getByText("Seguimiento de laboratorio vigente tras el alta.")).toBeVisible();
    expect(screen.queryByText(/no se puede publicar un resultado/)).not.toBeInTheDocument();
  });

  it("conserva el formulario anterior junto a la consulta nueva y la búsqueda no lo desmonta", () => {
    show([base, { ...base, id: 2, title: "Orden anterior", workflow: "LEGACY", laboratory: undefined }]);
    const field = screen.getByRole("textbox", { name: "Resultado de laboratorio" });
    fireEvent.change(field, { target: { value: "Borrador ficticio" } });
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar por nombre o episodio" }), { target: { value: "No coincide" } });
    expect(field).not.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));
    expect(field).toHaveValue("Borrador ficticio");
  });

  it("traduce muestras y aptitud sin inferir obtención por haber recibido la muestra", () => {
    show([base], "ALL", false);
    fireEvent.click(screen.getByText("Ver muestras (1)"));
    expect(screen.getByText("Muestra #1 · Sangre")).toBeVisible();
    expect(screen.getByText("Obtención: Sin registrar")).toBeVisible();
    expect(screen.getByText("Aptitud: Apta")).toBeVisible();
    expect(screen.getByText(/^Recepción:/)).not.toHaveTextContent("Sin registrar");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("no habilita el formulario genérico si falta el resumen estructurado", () => {
    show([{ ...base, laboratory: undefined }]);
    expect(screen.getByRole("alert")).toHaveTextContent("Actualiza la bandeja");
    expect(screen.queryByRole("textbox", { name: "Resultado de laboratorio" })).not.toBeInTheDocument();
  });

  it("conserva visible un informe pendiente de revisión aunque la analítica esté cancelada", () => {
    show([{ ...base, laboratory: { ...summary, status: "CANCELLED", pending_results: 0, cancelled_analyses: 1,
      analyses: [{ ...summary.analyses[0], cancelled_at: "2026-10-28T15:00:00+00:00", cancellation_reason: "Motivo ficticio" }] } }], "COMPLETED");
    fireEvent.click(screen.getByText("Ver analíticas (1)"));
    expect(screen.getByText("Analítica cancelada · Motivo: Motivo ficticio")).toBeVisible();
    expect(screen.getByText("Resultado vigente: Resultado literal PARTIAL")).toBeVisible();
    expect(screen.getByText("Revisión médica: Pendiente")).toBeVisible();
    expect(screen.queryByText("Trabajo pendiente para esta analítica.")).not.toBeInTheDocument();
  });
});
