import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import EpisodePage from "./pages/EpisodePage";
import type { Episode } from "./types/clinical";

vi.mock("./components/EpisodePresence", () => ({ default: () => null }));

const episode: Episode = {
  id: 42, name: "Paciente ficticio", birth_date: "1990-01-01", document: "REASON-TEST",
  qr_token: "reason-qr", status: "ACTIVE", priority: 3, location: "Recepción",
  started_at: "2026-11-23T12:00:00Z", vitals: [], alerts: [], tasks: [], events: [],
};
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response;

describe("Motivo de consulta por episodio", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ["Consultar resultado", false], ["Consultar resultado", true],
    ["Reintentar operación original", false], ["Reintentar operación original", true],
  ])("confirma una corrección incierta con %s y preserva edición posterior=%s", async (action, editedAfter) => {
    localStorage.setItem("token", "ficticio");
    const initial = { ...episode, consultation_reason: "Motivo original", consultation_reason_version: '"v1"' };
    const corrected = { ...initial, consultation_reason: "Motivo corregido", consultation_reason_version: '"v2"' };
    let attempts = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (path === "/auth/me") return response({ username: "recepcion", role: "RECEPTION" });
      if (path === "/dashboard") return response({ active: 1, open_alerts: 0, patients: [{ ...initial, pending_task_count: 0, open_alert_count: 0 }], requested_by: "recepcion" });
      if (path === "/episodes/42") return response(initial);
      if (path === "/episodes/42/consultation-reason") {
        if (++attempts === 1) throw new TypeError("Failed to fetch");
        return response(corrected);
      }
      if (path === "/write-result") return response({ status: "confirmed", result: corrected });
      throw new Error(`Petición inesperada: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Abrir" }));
    await user.click(await screen.findByText("Corregir motivo de consulta"));
    fireEvent.change(screen.getByLabelText("Motivo de consulta corregido"), { target: { value: "Motivo corregido" } });
    fireEvent.change(screen.getByLabelText("Justificación de la corrección"), { target: { value: "Error ficticio" } });
    await user.click(screen.getByRole("button", { name: "Guardar corrección del motivo de consulta" }));
    await screen.findByRole("region", { name: "Guardados por confirmar" });
    expect(screen.getByRole("heading", { name: "EP-42 · Corrección del motivo de consulta" })).toBeVisible();
    if (editedAfter) fireEvent.change(screen.getByLabelText("Motivo de consulta corregido"), { target: { value: "Edicion posterior ficticia" } });
    await user.click(screen.getByRole("button", { name: action }));
    await screen.findByText("Corrección del motivo de consulta confirmada por el servidor.");
    expect(screen.getByText("Motivo de consulta:").parentElement).toHaveTextContent("Motivo corregido");
    expect(screen.getByLabelText("Motivo de consulta corregido")).toHaveValue(editedAfter ? "Edicion posterior ficticia" : "Motivo corregido");
    expect(screen.getByLabelText("Justificación de la corrección")).toHaveValue(editedAfter ? "Error ficticio" : "");
    expect(screen.queryByRole("region", { name: "Guardados por confirmar" })).not.toBeInTheDocument();
    expect(attempts).toBe(action === "Consultar resultado" ? 1 : 2);
  });

  it.each(["Motivo ficticio\nSegundo renglón", ""])("envía el ingreso con motivo opcional: %j", async reason => {
    localStorage.setItem("token", "ficticio");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path === "/auth/me") return response({ username: "recepcion", role: "RECEPTION" });
      if (path === "/dashboard") return response({ active: 0, open_alerts: 0, patients: [], requested_by: "recepcion" });
      if (path === "/episodes" && init?.method === "POST") {
        const payload = JSON.parse(String(init.body));
        if (reason) expect(payload.consultation_reason).toBe(reason);
        else expect(payload).not.toHaveProperty("consultation_reason");
        return response({ ...episode, consultation_reason: payload.consultation_reason ?? null }, 201);
      }
      throw new Error(`Petición inesperada: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Nuevo ingreso" }));
    for (const [label, value] of [["Nombre completo", episode.name], ["Fecha de nacimiento", episode.birth_date], ["Documento", episode.document]]) {
      fireEvent.change(screen.getByLabelText(label!), { target: { value } });
    }
    const field = screen.getByLabelText("Motivo de consulta (opcional)");
    expect(field).not.toBeRequired();
    expect(field).toHaveAttribute("minlength", "3");
    expect(field).toHaveAttribute("maxlength", "1000");
    fireEvent.change(field, { target: { value: reason } });
    await user.click(screen.getByRole("button", { name: "Crear episodio y pulsera" }));
    await screen.findByText("Motivo de consulta:");
    expect(screen.getByText("Motivo de consulta:").parentElement!.textContent).toContain(reason || "No registrado");
    await waitFor(() => expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1));
  });

  it.each(["ACTIVE", "CLOSED"])("muestra el motivo como texto legible en un episodio %s", status => {
    const reason = 'Motivo ficticio\n<script>texto literal</script>';
    render(<EpisodePage episode={{ ...episode, status, consultation_reason: reason }}
      user={{ username: "medico", role: "DOCTOR", access_token: "ficticio" }} updateEpisode={vi.fn()} showError={vi.fn()} />);
    const description = screen.getByText("Motivo de consulta:").parentElement!;
    expect(description.textContent).toContain(reason);
    expect(description).toHaveStyle({ whiteSpace: "pre-wrap", overflowWrap: "anywhere" });
    expect(description.querySelector("script")).toBeNull();
  });

  it("identifica un episodio antiguo sin inventar el motivo", () => {
    render(<EpisodePage episode={episode} user={{ username: "enfermeria", role: "NURSE", access_token: "ficticio" }}
      updateEpisode={vi.fn()} showError={vi.fn()} />);
    expect(screen.getByText("Motivo de consulta:").parentElement).toHaveTextContent("No registrado");
  });
});
