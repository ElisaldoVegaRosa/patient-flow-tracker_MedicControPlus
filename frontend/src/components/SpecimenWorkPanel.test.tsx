import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SpecimenWorkPanel from "./SpecimenWorkPanel";
import { usePendingOperations } from "../hooks/usePendingOperations";
import { notifyOperationalConfirmation } from "../session/operationalWrites";
import { readSpecimenDraft } from "../session/specimenDrafts";
import type { LaboratorySpecimen } from "../types/clinical";

const user = { username: "lab.demo", role: "LAB" };
const base: LaboratorySpecimen = { id: 1, version: '"v1"', kind: "URINE", kind_description: null,
  collected_at: null, delivered_at: null, received_at: null, suitability: "UNKNOWN", assessed_at: null,
  analysis_ids: [1], historical_analysis_ids: [] };
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response;
const applied = vi.fn((path: string, _result: unknown, body?: BodyInit | null) => notifyOperationalConfirmation(path, body));
const conflict = vi.fn();
let fetchMock: ReturnType<typeof vi.fn>;

function Harness({ specimen = base, role = "LAB", blocked = false }: { specimen?: LaboratorySpecimen; role?: string; blocked?: boolean }) {
  const operations = usePendingOperations();
  return <SpecimenWorkPanel specimens={[specimen]} user={{ ...user, role }} operations={operations} blocked={blocked} onApplied={applied} onConflict={conflict} />;
}
async function form(label: string) {
  const summary = await screen.findByText(label, { selector: "summary" });
  fireEvent.click(summary.closest("section")!.querySelector("details > summary")!);
  fireEvent.click(summary);
  return within(summary.closest("details")!);
}
function writes() { return fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "POST"); }
function body() { return JSON.parse(String((writes()[0][1] as RequestInit).body)); }
beforeEach(() => {
  localStorage.setItem("token", "token-ficticio");
  fetchMock = vi.fn(async (url: RequestInfo | URL) => String(url).endsWith("/lab/sample-professionals")
    ? response({ professionals: [{ id: 7, username: "enfermera.demo", display_name: "Enfermera Demo", role: "NURSE" }] }) : response({ id: 22 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("registro de muestras", () => {
  it("registra obtención propia con motivo, versión e idempotencia, sin inventar hora", async () => {
    render(<Harness />);
    const f = await form("Registrar obtención");
    fireEvent.change(f.getByLabelText("Lugar de obtención"), { target: { value: "Observación" } });
    fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Toma ficticia" } });
    fireEvent.click(f.getByRole("button", { name: "Registrar obtención" }));
    await waitFor(() => expect(applied).toHaveBeenCalled());
    expect(body()).toEqual({ reason: "Toma ficticia", location: "Observación", collector_kind: "USER" });
    const headers = new Headers((writes()[0][1] as RequestInit).headers);
    expect(headers.get("If-Match")).toBe('"v1"'); expect(headers.get("Idempotency-Key")).toBeTruthy();
    expect(f.getByLabelText("Motivo")).toHaveValue("");
    expect(readSpecimenDraft(user, "/lab/specimens/1/collection").draft).toBeUndefined();
  });

  it("elige otro profesional sin atribuirlo a quien registra", async () => {
    render(<Harness />); const f = await form("Registrar entrega");
    fireEvent.change(f.getByLabelText("Quién entregó la muestra"), { target: { value: "OTHER" } });
    fireEvent.change(f.getByLabelText("Profesional que realizó el hecho"), { target: { value: "7" } });
    fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Traslado ficticio" } });
    fireEvent.click(f.getByRole("button", { name: "Registrar entrega" }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(body()).toEqual({ reason: "Traslado ficticio", deliverer_kind: "USER", deliverer_user_id: 7 });
  });

  it("permite toma por paciente de orina sin enviar una cuenta profesional", async () => {
    render(<Harness />); const f = await form("Registrar obtención");
    fireEvent.change(f.getByLabelText("Quién obtuvo la muestra"), { target: { value: "PATIENT" } });
    fireEvent.change(f.getByLabelText("Lugar de obtención"), { target: { value: "Lugar ficticio" } });
    fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Recogida ficticia" } });
    fireEvent.click(f.getByRole("button", { name: "Registrar obtención" }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(body().collector_kind).toBe("PATIENT"); expect(body()).not.toHaveProperty("collector_user_id");
  });

  it("enfermería no ofrece recepción/aptitud y sangre no ofrece autotoma por paciente", async () => {
    render(<Harness role="NURSE" specimen={{ ...base, kind: "BLOOD" }} />);
    const f = await form("Registrar obtención");
    expect(f.queryByRole("option", { name: "El paciente" })).not.toBeInTheDocument();
    expect(screen.queryByText("Confirmar recepción", { selector: "summary" })).not.toBeInTheDocument();
    expect(screen.queryByText("Registrar aptitud", { selector: "summary" })).not.toBeInTheDocument();
  });

  it.each(["DOCTOR", "SUPERVISOR"])("%s consulta sin formularios ni consultas de profesionales", role => {
    render(<Harness role={role} />); expect(screen.queryByRole("form")).not.toBeInTheDocument(); expect(fetchMock).not.toHaveBeenCalled();
  });

  it("recibir no inventa toma y aptitud se bloquea hasta la recepción", async () => {
    render(<Harness />); const f = await form("Confirmar recepción");
    fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Recepción ficticia" } });
    fireEvent.click(f.getByRole("button", { name: "Confirmar recepción" }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(body()).toEqual({ reason: "Recepción ficticia" });
    expect(screen.getByText("Confirma la recepción antes de valorar la aptitud.")).toBeInTheDocument();
  });

  it("conserva campos ante error y requiere revisar una versión nueva", async () => {
    const view = render(<Harness />); const f = await form("Confirmar recepción");
    fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Motivo conservado" } });
    fetchMock.mockResolvedValueOnce(response({ detail: "Error ficticio" }, 422));
    fireEvent.click(f.getByRole("button", { name: "Confirmar recepción" }));
    await screen.findByText("Error ficticio");
    expect(f.getByLabelText("Motivo")).toHaveValue("Motivo conservado");
    view.rerender(<Harness specimen={{ ...base, version: '"v2"' }} />);
    expect(f.getByRole("button", { name: "Confirmar recepción" })).toBeDisabled();
    fireEvent.click(f.getByRole("button", { name: "He revisado los cambios; usar versión actual" }));
    expect(f.getByRole("button", { name: "Confirmar recepción" })).toBeEnabled();
    expect(readSpecimenDraft(user, "/lab/specimens/1/receipt").draft?.baseline).toBe('"v2"');
  });

  it("restaura una misma cuenta tras desmontarse sin enviar automáticamente", async () => {
    const view = render(<Harness />); const f = await form("Registrar entrega");
    fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Borrador de muestra" } });
    view.unmount(); render(<Harness specimen={{ ...base, version: '"v2"' }} />);
    const restored = await form("Registrar entrega");
    expect(restored.getByLabelText("Motivo")).toHaveValue("Borrador de muestra");
    expect(restored.getByRole("button", { name: "Registrar entrega" })).toBeDisabled();
    expect(writes()).toHaveLength(0);
  });

  it("no borra texto más reciente al confirmar un envío anterior", async () => {
    render(<Harness />); const f = await form("Confirmar recepción");
    fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Nota posterior" } });
    await act(async () => notifyOperationalConfirmation("/lab/specimens/1/receipt", JSON.stringify({ reason: "Nota anterior" })));
    expect(f.getByLabelText("Motivo")).toHaveValue("Nota posterior");
  });

  it("convierte una hora explícita de 12h a hora dominicana sin enviarla como ahora", async () => {
    render(<Harness />); const f = await form("Confirmar recepción");
    fireEvent.change(f.getByLabelText("Momento del hecho"), { target: { value: "EXACT" } });
    fireEvent.change(f.getByLabelText("Fecha"), { target: { value: "2026-10-01" } });
    fireEvent.change(f.getByLabelText("Hora (1–12)"), { target: { value: "12" } });
    fireEvent.change(f.getByLabelText("AM/PM"), { target: { value: "AM" } });
    fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Registro diferido ficticio" } });
    fireEvent.click(f.getByRole("button", { name: "Confirmar recepción" }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(body()).toEqual({ reason: "Registro diferido ficticio", occurred_at: "2026-10-01T00:00:00-04:00" });
  });

  it("mantiene una sola petición mientras está guardando, aun al repetir submit", async () => {
    render(<Harness />); const f = await form("Confirmar recepción");
    fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Recepción ficticia" } });
    let finish!: (value: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
    const node = f.getByRole("button", { name: "Confirmar recepción" }).closest("form")!;
    fireEvent.submit(node); fireEvent.submit(node);
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(f.getByLabelText("Motivo")).toBeDisabled();
    await act(async () => finish(response({ id: 22 })));
    expect(f.getByLabelText("Motivo")).toHaveValue("");
  });

  it("registra aptitud sin convertirla en procesamiento y bloquea hechos ya registrados", async () => {
    render(<Harness specimen={{ ...base, received_at: "2026-10-01T12:00:00Z" }} />);
    const f = await form("Registrar aptitud");
    fireEvent.change(f.getByLabelText("Aptitud de la muestra"), { target: { value: "REJECTED" } });
    fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Muestra ficticia no apta" } });
    fireEvent.click(f.getByRole("button", { name: "Registrar aptitud" }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(body()).toEqual({ reason: "Muestra ficticia no apta", suitability: "REJECTED" });
    const received = screen.getByText("Confirmar recepción · Ya registrado", { selector: "summary" });
    fireEvent.click(received);
    expect(within(received.closest("details")!).getByRole("button", { name: "Confirmar recepción" })).toBeDisabled();
  });

  it("la pérdida de disponibilidad conserva el borrador para revisión y permite descartarlo", async () => {
    const view = render(<Harness />); const f = await form("Registrar entrega");
    fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Motivo pendiente" } });
    view.rerender(<Harness blocked />);
    expect(f.getByLabelText("Motivo")).toHaveValue("Motivo pendiente");
    expect(f.getByRole("button", { name: "Registrar entrega" })).toBeDisabled();
    fireEvent.click(f.getByRole("button", { name: "Descartar campos de Registrar entrega" }));
    expect(f.getByLabelText("Motivo")).toHaveValue("");
    expect(readSpecimenDraft(user, "/lab/specimens/1/delivery").draft).toBeUndefined();
  });

  it("explica la falta de versión y bloquea el registro", async () => {
    render(<Harness specimen={{ ...base, version: undefined }} />); const f = await form("Confirmar recepción");
    expect(f.getByRole("button", { name: "Confirmar recepción" })).toBeDisabled();
    expect(f.getByText(/No se pudo verificar el estado actual/)).toBeVisible();
  });

  it("reintenta consultar profesionales sin desmontar el motivo escrito", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Fallo ficticio"));
    render(<Harness />); const f = await form("Registrar entrega");
    fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Motivo conservado" } });
    fireEvent.click(screen.getByRole("button", { name: "Reintentar consulta de profesionales" }));
    await waitFor(() => expect(screen.queryByText(/No se pudo consultar el personal/)).not.toBeInTheDocument());
    expect(f.getByLabelText("Motivo")).toHaveValue("Motivo conservado");
  });

  it("una respuesta tardía tras salir no actualiza otra pantalla ni borra el borrador", async () => {
    const view = render(<Harness />); const f = await form("Confirmar recepción");
    fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Motivo conservado" } });
    let finish!: (value: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
    fireEvent.click(f.getByRole("button", { name: "Confirmar recepción" }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    view.unmount();
    await act(async () => finish(response({ id: 22 })));
    expect(applied).not.toHaveBeenCalled();
    expect(readSpecimenDraft(user, "/lab/specimens/1/receipt").draft?.fields.reason).toBe("Motivo conservado");
  });
});
