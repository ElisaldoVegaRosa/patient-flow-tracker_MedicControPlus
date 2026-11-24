import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import EpisodePage from "../pages/EpisodePage";
import type { Episode } from "../types/clinical";
import { establishSession } from "../api/client";

const original: Episode = {
  id: 42, name: "Paciente ficticio", birth_date: "1990-01-01", document: "CORRECT-42", qr_token: "qr42",
  status: "ACTIVE", priority: 3, location: "Recepción", started_at: "2026-11-23T12:00:00Z",
  consultation_reason: "Motivo original ficticio", consultation_reason_version: '"original"',
  vitals: [], tasks: [], alerts: [], events: [],
};
const corrected: Episode = { ...original, consultation_reason: "Motivo corregido ficticio", consultation_reason_version: '"corrected"',
  record_changes: [{ id: 1, episode_id: 42, target_type: "EPISODE", target_id: 42, action: "CORRECT_CONSULTATION_REASON",
    old_value: original.consultation_reason!, new_value: "Motivo corregido ficticio", reason: "Transcripcion ficticia",
    username: "recepcion", created_at: "2026-11-23T13:00:00Z" }] };
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response;

function View({ initial = original, role = "RECEPTION" }: { initial?: Episode; role?: string }) {
  const [episode, setEpisode] = useState(initial);
  return <EpisodePage episode={episode} user={{ username: "recepcion", role, access_token: "ficticio" }}
    updateEpisode={setEpisode} showError={vi.fn()} />;
}
function open() { fireEvent.click(screen.getByText("Corregir motivo de consulta")); }
function edit() {
  fireEvent.change(screen.getByLabelText("Motivo de consulta corregido"), { target: { value: "Motivo corregido ficticio" } });
  fireEvent.change(screen.getByLabelText("Justificación de la corrección"), { target: { value: "Transcripcion ficticia" } });
}
function save() { fireEvent.click(screen.getByRole("button", { name: "Guardar corrección del motivo de consulta" })); }

describe("Corrección auditada del motivo de consulta", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("guarda con versión y clave, muestra el motivo vigente y un historial legible", async () => {
    establishSession("ficticio");
    const fetchMock = vi.fn().mockResolvedValue(response(corrected));
    vi.stubGlobal("fetch", fetchMock);
    render(<View />); open(); edit();
    const button = screen.getByRole("button", { name: "Guardar corrección del motivo de consulta" });
    fireEvent.click(button); fireEvent.click(button);
    await screen.findByText("Corrección del motivo de consulta guardada.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("If-Match")).toBe('"original"');
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("Idempotency-Key")).toBeTruthy();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ value: "Motivo corregido ficticio", reason: "Transcripcion ficticia" });
    expect(screen.getByText("Motivo de consulta:").parentElement).toHaveTextContent("Motivo corregido ficticio");
    expect(screen.getByText("Anterior: Motivo original ficticio")).toBeVisible();
    expect(screen.getByText("Nuevo: Motivo corregido ficticio")).toBeVisible();
    expect(screen.getByText("recepcion · 23/11/2026, 09:00 a. m.")).toBeVisible();
    expect(screen.queryByText(/Código no reconocido/)).not.toBeInTheDocument();
    expect(sessionStorage.length).toBe(0);
  });

  it.each(["DOCTOR", "NURSE", "LAB", "ADMISSION"])("%s consulta sin editar", role => {
    render(<View role={role} />);
    expect(screen.queryByText("Corregir motivo de consulta")).not.toBeInTheDocument();
    expect(screen.getByText("Motivo de consulta:").parentElement).toHaveTextContent(original.consultation_reason!);
  });

  it("sin versión del servidor conserva la consulta pero bloquea guardar", () => {
    render(<View initial={{ ...original, consultation_reason_version: undefined }} />); open();
    expect(screen.getByRole("button", { name: "Guardar corrección del motivo de consulta" })).toBeDisabled();
  });

  it.each(["CLOSED", "ANNULLED"])("%s conserva historial sin ofrecer corrección", status => {
    render(<View initial={{ ...corrected, status }} role="SUPERVISOR" />);
    expect(screen.queryByText("Corregir motivo de consulta")).not.toBeInTheDocument();
    expect(screen.getByText("Anterior: Motivo original ficticio")).toBeVisible();
  });

  it("conserva el borrador tras recarga y exige revisar una versión nueva", async () => {
    establishSession("ficticio");
    const fetchMock = vi.fn().mockResolvedValue(response({ ...corrected, record_changes: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<View />); open(); edit(); view.unmount();
    render(<View initial={{ ...original, consultation_reason_version: '"remote"', consultation_reason: "Motivo remoto ficticio" }} />);
    open();
    expect(screen.getByLabelText("Motivo de consulta corregido")).toHaveValue("Motivo corregido ficticio");
    expect(screen.getByLabelText("Justificación de la corrección")).toHaveValue("Transcripcion ficticia");
    const button = screen.getByRole("button", { name: "Guardar corrección del motivo de consulta" });
    expect(button).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "He revisado los cambios; usar versión actual" }));
    save();
    await screen.findByText("Corrección del motivo de consulta guardada.");
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("If-Match")).toBe('"remote"');
  });

  it("ante conflicto consulta el motivo vigente sin perder los campos locales ni reenviar", async () => {
    establishSession("ficticio");
    const remote = { ...original, consultation_reason_version: '"remote"', consultation_reason: "Motivo remoto ficticio" };
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ detail: { code: "version_conflict", message: "Otra sesion corrigio el motivo" } }, 409))
      .mockResolvedValueOnce(response(remote));
    vi.stubGlobal("fetch", fetchMock);
    render(<View />); open(); edit(); save();
    await waitFor(() => expect(screen.getByText("Motivo de consulta:").parentElement).toHaveTextContent("Motivo remoto ficticio"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Motivo de consulta corregido")).toHaveValue("Motivo corregido ficticio");
    expect(screen.getByRole("button", { name: "Guardar corrección del motivo de consulta" })).toBeDisabled();
  });

  it("un fallo de red conserva ambos textos y la misma operación para reintentar", async () => {
    establishSession("ficticio");
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(response(corrected));
    vi.stubGlobal("fetch", fetchMock);
    render(<View />); open(); edit(); save();
    await screen.findByText(/Resultado por confirmar/);
    expect(screen.getByLabelText("Motivo de consulta corregido")).toHaveValue("Motivo corregido ficticio");
    expect(screen.getByLabelText("Justificación de la corrección")).toHaveValue("Transcripcion ficticia");
    save();
    await screen.findByText("Corrección del motivo de consulta guardada.");
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("Idempotency-Key"))
      .toBe(new Headers(fetchMock.mock.calls[1][1].headers).get("Idempotency-Key"));
  });
});
