import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import EpisodePage from "./EpisodePage";
import type { Episode, User } from "../types/clinical";
import { establishSession } from "../api/client";

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
    name: "evaluación médica", button: "Guardar evaluación médica", success: "Evaluación guardada",
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
    name: "orden clínica", button: "Crear y asignar orden", success: "Orden creada",
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
    const element = screen.getByRole("button", { name: form.button }).closest("form")!;
    const submit = () => fireEvent.submit(element);
    return { fetchMock, updateEpisode, showError, submit };
  }

  it.each(["error de API", "fallo de red"])("conserva todos los campos ante %s y permite reintento explícito", async (failure) => {
    const { fetchMock, updateEpisode, showError, submit } = prepare();
    const message = failure === "error de API" ? "Rechazo ficticio" : "Fallo de red ficticio";
    if (failure === "error de API") fetchMock.mockResolvedValueOnce(response({ detail: message }, 422));
    else fetchMock.mockRejectedValueOnce(new Error(message));
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(showError).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: form.button })).toBeEnabled();
    for (const [label, value] of form.fields) expect(screen.getByLabelText(label)).toHaveValue(value);
    expect(updateEpisode).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(form.success)).not.toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(response(episode));
    submit();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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

  it.each(["API", "red"])("retira el error de %s al editar sin reenviar", async (failure) => {
    const { fetchMock, showError, submit } = prepare();
    if (failure === "API") fetchMock.mockResolvedValueOnce(response({ detail: "Error 44A" }, 422));
    else fetchMock.mockRejectedValueOnce(new Error("Error 44A"));
    submit();
    const alert = await screen.findByRole("alert");
    expect(alert.closest("form")).toBe(screen.getByRole("button", { name: form.button }).closest("form"));
    fireEvent.change(screen.getByLabelText(form.fields[0][0]), { target: { value: "Correccion 44A" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText(form.fields[0][0])).toHaveValue("Correccion 44A");
    for (const [label, value] of form.fields.slice(1)) expect(screen.getByLabelText(label)).toHaveValue(value);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(showError).not.toHaveBeenCalled();
  });

  it("bloquea clics y submits repetidos mientras está en curso y habilita al terminar", async () => {
    const { fetchMock, submit } = prepare();
    let resolve!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    const button = screen.getByRole("button", { name: form.button });
    fireEvent.click(button);
    submit();
    fireEvent.click(button);
    submit();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(form.path.endsWith('/tasks') ? 'Creando orden…' : 'Guardando…');
    for (const [label] of form.fields) expect(screen.getByLabelText(label)).toBeDisabled();
    resolve(response(episode));
    await waitFor(() => expect(button).toBeEnabled());
    for (const [label] of form.fields) expect(screen.getByLabelText(label)).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("libera el bloqueo tras interrupción de sesión sin vaciar ni mostrar un error ordinario", async () => {
    const { fetchMock, updateEpisode, showError, submit } = prepare();
    establishSession('test-token');
    fetchMock.mockResolvedValueOnce(response({}, 401));
    submit();
    await waitFor(() => expect(screen.getByRole('button', { name: form.button })).toBeEnabled());
    for (const [label, value] of form.fields) expect(screen.getByLabelText(label)).toHaveValue(value);
    expect(updateEpisode).not.toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalled();
    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.queryByText(form.success)).not.toBeInTheDocument();
  });

  it("conserva los campos mientras espera y los vacía solo al confirmar éxito", async () => {
    const { fetchMock, updateEpisode, showError, submit } = prepare();
    let resolve!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    submit();
    for (const [label, value] of form.fields) expect(screen.getByLabelText(label)).toHaveValue(value);
    expect(updateEpisode).not.toHaveBeenCalled();
    expect(screen.queryByText(form.success)).not.toBeInTheDocument();
    resolve(response(episode));
    await waitFor(() => form.fields.forEach(([label], index) => {
      expect(screen.getByLabelText(label)).toHaveValue(form.defaults[index]);
    }));
    expect(updateEpisode).toHaveBeenCalledWith(episode);
    expect(showError).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("anuncia éxito y retira la confirmación al comenzar una nueva edición", async () => {
    const { fetchMock, submit } = prepare();
    fetchMock.mockResolvedValueOnce(response(episode));
    submit();
    const confirmation = await screen.findByText(form.success);
    expect(confirmation).toHaveAttribute('role', 'status');
    await userEvent.type(screen.getByLabelText(form.fields[0][0]), 'Nueva edición ficticia');
    expect(screen.queryByText(form.success)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(['API', 'red'])("un nuevo envío retira el éxito anterior y no lo revive ante error de %s", async (failure) => {
    const { fetchMock, submit, showError } = prepare();
    fetchMock.mockResolvedValueOnce(response(episode));
    submit();
    await screen.findByText(form.success);
    let reject!: (reason: Error) => void;
    let resolve!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done, fail) => { resolve = done; reject = fail; }));
    submit();
    expect(screen.queryByText(form.success)).not.toBeInTheDocument();
    if (failure === 'API') resolve(response({ detail: 'Error ficticio 43A' }, 422));
    else reject(new Error('Error ficticio 43A'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Error ficticio 43A');
    expect(showError).not.toHaveBeenCalled();
    expect(screen.queryByText(form.success)).not.toBeInTheDocument();
  });
});

it("editar la evaluación no retira la confirmación de una orden creada", async () => {
  const fetchMock = vi.fn().mockResolvedValue(response(episode));
  vi.stubGlobal('fetch', fetchMock);
  try {
    render(<EpisodePage episode={episode} user={doctor} updateEpisode={vi.fn()} showError={vi.fn()} />);
    for (const form of forms) {
      for (const [label, value] of form.fields) fireEvent.change(screen.getByLabelText(label), { target: { value } });
      fireEvent.submit(screen.getByRole('button', { name: form.button }).closest('form')!);
      await screen.findByText(form.success);
    }
    expect(screen.getByText(forms[0].success)).toBeVisible();
    expect(screen.getByText(forms[1].success)).toBeVisible();
    fireEvent.change(screen.getByLabelText(forms[0].fields[0][0]), { target: { value: 'Nueva evaluación ficticia' } });
    expect(screen.queryByText(forms[0].success)).not.toBeInTheDocument();
    expect(screen.getByText(forms[1].success)).toBeVisible();
  } finally {
    vi.unstubAllGlobals();
  }
});

it("los dos formularios mantienen bloqueos independientes", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  try {
    render(<EpisodePage episode={episode} user={doctor} updateEpisode={vi.fn()} showError={vi.fn()} />);
    for (const form of forms) {
      for (const [label, value] of form.fields) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    let resolve!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    fireEvent.click(screen.getByRole('button', { name: forms[0].button }));
    const order = screen.getByRole('button', { name: forms[1].button });
    expect(order).toBeEnabled();
    fetchMock.mockResolvedValueOnce(response(episode));
    fireEvent.click(order);
    await waitFor(() => expect(order).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    resolve(response(episode));
    await waitFor(() => expect(screen.getByRole('button', { name: forms[0].button })).toBeEnabled());
  } finally {
    vi.unstubAllGlobals();
  }
});

it("los errores son independientes al editar y guardar otro formulario", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const showError = vi.fn();
  try {
    render(<EpisodePage episode={episode} user={doctor} updateEpisode={vi.fn()} showError={showError} />);
    for (const [index, form] of forms.entries()) {
      for (const [label, value] of form.fields) fireEvent.change(screen.getByLabelText(label), { target: { value } });
      fetchMock.mockResolvedValueOnce(response({ detail: `Error formulario ${index}` }, 422));
      fireEvent.submit(screen.getByRole("button", { name: form.button }).closest("form")!);
      await screen.findByText(`Error formulario ${index}`);
    }
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText(forms[0].fields[0][0]), { target: { value: "Correccion 44A" } });
    expect(screen.queryByText("Error formulario 0")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Error formulario 1");
    fetchMock.mockResolvedValueOnce(response(episode));
    fireEvent.submit(screen.getByRole("button", { name: forms[0].button }).closest("form")!);
    await screen.findByText(forms[0].success);
    expect(screen.getByRole("alert")).toHaveTextContent("Error formulario 1");
    expect(showError).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
