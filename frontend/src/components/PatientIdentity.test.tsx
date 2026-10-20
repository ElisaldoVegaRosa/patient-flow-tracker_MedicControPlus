import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PatientIdentity from "./PatientIdentity";
import WriteConflicts from "./WriteConflicts";
import { usePendingOperations } from "../hooks/usePendingOperations";
import { useVersionedWrites } from "../hooks/useVersionedWrites";
import type { Episode } from "../types/clinical";

const episode: Episode = { id: 81, patient_id: 61, name: "Paciente desconocido 61", birth_date: null,
  document: null, identity_status: "PROVISIONAL", identity_version: '"identity-original"',
  qr_token: "qr-provisional", status: "ACTIVE", priority: 3, location: "Recepción",
  started_at: "2026-10-19T00:00:00Z", events: [], tasks: [], vitals: [], alerts: [] };
const saved = vi.fn();
function Harness({ role = "ADMISSION", initial = episode }: { role?: string; initial?: Episode }) {
  const [current, setCurrent] = useState(initial);
  const operations = usePendingOperations();
  const writes = useVersionedWrites();
  return <><PatientIdentity episode={current} user={{ username: "demo", role, access_token: "ficticio" }}
    operations={operations} writes={writes} onUpdated={setCurrent} onSaved={saved} />
    <WriteConflicts writes={writes} onReviewed={setCurrent} /></>;
}
function fill() {
  for (const [name, value] of [["Nombre verificado", "Nombre confirmado"], ["Nacimiento verificado", "1990-01-01"],
    ["Documento verificado", "DEMO-VERIFY"], ["Fuente de verificación", "Documento cotejado ficticio"],
    ["Motivo de la confirmación", "Identidad completada"]]) {
    fireEvent.change(screen.getByLabelText(name), { target: { value } });
  }
}

describe("Verificación de identidad", () => {
  it.each(["RECEPTION", "NURSE", "DOCTOR", "LAB", "SUPERVISOR"])("%s ve el aviso sin permiso de verificar", role => {
    render(<Harness role={role} />);
    expect(screen.getByText(/Identidad provisional/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Confirmar identidad verificada" })).not.toBeInTheDocument();
  });

  it("distingue datos registrados de identidad verificada", () => {
    render(<Harness initial={{ ...episode, identity_status: "REGISTERED" }} />);
    expect(screen.getByText(/sin constancia de verificación/)).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("envía versión y clave, bloquea doble envío y muestra auditoría", async () => {
    saved.mockClear();
    let finish!: (response: Response) => void;
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(() => new Promise<Response>(done => { finish = done; }));
    vi.stubGlobal("fetch", fetchMock);
    render(<Harness />);
    fill();
    const form = screen.getByLabelText("Nombre verificado").closest("form")!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Verificando identidad…" })).toBeDisabled();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("If-Match")).toBe(episode.identity_version);
    expect(headers.get("Idempotency-Key")).toBeTruthy();
    const change = { id: 1, patient_id: 61, episode_id: 81,
      old_value: JSON.stringify({ name: episode.name, birth_date: null, document: null }),
      new_value: JSON.stringify({ name: "Nombre confirmado", birth_date: "1990-01-01", document: "DEMO-VERIFY" }),
      reason: "Identidad completada", verification_source: "Documento cotejado ficticio", username: "archivo", created_at: "2026-10-19" };
    finish({ ok: true, status: 200, json: async () => ({ ...episode, identity_status: "VERIFIED", identity_changes: [change] }) } as Response);
    expect(await screen.findByText("Identidad verificada por admisión/archivo.")).toBeVisible();
    await userEvent.click(screen.getByText("Historial de identidad"));
    expect(screen.getByText(/Anterior: Paciente desconocido/)).toBeVisible();
    expect(screen.getByText(/Confirmado: Nombre confirmado/)).toBeVisible();
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it("conserva campos ante coincidencia con ficha existente sin reintentar", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 409,
      json: async () => ({ detail: { code: "identity_requires_review", message: "Otra ficha requiere revisión" } }) }) as Response);
    vi.stubGlobal("fetch", fetchMock);
    render(<Harness />); fill();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar identidad verificada" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Otra ficha requiere revisión");
    expect(screen.getByLabelText("Nombre verificado")).toHaveValue("Nombre confirmado");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("requiere consultar conflicto y no acepta otra identidad ya verificada", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/identity")) return { ok: false, status: 409, json: async () => ({ detail: { code: "version_conflict", message: "Datos modificados" } }) } as Response;
      return { ok: true, status: 200, json: async () => ({ ...episode, identity_status: "VERIFIED" }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<Harness />); fill();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar identidad verificada" }));
    await userEvent.click(await screen.findByRole("button", { name: "Consultar cambios actuales" }));
    await waitFor(() => expect(screen.getByText(/Este recurso ya no admite/)).toBeVisible());
    expect(screen.queryByRole("button", { name: /He revisado los cambios/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nombre verificado")).toHaveValue("Nombre confirmado");
  });
});
