import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EpisodePage from "./EpisodePage";
import { establishSession } from "../api/client";
import type { ClinicalAlert, Episode } from "../types/clinical";

function alert(id: number, status = "ACTIVE"): ClinicalAlert {
  return { id, episode_id: 49, status, reason: `Alerta ficticia ${id}`, severity: "HIGH", responsible: null,
    created_at: "2026-10-11T12:00:00Z", updated_at: "2026-10-11T12:00:00Z", history: [] };
}
const episode: Episode = {
  id: 49, name: "Paciente ficticio 49A", birth_date: "1990-01-01", document: "TEST-49A",
  qr_token: "qr-49a", status: "ACTIVE", priority: 3, location: "Triaje", started_at: "2026-10-11T12:00:00Z",
  vitals: [], alerts: [alert(1), alert(2)], tasks: [], events: [],
};
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response;
function prepare(data = episode, role = "DOCTOR") {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const updateEpisode = vi.fn();
  const showError = vi.fn();
  const props = { episode: data, user: { username: "demo", role, access_token: "test-token" }, updateEpisode, showError };
  const view = render(<EpisodePage {...props} />);
  const row = (id: number) => within(screen.getByText(`HIGH \u00b7 Alerta ficticia ${id}`).closest("article")!);
  return { fetchMock, updateEpisode, showError, row, view, props };
}
afterEach(() => vi.unstubAllGlobals());

describe("Bloqueo por alerta 49A", () => {
  it.each([
    ["Reconocer", "ACTIVE", "ACKNOWLEDGED", "NURSE"],
    ["Escalar", "ACKNOWLEDGED", "ESCALATED", "SUPERVISOR"],
    ["Resolver", "ESCALATED", "RESOLVED", "DOCTOR"],
  ])("%s bloquea repeticiones y otras acciones de la misma alerta", async (buttonName, initial, target, role) => {
    const { fetchMock, row, updateEpisode } = prepare({ ...episode, alerts: [alert(1, initial), alert(2)] }, role);
    let resolve!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    const button = row(1).getByRole("button", { name: buttonName });
    fireEvent.click(button);
    fireEvent.click(button);
    for (const action of row(1).getAllByRole("button")) {
      expect(action).toBeDisabled();
      fireEvent.click(action);
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(row(1).getByRole("status")).toHaveTextContent("Actualizando alerta\u2026");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/alerts/1");
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ status: target });
    resolve(response(episode));
    await waitFor(() => expect(button).toBeEnabled());
    expect(row(1).queryByRole("status")).not.toBeInTheDocument();
    expect(updateEpisode).toHaveBeenCalledWith(episode);
  });

  it.each(["API", "red", "401"])("libera bloqueo tras %s y permite reintento explicito", async (failure) => {
    const { fetchMock, row, showError, updateEpisode } = prepare();
    establishSession("test-token");
    if (failure === "red") fetchMock.mockRejectedValueOnce(new Error("Error 49A"));
    else fetchMock.mockResolvedValueOnce(response({ detail: "Error 49A" }, failure === "401" ? 401 : 422));
    const button = row(1).getByRole("button", { name: "Reconocer" });
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeEnabled());
    expect(row(1).queryByRole("status")).not.toBeInTheDocument();
    expect(row(1).getByText("ACTIVE")).toBeVisible();
    expect(updateEpisode).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    if (failure === "401") {
      expect(showError).not.toHaveBeenCalled();
      expect(localStorage.getItem("token")).toBeNull();
      establishSession("new-test-token");
    } else expect(showError).toHaveBeenCalledWith("Error 49A");
    fetchMock.mockResolvedValueOnce(response(episode));
    fireEvent.click(button);
    await waitFor(() => expect(updateEpisode).toHaveBeenCalledWith(episode));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("dos alertas mantienen solicitudes y desbloqueos independientes", async () => {
    const { fetchMock, row } = prepare();
    let resolveFirst!: (value: Response) => void;
    let resolveSecond!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolveFirst = done; }));
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolveSecond = done; }));
    fireEvent.click(row(1).getByRole("button", { name: "Reconocer" }));
    const second = row(2).getByRole("button", { name: "Escalar" });
    expect(second).toBeEnabled();
    fireEvent.click(second);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    resolveSecond(response(episode));
    await waitFor(() => expect(second).toBeEnabled());
    expect(row(1).getByRole("button", { name: "Escalar" })).toBeDisabled();
    expect(row(1).getByRole("status")).toBeVisible();
    resolveFirst(response(episode));
    await waitFor(() => expect(row(1).getByRole("button", { name: "Escalar" })).toBeEnabled());
  });

  it("tras respuesta exitosa refleja la transicion y ofrece la siguiente accion", async () => {
    const { fetchMock, row, view, props, updateEpisode } = prepare();
    const updated = { ...episode, alerts: [alert(1, "ACKNOWLEDGED"), alert(2)] };
    fetchMock.mockResolvedValueOnce(response(updated));
    fireEvent.click(row(1).getByRole("button", { name: "Reconocer" }));
    await waitFor(() => expect(updateEpisode).toHaveBeenCalledWith(updated));
    view.rerender(<EpisodePage {...props} episode={updated} />);
    expect(row(1).queryByRole("button", { name: "Reconocer" })).not.toBeInTheDocument();
    expect(row(1).getByRole("button", { name: "Resolver" })).toBeEnabled();
    expect(row(1).queryByRole("status")).not.toBeInTheDocument();
  });
});
