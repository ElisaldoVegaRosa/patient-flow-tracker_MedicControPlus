import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LaboratoryAnalysisRecord } from "./LaboratoryResultForms";
import { usePendingOperations } from "../hooks/usePendingOperations";
import { notifyOperationalConfirmation } from "../session/operationalWrites";
import { readSpecimenDraft } from "../session/specimenDrafts";
import type { LaboratorySummary, LaboratoryResultVersion } from "../types/clinical";

type Analysis = LaboratorySummary["analyses"][number];
const stamp = "2026-10-01T12:00:00Z";
const base: Analysis = { id: 5, title: "Analítica ficticia", version: '"v1"', reviewer_username: "medico.demo",
  cancelled_at: null, cancellation_reason: null, has_result: false, current_result: null, result_annulled: false,
  result_sequence: null, needs_medical_review: false, reviewed_at: null, satisfies_current_samples: false,
  required_specimens: [{ id: 1, received_at: stamp, suitability: "ACCEPTED" }], versions: [] };
const report: LaboratoryResultVersion = { id: 41, sequence: 1, action: "PUBLISH", result: "Texto original ficticio", reason: "Publicación ficticia", published_at: stamp, reviewed_at: null };
const published: Analysis = { ...base, has_result: true, current_result: report.result, result_sequence: 1,
  needs_medical_review: true, satisfies_current_samples: true, versions: [report] };
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response;
const applied = vi.fn((path: string, _value: unknown, body?: BodyInit | null) => notifyOperationalConfirmation(path, body));
let fetchMock: ReturnType<typeof vi.fn>;
function Harness({ analysis = base, role = "LAB", username = "lab.demo", blocked = false }: { analysis?: Analysis; role?: string; username?: string; blocked?: boolean }) {
  const operations = usePendingOperations();
  return <LaboratoryAnalysisRecord {...{ analysis, operations, blocked }} user={{ role, username }} onApplied={applied} onConflict={vi.fn()} />;
}
function form(label: string, root: Pick<typeof screen, "getByText"> = screen) {
  const summary = root.getByText(label, { selector: "summary" }); fireEvent.click(summary);
  return within(summary.closest("details")!);
}
function fill(f: ReturnType<typeof within>, result = "Resultado ficticio") {
  fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Motivo ficticio" } });
  const value = f.queryByLabelText(/Resultado de la analítica|Resultado corregido/);
  if (value) fireEvent.change(value, { target: { value: result } });
}
function posts() { return fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "POST"); }
beforeEach(() => { localStorage.setItem("token", "token-ficticio"); fetchMock = vi.fn(async () => response({ id: 22 })); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe("cancelación y reactivación de analíticas", () => {
  it("el médico confirmado cancela solo el trabajo pendiente, con motivo y versión de analítica", async () => {
    render(<Harness role="DOCTOR" username="medico.demo" />);
    const f = form("Cancelar analítica pendiente"); fill(f);
    fireEvent.click(f.getByRole("button", { name: "Cancelar analítica pendiente" }));
    await waitFor(() => expect(applied).toHaveBeenCalled());
    expect(String(posts()[0][0])).toContain("/lab/analyses/5/cancel");
    expect(JSON.parse(String(posts()[0][1].body))).toEqual({ reason: "Motivo ficticio" });
    expect(new Headers(posts()[0][1].headers).get("If-Match")).toBe('"v1"');
    expect(new Headers(posts()[0][1].headers).get("Idempotency-Key")).toBeTruthy();
  });
  it.each([false, true])("resultado vigente impide cancelar cuando completado=%s", completed => {
    render(<Harness analysis={{ ...published, needs_medical_review: !completed, satisfies_current_samples: completed }} role="DOCTOR" username="medico.demo" />);
    const f = form("Cancelar analítica pendiente");
    expect(f.getByRole("button", { name: "Cancelar analítica pendiente" })).toBeDisabled();
    expect(posts()).toHaveLength(0);
  });
  it("reactiva la analítica cancelada sin cambiar resultados ni muestras", async () => {
    render(<Harness analysis={{ ...base, cancelled_at: stamp, cancellation_reason: "Cancelación ficticia" }} role="DOCTOR" username="medico.demo" />);
    const f = form("Reactivar analítica cancelada"); fill(f);
    fireEvent.click(f.getByRole("button", { name: "Reactivar analítica cancelada" }));
    await waitFor(() => expect(applied).toHaveBeenCalled());
    expect(String(posts()[0][0])).toContain("/lab/analyses/5/reinstate");
    expect(JSON.parse(String(posts()[0][1].body))).toEqual({ reason: "Motivo ficticio" });
    expect(screen.getByText("Analítica cancelada · Motivo: Cancelación ficticia")).toBeVisible();
  });
  it("sin plan posterior al alta conserva el motivo pero bloquea reactivación", () => {
    const value = { ...base, cancelled_at: stamp, reinstatement_requires_plan: true };
    render(<Harness analysis={value} role="DOCTOR" username="medico.demo" />);
    const f = form("Reactivar analítica cancelada");
    expect(f.getByRole("button", { name: "Reactivar analítica cancelada" })).toBeDisabled();
    expect(screen.getByText(/Registra un plan de seguimiento tras el alta/)).toBeVisible();
  });
  it("el cambio de responsable retira las acciones y conserva el borrador", () => {
    const view = render(<Harness role="DOCTOR" username="medico.demo" />);
    const f = form("Cancelar analítica pendiente"); fill(f);
    view.rerender(<Harness analysis={{ ...base, version: '"v2"', reviewer_username: "otro.medico" }} role="DOCTOR" username="medico.demo" />);
    expect(screen.queryByText("Cancelar analítica pendiente", { selector: "summary" })).not.toBeInTheDocument();
    expect(readSpecimenDraft({ username: "medico.demo", role: "DOCTOR" }, "/lab/analyses/5/cancel").draft?.fields.reason).toBe("Motivo ficticio");
  });
  it("una versión nueva exige revisión antes de cancelar sin limpiar el motivo", () => {
    const view = render(<Harness role="DOCTOR" username="medico.demo" />);
    const f = form("Cancelar analítica pendiente"); fill(f);
    view.rerender(<Harness analysis={{ ...base, version: '"v2"' }} role="DOCTOR" username="medico.demo" />);
    expect(f.getByRole("button", { name: "Cancelar analítica pendiente" })).toBeDisabled();
    expect(f.getByLabelText("Motivo")).toHaveValue("Motivo ficticio");
  });
});

describe("resultados por analítica", () => {
  it("exige confirmar fuentes y publica solo esa analítica con versión y clave", async () => {
    render(<Harness />); const f = form("Publicar resultado de esta analítica"); fill(f, "Resultado literal PARTIAL\nSegunda línea");
    fireEvent.click(f.getByRole("button", { name: "Publicar resultado de esta analítica" }));
    expect(posts()).toHaveLength(0);
    fireEvent.change(f.getByLabelText("Muestras fuente del resultado"), { target: { value: "1" } });
    fireEvent.click(f.getByRole("button", { name: "Publicar resultado de esta analítica" }));
    await waitFor(() => expect(applied).toHaveBeenCalled());
    expect(String(posts()[0][0])).toContain("/lab/analyses/5/results");
    const init = posts()[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ reason: "Motivo ficticio", result: "Resultado literal PARTIAL\nSegunda línea", specimen_ids: [1] });
    expect(new Headers(init.headers).get("If-Match")).toBe('"v1"'); expect(new Headers(init.headers).get("Idempotency-Key")).toBeTruthy();
    expect(f.getByLabelText("Resultado de la analítica")).toHaveValue("");
  });

  it.each([null, "REJECTED"])("no publica sin muestras recibidas y aptas: %s", state => {
    render(<Harness analysis={{ ...base, required_specimens: [{ id: 1, received_at: state ? stamp : null, suitability: state ?? "UNKNOWN" }] }} />);
    const f = form("Publicar resultado de esta analítica");
    expect(f.getByRole("button", { name: "Publicar resultado de esta analítica" })).toBeDisabled();
    expect(screen.getByText(/Para publicar hacen falta todas las muestras/)).toBeVisible();
  });

  it("corrige un informe conservado incluso con analítica cancelada, sin cambiar fuentes", async () => {
    render(<Harness analysis={{ ...published, cancelled_at: stamp, cancellation_reason: "Cancelación ficticia" }} />);
    const f = form("Registrar corrección del resultado"); fill(f, "Texto corregido ficticio");
    fireEvent.click(f.getByRole("button", { name: "Registrar corrección del resultado" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(String(posts()[0][0])).toContain("/lab/results/41/corrections");
    expect(JSON.parse(String((posts()[0][1] as RequestInit).body))).toEqual({ reason: "Motivo ficticio", result: "Texto corregido ficticio" });
  });

  it("anula vigencia con motivo y conserva texto y revisión anteriores", async () => {
    const view = render(<Harness analysis={{ ...published, versions: [{ ...report, reviewed_at: stamp }] }} />);
    const f = form("Anular vigencia del resultado"); fill(f);
    fireEvent.click(f.getByRole("button", { name: "Anular vigencia del resultado" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(JSON.parse(String((posts()[0][1] as RequestInit).body))).toEqual({ reason: "Motivo ficticio" });
    view.rerender(<Harness analysis={{ ...published, version: '"v2"', has_result: false, result_annulled: true,
      versions: [{ ...report, reviewed_at: stamp }, { ...report, id: 42, sequence: 2, action: "ANNUL", result: null, reason: "Anulación ficticia" }] }} />);
    const old = screen.getByText(/^Versión 1 · Anterior/, { selector: "summary" }); fireEvent.click(old);
    expect(screen.getByText("Texto registrado: Texto original ficticio")).toBeVisible();
    expect(within(old.closest("details")!).getByText(/^Revisada:/)).toBeVisible();
  });

  it("solo el médico confirmado revisa la versión exacta", async () => {
    render(<Harness analysis={published} role="DOCTOR" username="medico.demo" />);
    const f = form("Confirmar revisión médica"); fill(f);
    fireEvent.click(f.getByRole("button", { name: "Confirmar revisión médica" }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(String(posts()[0][0])).toContain("/lab/results/41/review");
    expect(JSON.parse(String((posts()[0][1] as RequestInit).body))).toEqual({ reason: "Motivo ficticio" });
    expect(screen.queryByText("Publicar resultado de esta analítica", { selector: "summary" })).not.toBeInTheDocument();
  });

  it.each(["NURSE", "SUPERVISOR", "DOCTOR"])("%s sin responsabilidad no ofrece acciones", role => {
    render(<Harness analysis={published} role={role} username="otra.cuenta" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument(); expect(fetchMock).not.toHaveBeenCalled();
  });

  it("un informe nuevo no recibe automáticamente un borrador de corrección anterior", () => {
    const view = render(<Harness analysis={published} />);
    const f = form("Registrar corrección del resultado"); fill(f, "Borrador anterior");
    view.rerender(<Harness analysis={{ ...published, version: '"v2"', current_result: "Informe nuevo",
      versions: [report, { ...report, id: 42, sequence: 2, action: "CORRECT", result: "Informe nuevo" }] }} />);
    const old = screen.getByText(/^Versión 1 · Anterior/, { selector: "summary" }); fireEvent.click(old);
    expect(f.getByLabelText("Resultado corregido")).toHaveValue("Borrador anterior");
    expect(f.getByRole("button", { name: "Registrar corrección del resultado" })).toBeDisabled();
    const current = within(screen.getByText(/^Versión 2 · Vigente/, { selector: "summary" }).closest("details")!);
    const fresh = form("Registrar corrección del resultado", current);
    expect(fresh.getByLabelText("Resultado corregido")).toHaveValue("");
    expect(readSpecimenDraft({ username: "lab.demo", role: "LAB" }, "/lab/results/41/corrections").draft?.fields.result).toBe("Borrador anterior");
  });

  it("fuentes nuevas exigen revisión y una nueva confirmación de muestras", () => {
    const view = render(<Harness />); const f = form("Publicar resultado de esta analítica"); fill(f);
    fireEvent.change(f.getByLabelText("Muestras fuente del resultado"), { target: { value: "1" } });
    view.rerender(<Harness analysis={{ ...base, version: '"v2"', required_specimens: [{ id: 2, received_at: stamp, suitability: "ACCEPTED" }] }} />);
    expect(f.getByRole("button", { name: "Publicar resultado de esta analítica" })).toBeDisabled();
    fireEvent.click(f.getByRole("button", { name: "He revisado los cambios; usar versión actual" }));
    expect(f.getByLabelText("Muestras fuente del resultado")).toHaveValue("");
    fireEvent.click(f.getByRole("button", { name: "Publicar resultado de esta analítica" }));
    expect(posts()).toHaveLength(0);
  });

  it("no borra texto posterior al confirmar un envío y no actualiza pantallas abandonadas", async () => {
    const view = render(<Harness analysis={published} />); const f = form("Registrar corrección del resultado"); fill(f, "Texto posterior");
    await act(async () => notifyOperationalConfirmation("/lab/results/41/corrections", JSON.stringify({ result: "Texto anterior", reason: "Motivo ficticio" })));
    expect(f.getByLabelText("Resultado corregido")).toHaveValue("Texto posterior");
    let finish!: (value: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
    fireEvent.click(f.getByRole("button", { name: "Registrar corrección del resultado" }));
    await waitFor(() => expect(posts()).toHaveLength(1)); view.unmount();
    await act(async () => finish(response({ id: 22 })));
    expect(applied).not.toHaveBeenCalled();
  });
});
