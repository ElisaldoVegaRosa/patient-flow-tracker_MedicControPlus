import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EpisodePage from "./EpisodePage";
import { establishSession } from "../api/client";
import type { Episode } from "../types/clinical";

const episode: Episode = {
  id: 47, name: "Paciente ficticio 47A", birth_date: "1990-01-01",
  document: "TEST-47A", qr_token: "qr-47a", status: "ACTIVE", priority: 3,
  location: "Observaci\u00f3n", started_at: "2026-10-11T12:00:00Z",
  vitals: [], alerts: [], tasks: [], events: [],
};
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response;
const labels = ["Prioridad", "\u00c1rea o ubicaci\u00f3n", "Personal responsable"];
const values = ["2", "Triaje", "Enfermeria ficticia 47A"];
const payload = { priority: 2, location: "Triaje", assigned_to: values[2] };
function prepare(role = "NURSE", data = episode) {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const updateEpisode = vi.fn();
  const showError = vi.fn();
  render(<EpisodePage episode={data} user={{ username: "demo", role, access_token: "test-token" }} updateEpisode={updateEpisode} showError={showError} />);
  return { fetchMock, updateEpisode, showError };
}
function fill() {
  labels.forEach((label, index) => fireEvent.change(screen.getByLabelText(label), { target: { value: values[index] } }));
  return screen.getByRole("button", { name: "Guardar triaje y asignaci\u00f3n" });
}
afterEach(() => vi.unstubAllGlobals());

describe("Envio de triaje 47A", () => {
  it.each(["NURSE", "SUPERVISOR"])("bloquea duplicados para %s y captura valores antes del bloqueo", async (role) => {
    const { fetchMock, updateEpisode } = prepare(role);
    const button = fill();
    const form = button.closest("form")!;
    let resolve!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    fireEvent.click(button);
    fireEvent.submit(form);
    fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Guardando triaje\u2026");
    labels.forEach((label, index) => {
      expect(screen.getByLabelText(label)).toBeDisabled();
      expect(screen.getByLabelText(label)).toHaveValue(values[index]);
    });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/episodes/47/triage");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual(payload);
    resolve(response(episode));
    await waitFor(() => expect(button).toBeEnabled());
    expect(updateEpisode).toHaveBeenCalledWith(episode);
    labels.forEach((label, index) => {
      expect(screen.getByLabelText(label)).toBeEnabled();
      expect(screen.getByLabelText(label)).toHaveValue(values[index]);
    });
    fetchMock.mockResolvedValueOnce(response(episode));
    fireEvent.submit(form);
    await waitFor(() => expect(button).toBeEnabled());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(["API", "red", "401"])("libera tras %s, conserva valores y permite reintento explicito", async (failure) => {
    const { fetchMock, showError, updateEpisode } = prepare();
    const button = fill();
    establishSession("test-token");
    if (failure === "red") fetchMock.mockRejectedValueOnce(new Error("Error 47A"));
    else fetchMock.mockResolvedValueOnce(response({ detail: "Error 47A" }, failure === "401" ? 401 : 422));
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeEnabled());
    labels.forEach((label, index) => {
      expect(screen.getByLabelText(label)).toHaveValue(values[index]);
      expect(screen.getByLabelText(label)).toBeEnabled();
    });
    expect(updateEpisode).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    if (failure === "401") {
      expect(showError).not.toHaveBeenCalled();
      expect(localStorage.getItem("token")).toBeNull();
      establishSession("new-test-token");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } else {
      expect(screen.getByRole("alert")).toHaveTextContent("Error 47A");
      expect(screen.getByRole("alert").closest("form")).toBe(button.closest("form"));
    }
    expect(showError).not.toHaveBeenCalled();
    expect(screen.queryByText("Triaje y asignaci\u00f3n guardados")).not.toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(response(episode));
    fireEvent.click(button);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => expect(updateEpisode).toHaveBeenCalledWith(episode));
    expect(screen.getByText("Triaje y asignaci\u00f3n guardados")).toHaveAttribute("role", "status");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(payload);
  });

  it.each(["CLOSED", "DOCTOR", "RECEPTION", "LAB"])("no ofrece triaje para %s", (condition) => {
    const { fetchMock } = prepare(condition === "CLOSED" ? "NURSE" : condition, condition === "CLOSED" ? { ...episode, status: "CLOSED" } : episode);
    expect(screen.queryByRole("button", { name: "Guardar triaje y asignaci\u00f3n" })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("el bloqueo de triaje es independiente del registro de signos", async () => {
    const { fetchMock } = prepare();
    const button = fill();
    let resolve!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    fireEvent.click(button);
    fireEvent.click(screen.getByText("Registrar nuevos signos"));
    expect(screen.getByRole("button", { name: "Guardar y evaluar reglas" })).toBeEnabled();
    resolve(response(episode));
    await waitFor(() => expect(button).toBeEnabled());
  });
});

describe("Mensajes de triaje 48A", () => {
  it("confirma solo tras exito y retira la confirmacion al editar", async () => {
    const { fetchMock } = prepare();
    const button = fill();
    let resolve!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    fireEvent.click(button);
    expect(screen.queryByText("Triaje y asignaci\u00f3n guardados")).not.toBeInTheDocument();
    resolve(response(episode));
    expect(await screen.findByText("Triaje y asignaci\u00f3n guardados")).toHaveAttribute("role", "status");
    fireEvent.change(screen.getByLabelText(labels[0]), { target: { value: "1" } });
    expect(screen.queryByText("Triaje y asignaci\u00f3n guardados")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["API", "red", "401"])("retira exito anterior al reenviar y no lo revive ante %s", async (failure) => {
    const { fetchMock, showError } = prepare();
    const button = fill();
    fetchMock.mockResolvedValueOnce(response(episode));
    fireEvent.click(button);
    await screen.findByText("Triaje y asignaci\u00f3n guardados");
    establishSession("test-token");
    let resolve!: (value: Response) => void;
    let reject!: (reason: Error) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done, fail) => { resolve = done; reject = fail; }));
    fireEvent.click(button);
    expect(screen.queryByText("Triaje y asignaci\u00f3n guardados")).not.toBeInTheDocument();
    if (failure === "red") reject(new Error("Error 48A"));
    else resolve(response({ detail: "Error 48A" }, failure === "401" ? 401 : 422));
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.queryByText("Triaje y asignaci\u00f3n guardados")).not.toBeInTheDocument();
    if (failure === "401") expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    else expect(screen.getByRole("alert")).toHaveTextContent("Error 48A");
    expect(showError).not.toHaveBeenCalled();
  });

  it.each(["API", "red"])("editar retira error de %s conservando otros valores sin reenviar", async (failure) => {
    const { fetchMock } = prepare();
    const button = fill();
    if (failure === "red") fetchMock.mockRejectedValueOnce(new Error("Error 48A"));
    else fetchMock.mockResolvedValueOnce(response({ detail: "Error 48A" }, 422));
    fireEvent.click(button);
    await screen.findByRole("alert");
    fireEvent.change(screen.getByLabelText(labels[0]), { target: { value: "1" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText(labels[0])).toHaveValue("1");
    labels.slice(1).forEach((label, index) => expect(screen.getByLabelText(label)).toHaveValue(values[index + 1]));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("editar y guardar signos mantiene el error de triaje independiente", async () => {
    const { fetchMock } = prepare();
    const button = fill();
    fetchMock.mockResolvedValueOnce(response({ detail: "Error triaje 48A" }, 422));
    fireEvent.click(button);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByText("Registrar nuevos signos"));
    fireEvent.change(screen.getByLabelText("Temperatura"), { target: { value: 38 } });
    expect(screen.getByRole("alert")).toHaveTextContent("Error triaje 48A");
    fetchMock.mockResolvedValueOnce(response(episode));
    fireEvent.click(screen.getByRole("button", { name: "Guardar y evaluar reglas" }));
    await screen.findByText("Signos vitales guardados");
    expect(screen.getByRole("alert")).toHaveTextContent("Error triaje 48A");
    expect(screen.queryByText("Triaje y asignaci\u00f3n guardados")).not.toBeInTheDocument();
  });
});
