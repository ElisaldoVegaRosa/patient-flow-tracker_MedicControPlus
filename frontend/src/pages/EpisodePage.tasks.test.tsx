import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EpisodePage from "./EpisodePage";
import { establishSession } from "../api/client";
import type { ClinicalTask, Episode } from "../types/clinical";

function task(id: number, status = "PENDING"): ClinicalTask {
  return { id, episode_id: 50, status, title: `Tarea ficticia ${id}`, service: "NURSING", result: null };
}
const episode: Episode = {
  id: 50, name: "Paciente ficticio 50A", birth_date: "1990-01-01", document: "TEST-50A",
  qr_token: "qr-50a", status: "ACTIVE", priority: 3, location: "Triaje", started_at: "2026-10-11T12:00:00Z",
  vitals: [], alerts: [], tasks: [task(1), task(2)], events: [],
};
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response;
function prepare(data = episode, role = "DOCTOR") {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const updateEpisode = vi.fn();
  const showError = vi.fn();
  const onOpenLaboratory = vi.fn();
  const props = { episode: data, user: { username: "demo", role, access_token: "test-token" }, updateEpisode, showError, onOpenLaboratory };
  const view = render(<EpisodePage {...props} />);
  const row = (id: number) => within(screen.getByText(`Tarea ficticia ${id}`).closest("article")!);
  return { fetchMock, updateEpisode, showError, onOpenLaboratory, row, view, props };
}
afterEach(() => vi.unstubAllGlobals());

describe("Bloqueo por tarea 50A", () => {
  it.each(["NURSE", "LAB", "DOCTOR"])("bloquea clics repetidos para %s y libera tras exito", async (role) => {
    const { fetchMock, row, updateEpisode } = prepare(episode, role);
    let resolve!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    const button = row(1).getByRole("button", { name: "Completar" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Completando\u2026");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/tasks/1/complete");
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ result: "Completada sin novedades" });
    resolve(response(episode));
    await waitFor(() => expect(button).toBeEnabled());
    expect(button).toHaveTextContent("Completar");
    expect(updateEpisode).toHaveBeenCalledWith(episode);
  });

  it.each(["API", "red", "401"])("libera bloqueo tras %s y permite reintento explicito", async (failure) => {
    const { fetchMock, row, showError, updateEpisode } = prepare();
    establishSession("test-token");
    if (failure === "red") fetchMock.mockRejectedValueOnce(new Error("Error 50A"));
    else fetchMock.mockResolvedValueOnce(response({ detail: "Error 50A" }, failure === "401" ? 401 : 422));
    const button = row(1).getByRole("button", { name: "Completar" });
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeEnabled());
    expect(button).toHaveTextContent("Completar");
    expect(screen.getByText("Tarea ficticia 1")).toBeVisible();
    expect(updateEpisode).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    if (failure === "401") {
      expect(showError).not.toHaveBeenCalled();
      expect(localStorage.getItem("token")).toBeNull();
      establishSession("new-test-token");
      expect(row(1).queryByRole("alert")).not.toBeInTheDocument();
    } else expect(row(1).getByRole("alert")).toHaveTextContent("Error 50A");
    expect(showError).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(response(episode));
    fireEvent.click(button);
    expect(row(1).queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => expect(updateEpisode).toHaveBeenCalledWith(episode));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("dos tareas mantienen solicitudes y desbloqueos independientes", async () => {
    const { fetchMock, row } = prepare();
    let resolveFirst!: (value: Response) => void;
    let resolveSecond!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolveFirst = done; }));
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolveSecond = done; }));
    const first = row(1).getByRole("button", { name: "Completar" });
    fireEvent.click(first);
    const second = row(2).getByRole("button", { name: "Completar" });
    expect(second).toBeEnabled();
    fireEvent.click(second);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    resolveSecond(response(episode));
    await waitFor(() => expect(second).toBeEnabled());
    expect(first).toBeDisabled();
    resolveFirst(response(episode));
    await waitFor(() => expect(first).toBeEnabled());
  });

  it("la respuesta exitosa retira la tarea completada de pendientes", async () => {
    const { fetchMock, row, view, props, updateEpisode } = prepare();
    const updated = { ...episode, tasks: [task(1, "COMPLETED"), task(2)] };
    fetchMock.mockResolvedValueOnce(response(updated));
    fireEvent.click(row(1).getByRole("button", { name: "Completar" }));
    await waitFor(() => expect(updateEpisode).toHaveBeenCalledWith(updated));
    view.rerender(<EpisodePage {...props} episode={updated} />);
    expect(row(1).getByText("Completada", { exact: false })).toBeVisible();
    expect(row(1).queryByRole("button", { name: "Completar" })).not.toBeInTheDocument();
    expect(row(2).getByRole("button", { name: "Completar" })).toBeEnabled();
  });

  it("un episodio CLOSED no ofrece completar tareas", () => {
    const { row, fetchMock } = prepare({ ...episode, status: "CLOSED" });
    expect(row(1).queryByRole("button", { name: "Completar" })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Errores por tarea 51A", () => {
  it.each(["API", "red"])("el reintento limpia el error de %s mientras espera y muestra un nuevo fallo", async (failure) => {
    const { fetchMock, row, showError } = prepare();
    if (failure === "red") fetchMock.mockRejectedValueOnce(new Error("Primer error 51A"));
    else fetchMock.mockResolvedValueOnce(response({ detail: "Primer error 51A" }, 422));
    const button = row(1).getByRole("button", { name: "Completar" });
    fireEvent.click(button);
    expect(await row(1).findByRole("alert")).toHaveTextContent("Primer error 51A");
    expect(row(2).queryByRole("alert")).not.toBeInTheDocument();
    let resolve!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    fireEvent.click(button);
    expect(row(1).queryByRole("alert")).not.toBeInTheDocument();
    expect(button).toBeDisabled();
    resolve(response({ detail: "Segundo error 51A" }, 422));
    expect(await row(1).findByRole("alert")).toHaveTextContent("Segundo error 51A");
    expect(button).toBeEnabled();
    expect(showError).not.toHaveBeenCalled();
  });

  it("dos fallos simultaneos conservan ambos errores y el exito de una tarea no limpia la otra", async () => {
    const { fetchMock, row, updateEpisode, view, props } = prepare();
    let resolveFirst!: (value: Response) => void;
    let resolveSecond!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolveFirst = done; }));
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolveSecond = done; }));
    fireEvent.click(row(1).getByRole("button", { name: "Completar" }));
    fireEvent.click(row(2).getByRole("button", { name: "Completar" }));
    resolveSecond(response({ detail: "Error tarea 2" }, 422));
    await row(2).findByRole("alert");
    resolveFirst(response({ detail: "Error tarea 1" }, 422));
    expect(await row(1).findByRole("alert")).toHaveTextContent("Error tarea 1");
    expect(row(2).getByRole("alert")).toHaveTextContent("Error tarea 2");
    const updated = { ...episode, tasks: [task(1, "COMPLETED"), task(2)] };
    let resolveRetry!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolveRetry = done; }));
    fireEvent.click(row(1).getByRole("button", { name: "Completar" }));
    expect(row(1).queryByRole("alert")).not.toBeInTheDocument();
    expect(row(2).getByRole("alert")).toHaveTextContent("Error tarea 2");
    resolveRetry(response(updated));
    await waitFor(() => expect(updateEpisode).toHaveBeenCalledWith(updated));
    view.rerender(<EpisodePage {...props} episode={updated} />);
    expect(row(1).getByText("Completada", { exact: false })).toBeVisible();
    expect(row(1).queryByRole("button", { name: "Completar" })).not.toBeInTheDocument();
    expect(row(2).getByRole("alert")).toHaveTextContent("Error tarea 2");
  });

  it("HTTP 401 durante un reintento no revive el error anterior", async () => {
    const { fetchMock, row, showError } = prepare();
    const button = row(1).getByRole("button", { name: "Completar" });
    establishSession("test-token");
    fetchMock.mockResolvedValueOnce(response({ detail: "Error anterior 51A" }, 422));
    fireEvent.click(button);
    await row(1).findByRole("alert");
    fetchMock.mockResolvedValueOnce(response({}, 401));
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeEnabled());
    expect(row(1).queryByRole("alert")).not.toBeInTheDocument();
    expect(showError).not.toHaveBeenCalled();
    expect(localStorage.getItem("token")).toBeNull();
  });
});


describe("Ordenes LAB desde el episodio", () => {
  const labEpisode = { ...episode, tasks: [{ ...task(7), service: "LAB" }] };
  it.each([
    ["LAB", "Registrar resultado en laboratorio"],
    ["SUPERVISOR", "Consultar laboratorio"],
  ])("%s abre la bandeja sin completar ni enviar resultado generico", (role, label) => {
    const { row, onOpenLaboratory, fetchMock, updateEpisode } = prepare(labEpisode, role);
    expect(row(7).queryByRole("button", { name: "Completar" })).not.toBeInTheDocument();
    fireEvent.click(row(7).getByRole("button", { name: label }));
    expect(onOpenLaboratory).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updateEpisode).not.toHaveBeenCalled();
  });
  it.each(["RECEPTION", "NURSE", "DOCTOR"])("%s consulta la orden sin acceso de publicacion LAB", role => {
    const { row, onOpenLaboratory, fetchMock } = prepare(labEpisode, role);
    expect(row(7).getByText("Laboratorio debe registrar el resultado desde su bandeja.")).toBeVisible();
    expect(row(7).queryByRole("button")).not.toBeInTheDocument();
    expect(onOpenLaboratory).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("un episodio cerrado no ofrece registrar ni consultar desde la tarea", () => {
    const { row, onOpenLaboratory } = prepare({ ...labEpisode, status: "CLOSED" }, "LAB");
    expect(row(7).queryByRole("button")).not.toBeInTheDocument();
    expect(onOpenLaboratory).not.toHaveBeenCalled();
  });
  it("una orden LAB completada no reaparece como pendiente", () => {
    const { onOpenLaboratory } = prepare({ ...labEpisode, tasks: [{ ...labEpisode.tasks[0], status: "COMPLETED" }] }, "LAB");
    expect(screen.getByText("Tarea ficticia 7")).toBeVisible();
    expect(screen.getByText("#7 · Completada")).toBeVisible();
    expect(onOpenLaboratory).not.toHaveBeenCalled();
  });
  it.each(["NURSING", "MEDICAL"])("conserva la finalizacion existente de %s junto a una orden LAB", async service => {
    const { row, fetchMock, updateEpisode } = prepare({ ...labEpisode, tasks: [...labEpisode.tasks, { ...task(8), service }] }, "LAB");
    fetchMock.mockResolvedValueOnce(response(episode));
    fireEvent.click(row(8).getByRole("button", { name: "Completar" }));
    await waitFor(() => expect(updateEpisode).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0][0])).toContain("/tasks/8/complete");
  });
});
