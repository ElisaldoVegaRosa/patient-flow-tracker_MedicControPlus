import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import { establishSession } from "./api/client";
import type { Episode } from "./types/clinical";

const provisional: Episode = { id: 81, patient_id: 61, name: "Paciente desconocido 61", birth_date: null,
  document: null, identity_status: "PROVISIONAL", identity_version: '"identity-original"',
  qr_token: "qr-provisional", status: "ACTIVE", priority: 3, location: "Recepción",
  started_at: "2026-10-19T00:00:00Z", events: [], tasks: [], vitals: [], alerts: [] };

function setup(role = "RECEPTION") {
  establishSession("ficticio-provisional");
  const fetchMock = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/presence")) return { ok: true, status: 200, json: async () => ({ active: true, ttl_seconds: 45, members: [] }) } as Response;
    const responses: Record<string, unknown> = {
      "/auth/me": { username: role === "ADMISSION" ? "archivo" : "recepcion", role },
      "/dashboard": { active: 0, open_alerts: 0, patients: [], requested_by: "demo" },
      "/identity/pending": { patients: [{ ...provisional, patient_id: 61, episode_id: 81 }], total: 1 },
      "/episodes/81": provisional,
    };
    if (path === "/episodes" && options?.method === "POST") return { ok: true, status: 201, json: async () => provisional } as Response;
    if (!(path in responses)) throw new Error(`Petición inesperada: ${path}`);
    return { ok: true, status: 200, json: async () => responses[path] } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
afterEach(() => vi.unstubAllGlobals());

it("registra identidad desconocida con null explícito, sin fechas ni documentos inventados", async () => {
  const fetchMock = setup();
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole("button", { name: "Nuevo ingreso" }));
  await user.selectOptions(screen.getByLabelText("Tipo de identificación"), "true");
  expect(screen.getByLabelText("Fecha de nacimiento")).not.toBeRequired();
  expect(screen.getByLabelText("Documento")).not.toBeRequired();
  await user.click(screen.getByRole("button", { name: "Crear episodio y pulsera" }));
  await screen.findByRole("heading", { name: provisional.name });
  const call = fetchMock.mock.calls.find(([url, options]) => new URL(String(url)).pathname === "/episodes" && options?.method === "POST")!;
  expect(JSON.parse(String(call[1]?.body))).toEqual({ name: null, birth_date: null, document: null, provisional: true, priority: 3, location: "Recepción" });
  expect(screen.getAllByText(/Identidad provisional/).length).toBeGreaterThan(0);
  expect(screen.getAllByText("No registrado")).toHaveLength(2);
});

it("recupera el modo provisional tras recarga y vuelve a exigir campos en modo conocido", async () => {
  setup();
  const user = userEvent.setup();
  const first = render(<App />);
  await user.click(await screen.findByRole("button", { name: "Nuevo ingreso" }));
  await user.selectOptions(screen.getByLabelText("Tipo de identificación"), "true");
  fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: "Nombre comunicado" } });
  first.unmount();
  render(<App />);
  await user.click(await screen.findByRole("button", { name: "Restaurar formularios" }));
  expect(await screen.findByLabelText("Nombre completo")).toHaveValue("Nombre comunicado");
  expect(screen.getByLabelText("Tipo de identificación")).toHaveValue("true");
  expect(screen.getByLabelText("Documento")).not.toBeRequired();
  await user.selectOptions(screen.getByLabelText("Tipo de identificación"), "false");
  expect(screen.getByLabelText("Documento")).toBeRequired();
});

it("archivo accede a su bandeja y formulario sin controles de intervención clínica", async () => {
  setup("ADMISSION");
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole("button", { name: "Identidades por verificar" }));
  await user.click(await screen.findByRole("button", { name: "Revisar identidad · EP-81" }));
  expect(await screen.findByRole("button", { name: "Confirmar identidad verificada" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Nuevo ingreso" })).not.toBeInTheDocument();
  expect(screen.queryByText("Registrar nuevos signos")).not.toBeInTheDocument();
  expect(screen.queryByText("Triaje y asignación")).not.toBeInTheDocument();
});

it("archivo conserva fuente y versión al recargar y advierte al salir con cambios", async () => {
  setup("ADMISSION");
  const user = userEvent.setup();
  const first = render(<App />);
  await user.click(await screen.findByRole("button", { name: "Identidades por verificar" }));
  await user.click(await screen.findByRole("button", { name: "Revisar identidad · EP-81" }));
  const name = await screen.findByLabelText("Nombre verificado");
  fireEvent.change(name, { target: { value: "Nombre comunicado" } });
  fireEvent.change(screen.getByLabelText("Fuente de verificación"), { target: { value: "Documento ficticio cotejado" } });
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  await user.click(screen.getByRole("button", { name: "Centro de control" }));
  expect(confirm).toHaveBeenCalled();
  expect(name).toBeVisible();
  first.unmount();
  render(<App />);
  await user.click(await screen.findByRole("button", { name: "Restaurar formularios" }));
  expect(await screen.findByLabelText("Nombre verificado")).toHaveValue("Nombre comunicado");
  expect(screen.getByLabelText("Fuente de verificación")).toHaveValue("Documento ficticio cotejado");
  expect(screen.getByLabelText("Nombre verificado").closest("form")).toHaveAttribute("data-draft-version", provisional.identity_version);
  confirm.mockRestore();
});
