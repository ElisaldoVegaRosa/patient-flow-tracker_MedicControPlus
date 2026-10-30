import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import LaboratoryFollowupsPage from "./LaboratoryFollowupsPage";
import { doctor, receiver, followup } from "../testFixtures/laboratoryFollowup";
import { usePendingOperations } from "../hooks/usePendingOperations";
import { establishSession } from "../api/client";
import { readSpecimenDraft } from "../session/specimenDrafts";

const response = (value: unknown) => ({ ok: true, status: 200, json: async () => value }) as Response;
const opened = vi.fn();
function Harness({ role = "DOCTOR" }: { role?: string }) {
  const operations = usePendingOperations();
  return <LaboratoryFollowupsPage user={{ ...doctor, role }} operations={operations} onOpenEpisode={opened} />;
}
function setup() {
  establishSession("token-ficticio");
  const model = { item: structuredClone(followup), absent: false, total: 1 };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === "/lab/followup-doctors") return response({ doctors: [doctor, receiver] });
    if (url.pathname === "/lab/followups") return response({ total: model.absent ? 0 : model.total, items: model.absent ? [] : [structuredClone(model.item)], limit: 20, offset: Number(url.searchParams.get("offset")) });
    if (url.pathname === "/lab/followups/1") return response(structuredClone(model.item));
    if (url.pathname === "/lab/followups/1/propose" && init?.method === "POST") { model.item = { ...model.item, version: '"f2"', pending_user_id: 4, proposed: receiver }; return response({ id: 22 }); }
    throw new Error(`Ruta inesperada ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetchMock); return { model, fetchMock };
}
async function proposal() {
  fireEvent.click(await screen.findByText("Paciente ficticio · EP-22 · Seguimiento tras alta"));
  const summary = screen.getByText("Proponer relevo del seguimiento", { selector: "summary" }); fireEvent.click(summary);
  const f = within(summary.closest("details")!);
  await f.findByRole("option", { name: "Médico Relevo (medico.relevo)" });
  fireEvent.change(f.getByLabelText("Motivo"), { target: { value: "Relevo ficticio de seguimiento" } });
  fireEvent.change(f.getByLabelText("Médico receptor"), { target: { value: "4" } });
  return f;
}
afterEach(() => vi.unstubAllGlobals());

it("propone relevo, confirma y actualiza versión sin cambiar al responsable", async () => {
  const { fetchMock } = setup(); render(<Harness />); const f = await proposal();
  fireEvent.click(f.getByRole("button", { name: "Proponer relevo del seguimiento" }));
  await screen.findByText(/Cambio de seguimiento confirmado/);
  await screen.findByText(/Relevo propuesto a: Médico Relevo/);
  expect(screen.getByText("Responsable: Médico Demo (medico.demo).")).toBeVisible();
  expect(f.getByLabelText("Motivo")).toHaveValue("");
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
});
it("un caso fuera del filtro conserva el borrador y bloquea el ciclo anterior", async () => {
  const { model } = setup(); render(<Harness />); const f = await proposal();
  model.absent = true; model.item = { ...model.item, current_cycle: false, episode_status: "ACTIVE", version: '"old-cycle"' };
  fireEvent.click(screen.getByRole("button", { name: "Actualizar seguimientos" }));
  await screen.findByText("Seguimiento fuera del filtro actual; campos conservados para revisión.");
  expect(f.getByLabelText("Motivo")).toHaveValue("Relevo ficticio de seguimiento");
  expect(f.getByRole("button", { name: "Proponer relevo del seguimiento" })).toBeDisabled();
});
it("filtros y paginación consultan al servidor sin reenviar los formularios", async () => {
  const { model, fetchMock } = setup(); model.total = 21; render(<Harness />);
  await screen.findByText("Seguimientos que coinciden: 21.");
  fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("offset=20"))).toBe(true));
  fireEvent.click(screen.getByLabelText("Mis responsabilidades y propuestas"));
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("mine=true") && String(url).includes("offset=0"))).toBe(true));
  fireEvent.click(screen.getByLabelText("Incluir seguimientos sin pendientes clínicos"));
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("include_resolved=true"))).toBe(true));
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
});
it("enfermería consulta sin pedir el catálogo de receptores ni ofrecer propuestas", async () => {
  const { fetchMock } = setup(); render(<Harness role="NURSE" />);
  fireEvent.click(await screen.findByText("Paciente ficticio · EP-22 · Seguimiento tras alta"));
  expect(screen.queryByText("Proponer relevo del seguimiento", { selector: "summary" })).not.toBeInTheDocument();
  expect(fetchMock.mock.calls.some(([url]) => String(url).includes("followup-doctors"))).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Abrir episodio EP-22" }));
  expect(opened).toHaveBeenCalledWith(22);
});
it("un conflicto consulta la versión actual y conserva los campos para revisión", async () => {
  const { model, fetchMock } = setup(); render(<Harness />); const f = await proposal();
  model.item = { ...model.item, version: '"changed"' };
  fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ detail: { code: "version_conflict", message: "Seguimiento cambiado" } }) } as Response);
  fireEvent.click(f.getByRole("button", { name: "Proponer relevo del seguimiento" }));
  await f.findByRole("button", { name: "He revisado los cambios; usar versión actual" });
  expect(f.getByLabelText("Motivo")).toHaveValue("Relevo ficticio de seguimiento");
});
it("tras aceptar otro responsable retira los formularios y actualiza el aviso sin borrar su borrador", async () => {
  const { model } = setup(); render(<Harness />); await proposal();
  expect(screen.getByText(/Hay campos sin guardar. La actualización automática/)).toBeVisible();
  model.item = { ...model.item, owner: receiver, owner_user_id: 4, version: '"new-owner"' };
  fireEvent.click(screen.getByRole("button", { name: "Actualizar seguimientos" }));
  await screen.findByText("Responsable: Médico Relevo (medico.relevo).");
  await waitFor(() => expect(screen.queryByText(/Hay campos sin guardar. La actualización automática/)).not.toBeInTheDocument());
  expect(readSpecimenDraft(doctor, "/lab/followups/1/propose").draft?.fields.reason).toBe("Relevo ficticio de seguimiento");
});
it("recuperar un borrador informa que la actualización automática está en pausa", async () => {
  setup(); const view = render(<Harness />); await proposal(); view.unmount();
  render(<Harness />);
  await screen.findByText("Paciente ficticio · EP-22 · Seguimiento tras alta");
  await screen.findByText(/Hay campos sin guardar. La actualización automática/);
});
it("una lectura lenta del filtro anterior no reemplaza al filtro actual", async () => {
  const { fetchMock } = setup(); render(<Harness />);
  await screen.findByText("Seguimientos que coinciden: 1.");
  let resolve!: (value: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise<Response>(r => { resolve = r; }));
  fireEvent.click(screen.getByRole("button", { name: "Actualizar seguimientos" }));
  fireEvent.click(screen.getByLabelText("Mis responsabilidades y propuestas"));
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("mine=true"))).toBe(true));
  await act(async () => resolve(response({ total: 99, items: [], limit: 20, offset: 0 })));
  expect(screen.queryByText("Seguimientos que coinciden: 99.")).not.toBeInTheDocument();
  expect(screen.getByText("Seguimientos que coinciden: 1.")).toBeVisible();
});
