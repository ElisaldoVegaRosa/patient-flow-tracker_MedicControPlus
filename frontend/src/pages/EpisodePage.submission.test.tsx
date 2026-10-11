import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EpisodePage from "./EpisodePage";
import type { Episode, User } from "../types/clinical";

const episode: Episode = {
  id: 42, name: "Paciente ficticio 39A", birth_date: "1990-01-01",
  document: "TEST-39A", qr_token: "qr-39a", status: "ACTIVE", priority: 3,
  location: "Observación", started_at: "2026-10-10T12:00:00Z",
  vitals: [], alerts: [], tasks: [], events: [],
};
const doctor: User = { username: "medico", role: "DOCTOR", access_token: "test-token" };
const response = (data: unknown, status = 200) => ({
  ok: status < 400, status, json: async () => data,
}) as Response;
const forms = [
  {
    name: "evaluación médica", button: "Guardar evaluación médica",
    path: "/episodes/42/medical-evaluation",
    fields: [
      ["Diagnóstico o impresión clínica", "Diagnóstico ficticio"],
      ["Nota de evaluación", "Nota ficticia con seguimiento."],
      ["Decisión médica", "ORDER_TESTS"],
    ],
    payload: { diagnosis: "Diagnóstico ficticio", clinical_note: "Nota ficticia con seguimiento.", disposition: "ORDER_TESTS" },
    defaults: ["", "", "CONTINUE_OBSERVATION"],
  },
  {
    name: "orden clínica", button: "Crear y asignar orden",
    path: "/episodes/42/tasks",
    fields: [["Orden o procedimiento solicitado", "Orden ficticia"], ["Servicio responsable", "NURSING"]],
    payload: { title: "Orden ficticia", service: "NURSING" },
    defaults: ["", "LAB"],
  },
];

describe.each(forms)("Envío de $name", (form) => {
  afterEach(() => vi.unstubAllGlobals());

  function prepare() {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const updateEpisode = vi.fn();
    const showError = vi.fn();
    render(<EpisodePage episode={episode} user={doctor} updateEpisode={updateEpisode} showError={showError} />);
    for (const [label, value] of form.fields) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    const submit = () => fireEvent.submit(screen.getByRole("button", { name: form.button }).closest("form")!);
    return { fetchMock, updateEpisode, showError, submit };
  }

  it.each(["error de API", "fallo de red"])("conserva todos los campos ante %s y permite reintento explícito", async (failure) => {
    const { fetchMock, updateEpisode, showError, submit } = prepare();
    const message = failure === "error de API" ? "Rechazo ficticio" : "Fallo de red ficticio";
    if (failure === "error de API") fetchMock.mockResolvedValueOnce(response({ detail: message }, 422));
    else fetchMock.mockRejectedValueOnce(new Error(message));
    submit();
    await waitFor(() => expect(showError).toHaveBeenCalledWith(message));
    for (const [label, value] of form.fields) expect(screen.getByLabelText(label)).toHaveValue(value);
    expect(updateEpisode).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(response(episode));
    submit();
    await waitFor(() => expect(updateEpisode).toHaveBeenCalledWith(episode));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toContain(form.path);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(form.payload);
    await waitFor(() => form.fields.forEach(([label], index) => {
      expect(screen.getByLabelText(label)).toHaveValue(form.defaults[index]);
    }));
  });

  it("conserva los campos mientras espera y los vacía solo al confirmar éxito", async () => {
    const { fetchMock, updateEpisode, showError, submit } = prepare();
    let resolve!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    submit();
    for (const [label, value] of form.fields) expect(screen.getByLabelText(label)).toHaveValue(value);
    expect(updateEpisode).not.toHaveBeenCalled();
    resolve(response(episode));
    await waitFor(() => form.fields.forEach(([label], index) => {
      expect(screen.getByLabelText(label)).toHaveValue(form.defaults[index]);
    }));
    expect(updateEpisode).toHaveBeenCalledWith(episode);
    expect(showError).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
