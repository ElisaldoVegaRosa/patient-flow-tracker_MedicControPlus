import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import { invalidateSession } from "./api/client";
import type { Episode } from "./types/clinical";

const initial: Episode = { id: 42, name: "Paciente ficticio 56", birth_date: "1990-01-01", document: "TEST56", qr_token: "qr56", status: "ACTIVE", priority: 3, location: "Observación", started_at: "2026-10-12", vitals: [], tasks: [], alerts: [], events: [], triage_version: '"old"', clinical_version: '"clinical-old"' };
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response;
afterEach(() => { invalidateSession(); vi.unstubAllGlobals(); });

it.each(["consultar", "reintentar", "consultar sin editar", "consultar cambios posteriores"])("%s confirma el triaje original y conserva campos modificados después", async mode => {
  localStorage.setItem("token", "ficticio");
  const identity = { username: "enfermeria", role: "NURSE" };
  let saved = initial;
  let lost = true;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path === "/auth/me") return response(identity);
    if (path === "/dashboard") return response({ active: 1, open_alerts: 0, patients: [initial], requested_by: identity.username });
    if (path === "/scan/qr56") return response(initial);
    if (path === "/write-result") return response({ status: "confirmed", result: mode === "consultar cambios posteriores" ? { ...saved, assigned_to: "Responsable remoto", triage_version: '"remote"' } : saved });
    if (path === "/episodes/42/triage") {
      if (!lost && mode === "consultar cambios posteriores") return response({ detail: { code: "version_conflict", message: "Otro cambio requiere revisión" } }, 409);
      saved = { ...initial, ...JSON.parse(String(init?.body)), triage_version: '"saved"' };
      if (lost) { lost = false; throw new Error("Respuesta perdida"); }
      return response(saved);
    }
    throw new Error(`Petición inesperada: ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole("button", { name: "Escanear pulsera" }));
  fireEvent.change(screen.getByPlaceholderText("Token de la pulsera"), { target: { value: "qr56" } });
  await user.click(screen.getByRole("button", { name: "Identificar paciente" }));
  fireEvent.change(await screen.findByLabelText("Personal responsable"), { target: { value: "Responsable original" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar triaje y asignación" }));
  await screen.findByRole("region", { name: "Guardados por confirmar" });
  expect(screen.getByLabelText("Personal responsable")).toHaveValue("Responsable original");
  fireEvent.change(screen.getByLabelText("Temperatura"), { target: { value: "38" } });
  if (mode !== "consultar sin editar") {
  fireEvent.change(screen.getByLabelText("Personal responsable"), { target: { value: "Edición posterior" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar triaje y asignación" }));
  await screen.findByText(/envío anterior por confirmar/);
  }
  await user.click(screen.getByRole("button", { name: mode === "reintentar" ? "Reintentar operación original" : "Consultar resultado" }));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Guardados por confirmar" })).not.toBeInTheDocument());
  expect(screen.getByLabelText("Personal responsable")).toHaveValue(mode === "consultar sin editar" ? "Responsable original" : "Edición posterior");
  expect(screen.getByLabelText("Temperatura")).toHaveValue(38);
  const writes = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/triage"));
  expect(writes).toHaveLength(mode === "reintentar" ? 2 : 1);
  if (mode === "reintentar") {
    const { signal: originalSignal, ...originalRequest } = writes[0][1]!;
    const { signal: retrySignal, ...retryRequest } = writes[1][1]!;
    expect(retryRequest).toEqual(originalRequest);
    expect(retrySignal).not.toBe(originalSignal);
  }
  if (mode === "consultar sin editar") return;
  fireEvent.click(screen.getByRole("button", { name: "Guardar triaje y asignación" }));
  await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/triage"))).toHaveLength(writes.length + 1));
  const final = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/triage")).at(-1)![1];
  expect(new Headers(final?.headers).get("If-Match")).toBe(mode === "consultar cambios posteriores" ? '"old"' : '"saved"');
  expect(JSON.parse(String(final?.body)).assigned_to).toBe("Edición posterior");
  if (mode === "consultar cambios posteriores") expect(await screen.findByRole("region", { name: "Cambios de otra sesión" })).toBeInTheDocument();
});
