import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import { establishSession, invalidateSession } from "./api/client";
import type { Account, AccountsData } from "./types/clinical";

const password = "Ficticia-Personal-2026";
const admin = { username: "admin.demo", display_name: "Admin ficticio", role: "ACCOUNT_ADMIN" };
const account: Account = { id: 8, username: "medico.uno", display_name: "Medico ficticio", role: "DOCTOR", active: 1,
  account_revision: 0, version: '"account-original"', created_at: "2026-10-19T00:00:00Z" };
const response = (status: number, value: unknown) => ({ ok: status < 400, status, json: async () => value }) as Response;

function setup(restored = true) {
  if (restored) establishSession("session-admin-ficticia");
  let data: AccountsData = { accounts: [{ ...account, id: 7, ...admin }, account], changes: [], requested_by: admin.username };
  const mutations = vi.fn(async (_path: string, options: RequestInit) => {
    const body = JSON.parse(String(options.body));
    return response(200, { ...account, active: body.active ?? 1, account_revision: 1, version: '"account-new"' });
  });
  const fetchMock = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path === "/auth/me") return response(200, admin);
    if (path === "/auth/login") return response(200, { ...admin, access_token: "new-admin-ficticio" });
    if (path === "/auth/logout") return response(200, { message: "Cerrada" });
    if (path === "/accounts" && (!options?.method || options.method === "GET")) return response(200, data);
    if (path.startsWith("/accounts")) return mutations(path, options!);
    if (path === "/write-result") return response(200, { status: "unknown" });
    throw new Error(`Peticion inesperada: ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, mutations, update: (value: AccountsData) => { data = value; } };
}
afterEach(() => { invalidateSession(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function ready() {
  render(<App />);
  return screen.findByRole("article", { name: "Cuenta medico.uno" });
}
async function fillCreation() {
  const user = userEvent.setup();
  const form = screen.getByRole("group", { name: "Crear cuenta" });
  await user.type(within(form).getByLabelText("Usuario único"), "enfermera.demo");
  await user.type(within(form).getByLabelText("Nombre visible"), "Enfermera ficticia");
  await user.selectOptions(within(form).getByLabelText("Perfil"), "NURSE");
  await user.type(within(form).getByLabelText("Contraseña nueva"), password);
  await user.type(within(form).getByLabelText("Motivo"), "Alta ficticia de prueba");
  return { user, form };
}

it("restaura administrador separado sin cargar dashboard, episodios ni navegacion clinica", async () => {
  const { fetchMock } = setup();
  await ready();
  expect(screen.getByRole("heading", { name: "Administración de cuentas" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Centro de control" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Escanear pulsera" })).not.toBeInTheDocument();
  expect(fetchMock.mock.calls.some(([url]) => /dashboard|episodes|presence/.test(String(url)))).toBe(false);
});

it("concede coordinacion con version y booleano sin conceder acceso clinico al administrador", async () => {
  const { mutations } = setup();
  const article = await ready();
  const group = within(article).getByRole("group", { name: "Conceder permiso de coordinación" });
  fireEvent.change(within(group).getByLabelText("Motivo"), { target: { value: "Coordinar turno ficticio" } });
  fireEvent.click(within(group).getByRole("button", { name: "Conceder permiso de coordinación" }));
  await waitFor(() => expect(mutations).toHaveBeenCalledTimes(1));
  expect(mutations.mock.calls[0][0]).toBe("/accounts/8/coordination");
  expect(mutations.mock.calls[0][1].method).toBe("PATCH");
  expect(JSON.parse(String(mutations.mock.calls[0][1].body))).toEqual({ can_coordinate: true, reason: "Coordinar turno ficticio" });
  expect(new Headers(mutations.mock.calls[0][1].headers).get("If-Match")).toBe(account.version);
  expect(screen.queryByRole("button", { name: "Personal y turnos" })).not.toBeInTheDocument();
});

it("permite acceso personal sin clave demo prellenada y mantiene el acceso demo", async () => {
  const { fetchMock } = setup(false);
  const user = userEvent.setup();
  render(<App />);
  expect(screen.getByLabelText("Contraseña")).toHaveValue("demo123");
  await user.selectOptions(screen.getByRole("combobox", { name: "Tipo de acceso" }), "personal");
  expect(screen.getByLabelText("Contraseña")).toHaveValue("");
  await user.type(screen.getByRole("textbox", { name: "Usuario" }), admin.username);
  await user.type(screen.getByLabelText("Contraseña"), password);
  await user.click(screen.getByRole("button", { name: "Entrar" }));
  await screen.findByRole("heading", { name: "Administración de cuentas" });
  expect(JSON.parse(String(fetchMock.mock.calls.find(([url]) => String(url).endsWith("/auth/login"))?.[1]?.body))).toEqual({ username: admin.username, password });
});

it("crea cuenta con clave idempotente, evita doble envio y limpia contrasena solo al confirmar", async () => {
  const { mutations } = setup();
  await ready();
  const { user, form } = await fillCreation();
  let resolve!: (value: Response) => void;
  mutations.mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; }));
  const button = within(form).getByRole("button", { name: "Crear cuenta" });
  fireEvent.click(button); fireEvent.click(button);
  expect(mutations).toHaveBeenCalledTimes(1);
  const options = mutations.mock.calls[0][1];
  expect(new Headers(options.headers).get("Idempotency-Key")).toBeTruthy();
  expect(JSON.parse(String(options.body))).toMatchObject({ username: "enfermera.demo", password, role: "NURSE" });
  expect(JSON.stringify(localStorage)).not.toContain(password);
  expect(JSON.stringify(sessionStorage)).not.toContain(password);
  await act(async () => resolve(response(201, { ...account, username: "enfermera.demo" })));
  expect(within(form).getByLabelText("Contraseña nueva")).toHaveValue("");
  expect(within(form).getByLabelText("Usuario único")).toHaveValue("");
  expect(screen.getByRole("status")).toHaveTextContent("confirmada");
  await user.click(within(form).getByLabelText("Usuario único"));
});

it("desactiva con version congelada y motivo, sin permitir autodesactivacion", async () => {
  const { mutations } = setup();
  const article = await ready();
  const group = within(article).getByRole("group", { name: "Desactivar cuenta" });
  fireEvent.change(within(group).getByLabelText("Motivo"), { target: { value: "Baja ficticia" } });
  fireEvent.click(within(group).getByRole("button", { name: "Desactivar cuenta" }));
  await waitFor(() => expect(mutations).toHaveBeenCalledTimes(1));
  expect(new Headers(mutations.mock.calls[0][1].headers).get("If-Match")).toBe(account.version);
  expect(JSON.parse(String(mutations.mock.calls[0][1].body))).toEqual({ active: false, reason: "Baja ficticia" });
  expect(within(screen.getByRole("article", { name: "Cuenta admin.demo" })).queryByRole("button", { name: "Desactivar cuenta" })).not.toBeInTheDocument();
});

it("conserva campos y exige revisar una version nueva tras conflicto", async () => {
  const { mutations, update } = setup();
  const article = await ready();
  const group = within(article).getByRole("group", { name: "Restablecer contraseña" });
  fireEvent.change(within(group).getByLabelText("Contraseña nueva"), { target: { value: password } });
  fireEvent.change(within(group).getByLabelText("Motivo"), { target: { value: "Motivo local conservado" } });
  update({ accounts: [{ ...account, version: '"changed"', account_revision: 1 }], changes: [], requested_by: admin.username });
  mutations.mockResolvedValueOnce(response(409, { detail: { code: "version_conflict", message: "Otra sesion modifico cuenta" } }));
  fireEvent.click(within(group).getByRole("button", { name: "Restablecer contraseña" }));
  await within(group).findByText(/Esta cuenta cambió/);
  expect(within(group).getByLabelText("Motivo")).toHaveValue("Motivo local conservado");
  expect(within(group).getByLabelText("Contraseña nueva")).toHaveValue(password);
  expect(within(group).getByRole("button", { name: "Restablecer contraseña" })).toBeDisabled();
  fireEvent.click(within(group).getByRole("button", { name: "He revisado esta cuenta; usar versión actual" }));
  fireEvent.click(within(group).getByRole("button", { name: "Restablecer contraseña" }));
  await waitFor(() => expect(mutations).toHaveBeenCalledTimes(2));
  expect(new Headers(mutations.mock.calls[1][1].headers).get("If-Match")).toBe('"changed"');
});

it("envio incierto conserva identificador y consulta resultado sin reenviar", async () => {
  const { mutations, fetchMock } = setup();
  await ready();
  const { user, form } = await fillCreation();
  mutations.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  await user.click(within(form).getByRole("button", { name: "Crear cuenta" }));
  const pending = await screen.findByRole("region", { name: "Guardados por confirmar" });
  expect(pending).toHaveTextContent("Crear cuenta");
  await user.click(within(pending).getByRole("button", { name: "Consultar resultado" }));
  expect(mutations).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/write-result"))).toBe(true);
  expect(JSON.stringify(localStorage)).not.toContain(password);
  expect(JSON.stringify(sessionStorage)).not.toContain(password);
});

it("avisa al salir con campos, los conserva al cancelar y los descarta al cerrar sesion", async () => {
  setup();
  await ready();
  const { user } = await fillCreation();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  await user.click(screen.getByRole("button", { name: "Salir" }));
  expect(confirm).toHaveBeenCalled();
  expect(screen.getByLabelText("Usuario único")).toHaveValue("enfermera.demo");
  confirm.mockReturnValue(true);
  await user.click(screen.getByRole("button", { name: "Salir" }));
  await screen.findByRole("heading", { name: "Seguimiento clínico" });
  expect(screen.queryByLabelText("Contraseña nueva")).not.toBeInTheDocument();
  expect(JSON.stringify(sessionStorage)).not.toContain(password);
});
