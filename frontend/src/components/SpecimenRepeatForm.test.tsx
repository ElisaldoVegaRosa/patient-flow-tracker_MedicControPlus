import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SpecimenRepeatForm, { LaboratoryRepeatHistory } from "./SpecimenRepeatForm";
import { usePendingOperations } from "../hooks/usePendingOperations";
import { notifyOperationalConfirmation } from "../session/operationalWrites";
import { readSpecimenDraft } from "../session/specimenDrafts";
import type { LaboratorySpecimen, LaboratorySummary } from "../types/clinical";

const user = { username: "lab.demo", role: "LAB" };
const source: LaboratorySpecimen = { id: 8, version: '"sample"', kind: "BLOOD", kind_description: null,
  collected_at: null, delivered_at: null, received_at: "2026-10-01T12:00:00Z", suitability: "REJECTED", assessed_at: "2026-10-01T12:00:00Z", analysis_ids: [2, 5, 7], historical_analysis_ids: [9] };
const analyses: LaboratorySummary["analyses"] = [2, 5, 7, 9].map(id => ({ id, title: `Prueba ficticia ${id}`, cancelled_at: id === 7 ? "2026-10-01T12:00:00Z" : null, cancellation_reason: null,
  has_result: false, current_result: null, result_annulled: false, result_sequence: null, needs_medical_review: false, reviewed_at: null, satisfies_current_samples: false }));
const applied = vi.fn((path: string, _result: unknown, body?: BodyInit | null) => notifyOperationalConfirmation(path, body));
let fetchMock: ReturnType<typeof vi.fn>;
function Harness({ specimen = source, role = "LAB", blocked = false }: { specimen?: LaboratorySpecimen; role?: string; blocked?: boolean }) {
  const operations = usePendingOperations();
  return <SpecimenRepeatForm {...{ specimen, analyses, operations, blocked }} user={{ ...user, role }} onApplied={applied} onConflict={vi.fn()} />;
}
function open() { fireEvent.click(screen.getByText("Solicitar nueva muestra", { selector: "summary" })); }
function reason() { fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Muestra ficticia no apta" } }); }
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Confirmar solicitud de nueva muestra" }));
beforeEach(() => { localStorage.setItem("token", "token-ficticio"); fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: 22 }) }) as Response); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

it("solo solicita la analítica seleccionada, con versión de muestra, clave y motivo", async () => {
  render(<Harness />); open(); reason();
  expect(screen.queryByLabelText("Prueba ficticia 7 · Analítica #7")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Prueba ficticia 9 · Analítica #9")).not.toBeInTheDocument();
  submit(); expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText("Prueba ficticia 5 · Analítica #5")); submit();
  await waitFor(() => expect(applied).toHaveBeenCalled());
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toContain("/lab/specimens/8/repeat");
  expect(new Headers(init.headers).get("If-Match")).toBe('"sample"');
  expect(new Headers(init.headers).get("Idempotency-Key")).toBeTruthy();
  expect(JSON.parse(String(init.body))).toEqual({ reason: "Muestra ficticia no apta", analysis_ids: [5] });
  expect(screen.getByLabelText("Prueba ficticia 5 · Analítica #5")).not.toBeChecked();
  expect(readSpecimenDraft(user, "/lab/specimens/8/repeat").draft).toBeUndefined();
});

it.each(["UNKNOWN", "ACCEPTED"])("no solicita otra muestra con aptitud %s", suitability => {
  render(<Harness specimen={{ ...source, suitability }} />); open();
  expect(screen.getByRole("button", { name: "Confirmar solicitud de nueva muestra" })).toBeDisabled();
  expect(fetchMock).not.toHaveBeenCalled();
});
it("sin contexto, versión o analíticas vigentes mantiene la acción bloqueada", () => {
  const view = render(<Harness blocked />); open();
  expect(screen.getByRole("button", { name: "Confirmar solicitud de nueva muestra" })).toBeDisabled();
  view.rerender(<Harness specimen={{ ...source, version: undefined }} />);
  expect(screen.getByRole("button", { name: "Confirmar solicitud de nueva muestra" })).toBeDisabled();
  view.rerender(<Harness specimen={{ ...source, analysis_ids: [7] }} />);
  expect(screen.getByText("No hay analíticas vigentes que todavía requieran esta muestra.")).toBeVisible();
});
it.each(["NURSE", "DOCTOR", "SUPERVISOR"])("%s no solicita nuevas muestras", role => {
  render(<Harness role={role} />); expect(screen.queryByText("Solicitar nueva muestra")).not.toBeInTheDocument();
});

it("recupera selección y motivo, pero obliga a revisar un cambio de versión", () => {
  const view = render(<Harness />); open(); reason(); fireEvent.click(screen.getByLabelText("Prueba ficticia 2 · Analítica #2"));
  view.unmount(); render(<Harness specimen={{ ...source, version: '"new"' }} />); open();
  expect(screen.getByLabelText("Prueba ficticia 2 · Analítica #2")).toBeChecked();
  expect(screen.getByLabelText("Motivo")).toHaveValue("Muestra ficticia no apta");
  expect(screen.getByRole("button", { name: "Confirmar solicitud de nueva muestra" })).toBeDisabled();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("otra repetición elimina la opción anterior y exige seleccionar una analítica todavía requerida", () => {
  const view = render(<Harness />); open(); reason(); fireEvent.click(screen.getByLabelText("Prueba ficticia 2 · Analítica #2"));
  view.rerender(<Harness specimen={{ ...source, version: '"new"', analysis_ids: [5, 7], historical_analysis_ids: [2, 9] }} />);
  expect(screen.queryByLabelText("Prueba ficticia 2 · Analítica #2")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Prueba ficticia 5 · Analítica #5")).not.toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "He revisado los cambios; usar versión actual" }));
  submit(); expect(fetchMock).not.toHaveBeenCalled();
});

it("una confirmación tardía no actualiza una pantalla abandonada", async () => {
  let resolve!: (value: Response) => void;
  fetchMock.mockImplementation(() => new Promise<Response>(r => { resolve = r; }));
  const view = render(<Harness />); open(); reason(); fireEvent.click(screen.getByLabelText("Prueba ficticia 2 · Analítica #2")); submit(); view.unmount();
  await act(async () => resolve({ ok: true, status: 200, json: async () => ({ id: 22 }) } as Response));
  expect(applied).not.toHaveBeenCalled();
});

it("el historial conserva origen, reemplazo, analítica, motivo y autor en fecha local", () => {
  render(<LaboratoryRepeatHistory analyses={analyses} repeats={[{ id: 1, analysis_id: 2, previous_specimen_id: 8, new_specimen_id: 10,
    requested_by_username: "lab.demo", requested_at: "2026-10-01T12:00:00Z", reason: "Solicitud ficticia" }]} />);
  fireEvent.click(screen.getByText("Historial de nuevas muestras (1)"));
  const history = within(screen.getByText("Historial de nuevas muestras (1)").closest("details")!);
  expect(history.getByText("Prueba ficticia 2")).toBeVisible();
  expect(history.getByText("Muestra anterior #8 · Nueva muestra #10")).toBeVisible();
  expect(history.getByText("Motivo: Solicitud ficticia")).toBeVisible();
  expect(history.getByText(/^lab.demo ·/)).toBeVisible();
});
