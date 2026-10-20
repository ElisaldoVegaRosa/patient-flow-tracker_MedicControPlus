import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import WristbandPrint from "./WristbandPrint";
import type { Episode, User } from "../types/clinical";

const mocks = vi.hoisted(() => ({ api: vi.fn(), revision: 0 }));
vi.mock("../api/client", () => ({ api: mocks.api, getSessionRevision: () => mocks.revision, isSessionInterruption: () => false }));
const episode: Episode = {
  id: 21, patient_id: 20, name: "Paciente Demo PDF", birth_date: "1990-01-15", document: "DEMO-PDF-021",
  identity_status: "VERIFIED", qr_token: "demo-print-existing-qr", status: "ACTIVE", priority: 3,
  location: "Triaje", started_at: "2026-10-19T00:00:00Z", vitals: [], tasks: [], alerts: [],
  events: [{ id: 121, episode_id: 21, type: "TRIAGE", note: "Triaje registrado", username: "enfermeria", created_at: "2026-10-19T00:01:00Z" }],
};
const nurse = { username: "enfermeria", role: "NURSE" } as User;
beforeEach(() => {
  mocks.api.mockReset().mockResolvedValue(episode);
  mocks.revision = 0;
  vi.spyOn(window, "print").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
const open = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Preparar pulsera / PDF" }));
  return screen.findByRole("dialog");
};

it.each(["RECEPTION", "DOCTOR", "LAB", "ADMISSION"])("no ofrece impresión al perfil %s", role => {
  render(<WristbandPrint episode={episode} user={{ ...nurse, role }} />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(mocks.api).not.toHaveBeenCalled();
});

it.each(["CLOSED", "ANNULLED"])("no prepara pulsera para episodio %s", status => {
  render(<WristbandPrint episode={{ ...episode, status }} user={nurse} />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("exige un evento de triaje persistido, no prioridad ni asignación inicial", () => {
  render(<WristbandPrint episode={{ ...episode, events: [], assigned_to: "medico" }} user={nurse} />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getByText(/requiere un episodio activo con triaje registrado/)).toBeInTheDocument();
});

it("supervisor consulta datos actuales sin escribir ni imprimir automáticamente", async () => {
  const current = { ...episode, name: "Nombre vigente desde archivo" };
  mocks.api.mockResolvedValue(current);
  render(<WristbandPrint episode={episode} user={{ ...nurse, role: "SUPERVISOR" }} />);
  const dialog = await open();
  expect(within(dialog).getByText(current.name)).toBeInTheDocument();
  expect(within(dialog).getByText("MedicControl+ · EP-21")).toBeInTheDocument();
  expect(within(dialog).getByText(/Nacimiento: 1990-01-15/)).toBeInTheDocument();
  expect(within(dialog).getByText(/Documento: DEMO-PDF-021/)).toBeInTheDocument();
  expect(within(dialog).getByTitle("QR del episodio EP-21").parentElement).toHaveAttribute("viewBox");
  expect(mocks.api).toHaveBeenCalledWith("/episodes/21", { signal: expect.any(AbortSignal) });
  expect(window.print).not.toHaveBeenCalled();
});

it("imprime solo la vista revisada, tras consultar otra vez, con el mismo QR", async () => {
  render(<WristbandPrint episode={episode} user={nurse} />);
  const dialog = await open();
  const qr = dialog.querySelector("svg")?.outerHTML;
  fireEvent.click(within(dialog).getByRole("button", { name: "Imprimir / guardar PDF" }));
  await act(async () => {});
  expect(mocks.api).toHaveBeenCalledTimes(2);
  expect(window.print).toHaveBeenCalledTimes(1);
  expect(dialog.querySelector("svg")?.outerHTML).toBe(qr);
  expect(within(dialog).getByText(/No acredita entrega/)).toBeInTheDocument();
});

it("advierte identidad provisional y no inventa documento ni nacimiento", async () => {
  mocks.api.mockResolvedValue({ ...episode, name: "Paciente desconocido 20", birth_date: null, document: null, identity_status: "PROVISIONAL" });
  render(<WristbandPrint episode={episode} user={nurse} />);
  const dialog = await open();
  expect(within(dialog).getByText("IDENTIDAD PROVISIONAL · POR VERIFICAR")).toBeInTheDocument();
  expect(within(dialog).getByText("Nacimiento: No registrado")).toBeInTheDocument();
  expect(within(dialog).getByText("Documento: No registrado")).toBeInTheDocument();
});

it("no atribuye verificación a los datos registrados", async () => {
  mocks.api.mockResolvedValue({ ...episode, identity_status: "REGISTERED" });
  render(<WristbandPrint episode={episode} user={nurse} />);
  expect(within(await open()).getByText(/sin constancia de verificación/)).toBeInTheDocument();
});

it("si la identidad cambia, actualiza y pide revisión antes de imprimir", async () => {
  render(<WristbandPrint episode={episode} user={nurse} />);
  const dialog = await open();
  mocks.api.mockResolvedValue({ ...episode, name: "Identidad recién verificada" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Imprimir / guardar PDF" }));
  expect(await within(dialog).findByRole("status")).toHaveTextContent("Los datos cambiaron");
  expect(within(dialog).getByText("Identidad recién verificada")).toBeInTheDocument();
  expect(window.print).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Imprimir / guardar PDF" }));
  await act(async () => {});
  expect(window.print).toHaveBeenCalledTimes(1);
});

it.each(["CLOSED", "ANNULLED"])("bloquea impresión si el servidor devuelve estado %s", async status => {
  render(<WristbandPrint episode={episode} user={nurse} />);
  await open();
  mocks.api.mockResolvedValue({ ...episode, status });
  fireEvent.click(screen.getByRole("button", { name: "Imprimir / guardar PDF" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("episodio activo");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(window.print).not.toHaveBeenCalled();
});

it("no conserva una vista imprimible si falla la actualización antes de imprimir", async () => {
  render(<WristbandPrint episode={episode} user={nurse} />);
  await open();
  mocks.api.mockRejectedValue(new Error("Sin conexión"));
  fireEvent.click(screen.getByRole("button", { name: "Imprimir / guardar PDF" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Sin conexión");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(window.print).not.toHaveBeenCalled();
});

it("evita solicitudes simultáneas y descarta respuesta al cambiar de sesión", async () => {
  let resolve!: (episode: Episode) => void;
  mocks.api.mockImplementation(() => new Promise<Episode>(done => { resolve = done; }));
  render(<WristbandPrint episode={episode} user={nurse} />);
  const button = screen.getByRole("button", { name: "Preparar pulsera / PDF" });
  fireEvent.click(button); fireEvent.click(button);
  expect(mocks.api).toHaveBeenCalledTimes(1);
  mocks.revision++;
  await act(async () => resolve(episode));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(window.print).not.toHaveBeenCalled();
});

it("cerrar cancela una impresión pendiente y restaura foco sin invocar print", async () => {
  render(<WristbandPrint episode={episode} user={nurse} />);
  await open();
  let resolve!: (episode: Episode) => void;
  mocks.api.mockImplementation(() => new Promise<Episode>(done => { resolve = done; }));
  fireEvent.click(screen.getByRole("button", { name: "Imprimir / guardar PDF" }));
  fireEvent.click(screen.getByRole("button", { name: "Cerrar vista previa" }));
  await act(async () => resolve(episode));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(window.print).not.toHaveBeenCalled();
});

it("Escape cierra la vista sin imprimir ni dejar contenido de pulsera en el documento", async () => {
  render(<WristbandPrint episode={episode} user={nurse} />);
  await open();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(document.querySelector(".wristband-print-root")).toBeNull();
  expect(window.print).not.toHaveBeenCalled();
});
