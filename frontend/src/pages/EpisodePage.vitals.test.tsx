import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EpisodePage from "./EpisodePage";
import { establishSession } from "../api/client";
import type { Episode, User } from "../types/clinical";

const episode: Episode = {
  id: 45, name: "Paciente ficticio 45A", birth_date: "1990-01-01",
  document: "TEST-45A", qr_token: "qr-45a", status: "ACTIVE", priority: 3,
  location: "Observacion", started_at: "2026-10-11T12:00:00Z",
  vitals: [], alerts: [], tasks: [], events: [],
};
const response = (data: unknown, status = 200) => ({
  ok: status < 400, status, json: async () => data,
}) as Response;
const labels = ["Temperatura", "Frecuencia card\u00edaca", "Sist\u00f3lica", "Diast\u00f3lica", "SpO\u2082", "Frecuencia respiratoria"];
const values = [38.2, 110, 130, 85, 96, 22];
const payload = { temperature: 38.2, heart_rate: 110, systolic: 130, diastolic: 85, spo2: 96, respiratory_rate: 22 };
function prepare(role: User["role"] = "DOCTOR", data = episode) {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const updateEpisode = vi.fn();
  const showError = vi.fn();
  render(<EpisodePage episode={data} user={{ username: "demo", role, access_token: "test-token" }} updateEpisode={updateEpisode} showError={showError} />);
  return { fetchMock, updateEpisode, showError };
}
function fill() {
  fireEvent.click(screen.getByText("Registrar nuevos signos"));
  labels.forEach((label, index) => fireEvent.change(screen.getByLabelText(label), { target: { value: values[index] } }));
  return screen.getByRole("button", { name: "Guardar y evaluar reglas" });
}
afterEach(() => vi.unstubAllGlobals());

describe("Envio de signos vitales", () => {
  it.each(["DOCTOR", "NURSE"] as const)("bloquea duplicados para %s y conserva el payload antes de deshabilitar", async (role) => {
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
    expect(button).toHaveTextContent("Guardando signos\u2026");
    labels.forEach((label, index) => {
      expect(screen.getByLabelText(label)).toBeDisabled();
      expect(screen.getByLabelText(label)).toHaveValue(values[index]);
    });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/episodes/45/vitals");
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

  it.each(["API", "red", "401"])("habilita tras %s, conserva valores y permite reintento explicito", async (failure) => {
    const { fetchMock, showError, updateEpisode } = prepare();
    const button = fill();
    establishSession("test-token");
    if (failure === "red") fetchMock.mockRejectedValueOnce(new Error("Error 45A"));
    else fetchMock.mockResolvedValueOnce(response({ detail: "Error 45A" }, failure === "401" ? 401 : 422));
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeEnabled());
    labels.forEach((label, index) => expect(screen.getByLabelText(label)).toHaveValue(values[index]));
    expect(updateEpisode).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    if (failure === "401") {
      expect(showError).not.toHaveBeenCalled();
      expect(localStorage.getItem("token")).toBeNull();
      establishSession("new-test-token");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } else {
      expect(screen.getByRole("alert")).toHaveTextContent("Error 45A");
      expect(screen.getByRole("alert").closest("form")).toBe(button.closest("form"));
    }
    expect(showError).not.toHaveBeenCalled();
    expect(screen.queryByText("Signos vitales guardados")).not.toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(response(episode));
    fireEvent.click(button);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => expect(updateEpisode).toHaveBeenCalledWith(episode));
    expect(screen.getByText("Signos vitales guardados")).toHaveAttribute("role", "status");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(payload);
  });

  it.each(["CLOSED", "RECEPTION"])("no ofrece registro para %s", (condition) => {
    const { fetchMock } = prepare(condition === "RECEPTION" ? "RECEPTION" : "DOCTOR", condition === "CLOSED" ? { ...episode, status: "CLOSED" } : episode);
    expect(screen.queryByText("Registrar nuevos signos")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("el bloqueo de signos no bloquea la evaluacion medica", async () => {
    const { fetchMock } = prepare();
    const button = fill();
    let resolve!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Guardar evaluaci\u00f3n m\u00e9dica" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Crear y asignar orden" })).toBeEnabled();
    resolve(response(episode));
    await waitFor(() => expect(button).toBeEnabled());
  });
});

describe("Mensajes de signos vitales 46A", () => {
  it("confirma solo tras exito y retira la confirmacion al editar", async () => {
    const { fetchMock } = prepare();
    const button = fill();
    let resolve!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    fireEvent.click(button);
    expect(screen.queryByText("Signos vitales guardados")).not.toBeInTheDocument();
    resolve(response(episode));
    expect(await screen.findByText("Signos vitales guardados")).toHaveAttribute("role", "status");
    fireEvent.change(screen.getByLabelText(labels[0]), { target: { value: 39 } });
    expect(screen.queryByText("Signos vitales guardados")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["API", "red", "401"])("retira exito anterior al reenviar y no lo revive ante %s", async (failure) => {
    const { fetchMock, showError } = prepare();
    const button = fill();
    fetchMock.mockResolvedValueOnce(response(episode));
    fireEvent.click(button);
    await screen.findByText("Signos vitales guardados");
    establishSession("test-token");
    let resolve!: (value: Response) => void;
    let reject!: (reason: Error) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done, fail) => { resolve = done; reject = fail; }));
    fireEvent.click(button);
    expect(screen.queryByText("Signos vitales guardados")).not.toBeInTheDocument();
    if (failure === "red") reject(new Error("Error 46A"));
    else resolve(response({ detail: "Error 46A" }, failure === "401" ? 401 : 422));
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.queryByText("Signos vitales guardados")).not.toBeInTheDocument();
    if (failure === "401") expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    else expect(screen.getByRole("alert")).toHaveTextContent("Error 46A");
    expect(showError).not.toHaveBeenCalled();
  });

  it.each(["API", "red"])("editar retira error de %s conservando otros valores sin reenviar", async (failure) => {
    const { fetchMock } = prepare();
    const button = fill();
    if (failure === "red") fetchMock.mockRejectedValueOnce(new Error("Error 46A"));
    else fetchMock.mockResolvedValueOnce(response({ detail: "Error 46A" }, 422));
    fireEvent.click(button);
    await screen.findByRole("alert");
    fireEvent.change(screen.getByLabelText(labels[0]), { target: { value: 39 } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText(labels[0])).toHaveValue(39);
    labels.slice(1).forEach((label, index) => expect(screen.getByLabelText(label)).toHaveValue(values[index + 1]));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("editar y guardar evaluacion mantiene el error de signos independiente", async () => {
    const { fetchMock } = prepare();
    const button = fill();
    fetchMock.mockResolvedValueOnce(response({ detail: "Error signos 46A" }, 422));
    fireEvent.click(button);
    await screen.findByRole("alert");
    fireEvent.change(screen.getByLabelText("Diagn\u00f3stico o impresi\u00f3n cl\u00ednica"), { target: { value: "Diagnostico ficticio 46A" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Error signos 46A");
    fetchMock.mockResolvedValueOnce(response(episode));
    fireEvent.submit(screen.getByRole("button", { name: "Guardar evaluaci\u00f3n m\u00e9dica" }).closest("form")!);
    await screen.findByText("Evaluaci\u00f3n guardada");
    expect(screen.getByRole("alert")).toHaveTextContent("Error signos 46A");
    expect(screen.queryByText("Signos vitales guardados")).not.toBeInTheDocument();
  });
});
