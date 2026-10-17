import { afterEach, describe, expect, it, vi } from "vitest";
import { FormDraftRecovery } from "./formDrafts";
import { TabDraftStorage, TAB_DRAFT_PREFIX } from "./tabDraftStorage";
import { RECOVERY_DURATION_MS } from "./dischargeDraft";

const doctor = { username: "medico", role: "DOCTOR" };
const draft = { kind: "evaluation" as const, episodeId: 42, fields: { diagnosis: "Prueba ficticia", clinical_note: "Texto ficticio" } };
const journal = (api = "http://localhost:8000") => new TabDraftStorage(api);

afterEach(() => vi.restoreAllMocks());

describe("Borradores temporales de la pestaña", () => {
  it("recupera tras recrear el almacén con identidad, texto y versión originales", () => {
    const store = new FormDraftRecovery(journal());
    store.track(doctor, { ...draft, baseVersion: '"original"' });
    const reloaded = new FormDraftRecovery(journal());
    expect(reloaded.forUser(doctor)?.drafts[0]).toMatchObject({ ...draft, baseVersion: '"original"' });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(1);
    expect(sessionStorage.key(0)).toContain(TAB_DRAFT_PREFIX);
  });
  it.each([{ ...doctor, username: "otro" }, { ...doctor, role: "NURSE" }])("elimina al comprobar otro usuario o rol", user => {
    new FormDraftRecovery(journal()).track(doctor, draft);
    expect(new FormDraftRecovery(journal()).forUser(user)).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
  it("separa APIs y no copia tokens ni selecciones de ficha", () => {
    const owner = { username: "recepcion", role: "RECEPTION", access_token: "no-conservar" };
    new FormDraftRecovery(journal()).track(owner, { kind: "arrival", fields: { name: "Ficticio", patient_id: "8", token: "no-conservar" } });
    expect(new FormDraftRecovery(journal("http://otro:8000")).forUser(owner)).toBeNull();
    const raw = sessionStorage.getItem(journal().key)!;
    expect(raw).not.toContain("no-conservar");
    expect(raw).not.toContain("patient_id");
    expect(new FormDraftRecovery(journal()).forUser(owner)?.drafts[0].fields).toEqual({ name: "Ficticio" });
  });
  it("caduca por formulario desde la edición, sin renovarse al recargar o consultar", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const store = new FormDraftRecovery(journal());
    store.track(doctor, draft);
    vi.mocked(Date.now).mockReturnValue(now + 1000);
    store.track(doctor, { kind: "order", episodeId: 42, fields: { title: "Otra prueba" } });
    vi.mocked(Date.now).mockReturnValue(now + RECOVERY_DURATION_MS - 1);
    expect(new FormDraftRecovery(journal()).forUser(doctor)?.drafts).toHaveLength(2);
    vi.mocked(Date.now).mockReturnValue(now + RECOVERY_DURATION_MS);
    expect(new FormDraftRecovery(journal()).forUser(doctor)?.drafts.map(item => item.kind)).toEqual(["order"]);
    vi.mocked(Date.now).mockReturnValue(now + RECOVERY_DURATION_MS + 1000);
    expect(new FormDraftRecovery(journal()).forUser(doctor)).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
  it("retira solo el guardado y borra al descartar o volver al valor original", () => {
    const store = new FormDraftRecovery(journal());
    store.track(doctor, draft);
    store.track(doctor, { kind: "order", episodeId: 42, fields: { title: "Prueba" } });
    store.remove("evaluation", 42);
    expect(new FormDraftRecovery(journal()).forUser(doctor)?.drafts.map(item => item.kind)).toEqual(["order"]);
    store.track(doctor, { kind: "order", episodeId: 42, fields: {} }, false);
    expect(sessionStorage.length).toBe(0);
    store.track(doctor, draft);
    store.clear();
    expect(sessionStorage.length).toBe(0);
  });
  it.each(["json roto", JSON.stringify({ version: 2 }), JSON.stringify({ version: 1, owner: doctor, drafts: [{ ...draft, editedAt: Date.now(), fields: { token: "no" } }] })])("descarta formato desconocido o campos ajenos sin exponer contenido", raw => {
    sessionStorage.setItem(journal().key, raw);
    const store = new FormDraftRecovery(journal());
    expect(store.forUser(doctor)).toBeNull();
    expect(store.storageWarning).toContain("No se pudo recuperar");
    expect(sessionStorage.length).toBe(0);
  });
  it("no restaura tiempos futuros ni renueva el plazo por una segunda interrupción", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const store = new FormDraftRecovery(journal());
    store.track(doctor, draft);
    vi.mocked(Date.now).mockReturnValue(now - 1);
    expect(new FormDraftRecovery(journal()).forUser(doctor)).toBeNull();
  });
  it("mantiene recuperación en memoria y avisa si el navegador bloquea almacenamiento", () => {
    const denied = new TabDraftStorage("test", () => { throw new Error("bloqueado"); });
    const store = new FormDraftRecovery(denied);
    store.track(doctor, draft);
    store.suspend();
    expect(store.forUser(doctor)?.drafts[0].fields).toEqual(draft.fields);
    expect(store.storageWarning).toContain("No se pudo conservar");
  });
  it("si se agota la cuota retira la copia vieja y conserva los campos actuales en memoria", () => {
    const tab = journal();
    const store = new FormDraftRecovery(tab);
    store.track(doctor, draft);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("cuota"); });
    store.track(doctor, { ...draft, fields: { clinical_note: "Texto actualizado" } });
    expect(sessionStorage.getItem(tab.key)).toBeNull();
    store.suspend();
    expect(store.forUser(doctor)?.drafts[0].fields.clinical_note).toBe("Texto actualizado");
    expect(store.storageWarning).toContain("No se pudo conservar");
  });

  it("avisa antes de escribir un formato que excede los límites de recuperación", () => {
    const tab = journal();
    const store = new FormDraftRecovery(tab);
    store.track(doctor, { ...draft, fields: { clinical_note: "x".repeat(10_001) } });
    expect(sessionStorage.length).toBe(0);
    expect(store.storageWarning).toContain("No se pudo conservar");
    store.suspend();
    expect(store.forUser(doctor)?.drafts[0].fields.clinical_note).toHaveLength(10_001);
  });

});
