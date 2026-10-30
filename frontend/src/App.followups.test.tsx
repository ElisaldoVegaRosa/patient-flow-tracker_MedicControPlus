import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import { establishSession } from "./api/client";
import { doctor, receiver, followup } from "./testFixtures/laboratoryFollowup";

const response = (value: unknown) => ({ ok: true, status: 200, json: async () => value }) as Response;
afterEach(() => vi.unstubAllGlobals());
function setup({ enabled = true, role = "DOCTOR", uncertain = false } = {}) {
  establishSession("token-ficticio");
  let value = structuredClone(followup), posts = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/me") return response({ ...doctor, role });
    if (url.pathname === "/dashboard") return response({ active: 0, open_alerts: 0, patients: [], requested_by: doctor.username, laboratory_enabled: enabled });
    if (url.pathname === "/lab/followup-doctors") return response({ doctors: [doctor, receiver] });
    if (url.pathname === "/lab/followups") return response({ total: 1, items: [structuredClone(value)], limit: 20, offset: 0 });
    if (url.pathname === "/lab/followups/1/plan" && init?.method === "POST") {
      posts++;
      if (uncertain && posts === 1) throw new Error("Fallo ficticio de conexión");
      const body = JSON.parse(String(init.body));
      value = { ...value, version: '"f2"', communication_plan: body.communication_plan, reason: body.reason };
      return response({ id: 22, status: "CLOSED", lab_followups: [structuredClone(value)] });
    }
    throw new Error(`Ruta inesperada ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetchMock); render(<App />); return fetchMock;
}
async function open() {
  await screen.findByText("Médico Demo (medico.demo)");
  await screen.findByRole("heading", { name: "Centro de control" });
  fireEvent.click(await screen.findByRole("button", { name: "Seguimiento tras alta" }));
  fireEvent.click(await screen.findByText("Paciente ficticio · EP-22 · Seguimiento tras alta"));
  const summary = screen.getByText("Actualizar plan de seguimiento", { selector: "summary" }); fireEvent.click(summary);
  const f = within(summary.closest("details")!);
  fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Plan ficticio original" } });
  return f;
}
it("abre la bandeja habilitada y confirma el plan sin abandonar la página", async () => {
  const fetchMock = setup(); const f = await open();
  fireEvent.change(f.getByLabelText("Cómo se informará al paciente"), { target: { value: "Contacto ficticio nuevo" } });
  fireEvent.click(f.getByRole("button", { name: "Actualizar plan de seguimiento" }));
  await screen.findByText(/Cambio de seguimiento confirmado/);
  await screen.findByText("Comunicación al paciente: Contacto ficticio nuevo");
  expect(screen.getByRole("heading", { name: "Seguimiento de laboratorio tras el alta" })).toBeVisible();
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
});
it("la confirmación de un reintento conserva el motivo posterior y reutiliza clave/cuerpo", async () => {
  const fetchMock = setup({ uncertain: true }); const f = await open();
  fireEvent.click(f.getByRole("button", { name: "Actualizar plan de seguimiento" }));
  await screen.findByRole("heading", { name: "Seguimiento #1 · Plan" });
  fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Motivo posterior conservado" } });
  fireEvent.click(screen.getByRole("button", { name: "Reintentar operación original" }));
  await screen.findByText("Seguimiento confirmado por el servidor.");
  const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
  expect(posts).toHaveLength(2); expect(posts[0][1]?.body).toBe(posts[1][1]?.body);
  expect(new Headers(posts[0][1]?.headers).get("Idempotency-Key")).toBe(new Headers(posts[1][1]?.headers).get("Idempotency-Key"));
  expect(f.getByLabelText("Motivo")).toHaveValue("Motivo posterior conservado");
  await waitFor(() => expect(f.getByRole("button", { name: "Actualizar plan de seguimiento" })).toBeDisabled());
});
it.each([{ enabled: false, role: "DOCTOR" }, { enabled: true, role: "RECEPTION" }])("no ofrece la nueva bandeja sin capacidad o rol: %o", async options => {
  setup(options); await screen.findByRole("heading", { name: "Centro de control" });
  expect(screen.queryByRole("button", { name: "Seguimiento tras alta" })).not.toBeInTheDocument();
});
