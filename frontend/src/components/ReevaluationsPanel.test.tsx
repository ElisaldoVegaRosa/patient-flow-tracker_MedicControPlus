import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ReevaluationsPanel from "./ReevaluationsPanel";
import ReevaluationSchedule from "./ReevaluationSchedule";
import ReevaluationDue from "./ReevaluationDue";
import EpisodePage from "../pages/EpisodePage";
import { usePendingOperations } from "../hooks/usePendingOperations";
import { establishSession, invalidateSession } from "../api/client";
import type { Episode, Reevaluation } from "../types/clinical";
import { operationalFormDirty } from "../session/operationalWrites";

const user = { username: "medico.demo", role: "DOCTOR", access_token: "reevaluation-test" };
const item: Reevaluation = { id: 1, episode_id: 50, group_id: 1, group_title: "Seguimiento ficticio", title: "Accion ficticia de medicina",
  service: "MEDICAL", status: "PENDING", due_at: "2026-10-26T21:30:00Z", result: null, revision: 0,
  owner_username: user.username, owner_name: "Medico Demo", owner_id: 8, version: '"action-0"', created_by: user.username };
const episode: Episode = { id: 50, name: "Paciente ficticio", qr_token: "qr-demo-test", birth_date: null, document: null,
  status: "ACTIVE", priority: 3, location: "Consulta", started_at: "2026-10-26T20:00:00Z", vitals: [], tasks: [], events: [], alerts: [], clinical_version: '"clinical-0"', reevaluations: [item] };
const response = (value: unknown, status = 200) => ({ ok: status < 400, status, json: async () => value }) as Response;
afterEach(() => { invalidateSession(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

function setup(data = episode, account = user) {
  establishSession("reevaluation-test");
  const fetchMock = vi.fn().mockResolvedValue(response(data)); vi.stubGlobal("fetch", fetchMock);
  const update = vi.fn();
  function Harness({ value, who }: { value: Episode; who: typeof user }) {
    return <ReevaluationsPanel episode={value} user={who} operations={usePendingOperations()} updateEpisode={update} />;
  }
  const view = render(<Harness value={data} who={account} />);
  view.container.querySelectorAll("details").forEach(node => { node.open = true; });
  return { fetchMock, update, view, rerender: (value: Episode) => view.rerender(<Harness value={value} who={account} />) };
}

it("previews and submits a fixed future instant for relative minutes, then clears the form", async () => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-26T21:00:00Z"));
  const { fetchMock, update } = setup();
  const form = screen.getByRole("group", { name: "Confirmar programación de reevaluación" });
  fireEvent.change(within(form).getByLabelText("Nombre del seguimiento"), { target: { value: "Control ficticio" } });
  fireEvent.change(within(form).getByLabelText("Acción de medicina"), { target: { value: "Revisar evolucion ficticia" } });
  fireEvent.change(within(form).getByLabelText("Acción de enfermería"), { target: { value: "Comprobacion ficticia" } });
  fireEvent.change(within(form).getByLabelText("Cuándo reevaluar"), { target: { value: "AFTER" } });
  fireEvent.change(within(form).getByLabelText("Dentro de cuántos minutos"), { target: { value: "30" } });
  expect(within(form).getByRole("status")).toHaveTextContent(/0?5:30.*p/);
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-26T21:10:00Z"));
  fireEvent.change(within(form).getByLabelText("Motivo de la reevaluación"), { target: { value: "Indicación ficticia" } });
  fireEvent.click(within(form).getByRole("button", { name: "Confirmar programación de reevaluación" }));
  await waitFor(() => expect(update).toHaveBeenCalledWith(episode));
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ title: "Control ficticio", medical_instruction: "Revisar evolucion ficticia",
    nursing_instruction: "Comprobacion ficticia", due_at: "2026-10-26T21:30:00.000Z", reason: "Indicación ficticia" });
  expect(new Headers(fetchMock.mock.calls[0][1].headers).get("If-Match")).toBe('"clinical-0"');
  expect(within(form).getByLabelText("Nombre del seguimiento")).toHaveValue("");
  expect(within(form).getByLabelText("Cuándo reevaluar")).toHaveValue("AT");
});

it("converts an exact 12-hour time and supports native reset without a fabricated interval", () => {
  const { container } = render(<form><ReevaluationSchedule /></form>);
  const form = container.querySelector("form")!;
  expect(form.checkValidity()).toBe(false);
  for (const [label, value] of [["Fecha", "2026-10-27"], ["Hora (1–12)", "12"], ["Minutos", "00"], ["AM/PM", "AM"]])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  expect(new FormData(form).get("due_at")).toBe("2026-10-27T00:00:00-04:00");
  expect(operationalFormDirty(form)).toBe(true);
  act(() => form.reset());
  expect(operationalFormDirty(form)).toBe(false);
  expect(screen.getByText(/Completa la fecha y hora/)).toBeInTheDocument();
});

it("keeps current fields when a conflict changes the owner and blocks the former owner's confirmation", async () => {
  const { fetchMock, rerender } = setup();
  const form = screen.getByRole("group", { name: "Confirmar reevaluación realizada" });
  fireEvent.change(within(form).getByLabelText("Lo realizado"), { target: { value: "Accion que estaba editando" } });
  fireEvent.change(within(form).getByLabelText("Motivo de la reevaluación"), { target: { value: "Motivo local" } });
  fetchMock.mockResolvedValueOnce(response({ detail: { code: "version_conflict", message: "Responsable cambiado" } }, 409));
  fireEvent.click(within(form).getByRole("button", { name: "Confirmar reevaluación realizada" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  rerender({ ...episode, reevaluations: [{ ...item, owner_username: "otro.medico", version: '"action-1"' }] });
  expect(within(form).getByLabelText("Lo realizado")).toHaveValue("Accion que estaba editando");
  expect(within(form).getByRole("button", { name: "Confirmar reevaluación realizada" })).toBeDisabled();
});

it("shows overdue status at the doctor's deadline without completing the action", () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-26T21:29:59Z"));
  render(<ReevaluationDue dueAt={item.due_at} pending />);
  expect(screen.getByRole("status")).toHaveTextContent("faltan 1 min");
  act(() => vi.advanceTimersByTime(15_000));
  expect(screen.getByRole("status")).toHaveTextContent("Vencida");
});

it("blocks discharge and removes the generic task completion bypass for scheduled actions", () => {
  render(<EpisodePage episode={{ ...episode, tasks: [{ id: 1, episode_id: 50, title: item.title, service: "MEDICAL", status: "PENDING", result: null, reevaluation_group_id: 1 }] }}
    user={user} updateEpisode={vi.fn()} showError={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Cerrar episodio · Alta médica" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Completar" })).not.toBeInTheDocument();
  expect(screen.getByText(/Completa o cancela con motivo/)).toBeInTheDocument();
});
