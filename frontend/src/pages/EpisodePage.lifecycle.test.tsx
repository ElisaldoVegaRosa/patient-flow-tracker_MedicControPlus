import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import EpisodePage from "./EpisodePage";
import { establishSession } from "../api/client";
import type { Episode } from "../types/clinical";

const base: Episode = { id: 55, name: "Paciente ficticio", birth_date: "1990-01-01", document: "TEST-55",
  qr_token: "qr-55", status: "ACTIVE", priority: 3, location: "Recepción", started_at: "2026-10-17T12:00:00Z",
  clinical_version: '"clinical-55"', vitals: [], alerts: [], tasks: [], events: [] };
const response = (data: unknown) => ({ ok: true, status: 200, json: async () => data }) as Response;
afterEach(() => vi.unstubAllGlobals());

it("muestra tareas completadas y rectifica una nota sin ocultar el original", async () => {
  establishSession("token-local");
  const oldNote = "Evaluación original ficticia";
  const episode: Episode = { ...base,
    tasks: [{ id: 1, episode_id: 55, title: "Orden completada ficticia", service: "LAB", status: "COMPLETED", result: "Resultado ficticio" }],
    events: [{ id: 7, episode_id: 55, type: "MEDICAL_EVALUATION", note: oldNote, current_note: oldNote,
      username: "medico", created_at: "2026-10-17T12:00:00Z", version: '"note-7"' }] };
  const updated: Episode = { ...episode, events: [{ ...episode.events[0], current_note: "Evaluación corregida ficticia" }] };
  const fetchMock = vi.fn().mockResolvedValue(response(updated));
  vi.stubGlobal("fetch", fetchMock);
  const updateEpisode = vi.fn();
  const view = render(<EpisodePage episode={episode} user={{ username: "medico", role: "DOCTOR", access_token: "token-local" }} updateEpisode={updateEpisode} showError={vi.fn()} />);
  expect(screen.getByText("Orden completada ficticia")).toBeVisible();
  expect(screen.getByText("Resultado: Resultado ficticio")).toBeVisible();
  const note = within(screen.getByText(oldNote).closest("article")!);
  fireEvent.change(note.getByRole("textbox", { name: "Texto corregido de la evaluación" }), { target: { value: "Evaluación corregida ficticia" } });
  fireEvent.change(note.getByRole("textbox", { name: "Motivo de la acción" }), { target: { value: "Rectificación ficticia" } });
  fireEvent.click(note.getByRole("button", { name: "Registrar corrección" }));
  await waitFor(() => expect(updateEpisode).toHaveBeenCalledWith(updated));
  const patch = fetchMock.mock.calls[0];
  expect(String(patch[0])).toContain("/events/7/note");
  expect(new Headers(patch[1].headers).get("If-Match")).toBe('"note-7"');
  view.rerender(<EpisodePage episode={updated} user={{ username: "medico", role: "DOCTOR", access_token: "token-local" }} updateEpisode={updateEpisode} showError={vi.fn()} />);
  expect(screen.getByText("Evaluación corregida ficticia")).toBeVisible();
  fireEvent.click(screen.getByText("Ver texto original"));
  expect(screen.getByText(oldNote)).toBeVisible();
});

it("reabre alta con motivo y anula ingreso sin actividad con permisos separados", async () => {
  establishSession("token-local");
  const closed = { ...base, status: "CLOSED" };
  const reopened = { ...base, record_changes: [] };
  const fetchMock = vi.fn().mockResolvedValueOnce(response(reopened)).mockResolvedValueOnce(response({ ...base, status: "ANNULLED" }));
  vi.stubGlobal("fetch", fetchMock);
  const updateEpisode = vi.fn();
  const view = render(<EpisodePage episode={closed} user={{ username: "medico", role: "DOCTOR", access_token: "token-local" }} updateEpisode={updateEpisode} showError={vi.fn()} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Motivo" }), { target: { value: "Alta por error" } });
  fireEvent.click(screen.getByRole("button", { name: "Reabrir este episodio" }));
  await waitFor(() => expect(updateEpisode).toHaveBeenCalledWith(reopened));
  expect(String(fetchMock.mock.calls[0][0])).toContain("/episodes/55/reopen");
  view.rerender(<EpisodePage episode={base} user={{ username: "recepcion", role: "RECEPTION", access_token: "token-local" }} updateEpisode={updateEpisode} showError={vi.fn()} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Motivo" }), { target: { value: "Ingreso duplicado" } });
  fireEvent.click(screen.getByRole("button", { name: "Anular ingreso" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(String(fetchMock.mock.calls[1][0])).toContain("/episodes/55/annul");
});
