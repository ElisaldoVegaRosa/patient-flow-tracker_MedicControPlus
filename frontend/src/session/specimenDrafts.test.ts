import { describe, expect, it, vi } from "vitest";
import { clearSpecimenDrafts, readSpecimenDraft, saveSpecimenDraft } from "./specimenDrafts";
import { RECOVERY_DURATION_MS } from "./dischargeDraft";

const user = { username: "lab.demo", role: "LAB" };
const path = "/lab/specimens/1/receipt";

it("conserva el borrador de alergias solo para el mismo medico, episodio y rol", () => {
  const owner = { username: "medico", role: "DOCTOR" };
  const allergyPath = "/episodes/42/allergies";
  const fields = { allergy_status: "REPORTED", allergy_description: "Reaccion ficticia", allergy_source: "Paciente ficticio", reason: "Revision ficticia" };
  saveSpecimenDraft(owner, allergyPath, '"v1"', fields, true);
  expect(readSpecimenDraft(owner, allergyPath).draft).toMatchObject({ baseline: '"v1"', fields });
  expect(readSpecimenDraft(owner, "/episodes/43/allergies").draft).toBeUndefined();
  expect(readSpecimenDraft({ ...owner, role: "NURSE" }, allergyPath).draft).toBeUndefined();
  expect(readSpecimenDraft(owner, allergyPath).draft).toBeUndefined();
});

describe("borradores de muestras de esta pestaña", () => {
  it("recupera una corrección de motivo por episodio y elimina el borrador al cambiar de rol", () => {
    const reception = { username: "recepcion", role: "RECEPTION" };
    const correction = "/episodes/42/consultation-reason";
    saveSpecimenDraft(reception, correction, '"v1"', { value: "Motivo corregido", reason: "Error ficticio" }, true);
    expect(readSpecimenDraft(reception, correction).draft).toMatchObject({ baseline: '"v1"', fields: { value: "Motivo corregido", reason: "Error ficticio" } });
    expect(readSpecimenDraft(reception, "/episodes/43/consultation-reason").draft).toBeUndefined();
    expect(readSpecimenDraft({ ...reception, role: "SUPERVISOR" }, correction).draft).toBeUndefined();
    expect(readSpecimenDraft(reception, correction).draft).toBeUndefined();
  });
  it("recupera campos y versión solo para la misma cuenta y acción, sin tokens", () => {
    saveSpecimenDraft(user, path, '"v1"', { reason: "Motivo ficticio", password: "no conservar" }, true);
    expect(readSpecimenDraft(user, path).draft).toMatchObject({ baseline: '"v1"', fields: { reason: "Motivo ficticio" } });
    expect(readSpecimenDraft(user, "/lab/specimens/1/delivery").draft).toBeUndefined();
    expect(Object.values(sessionStorage).join(" ")).not.toContain("no conservar");
    expect(readSpecimenDraft({ ...user, username: "otra.cuenta" }, path).draft).toBeUndefined();
    expect(readSpecimenDraft(user, path).draft).toBeUndefined();
  });
  it("el cambio de rol impide recuperar el borrador", () => {
    saveSpecimenDraft(user, path, '"v1"', { reason: "Motivo ficticio" }, true);
    expect(readSpecimenDraft({ ...user, role: "NURSE" }, path).draft).toBeUndefined();
  });
  it("caduca sin renovar al leer y elimina los datos expirados", () => {
    const start = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(start);
    saveSpecimenDraft(user, path, '"v1"', { reason: "Motivo ficticio" }, true);
    vi.spyOn(Date, "now").mockReturnValue(start + RECOVERY_DURATION_MS);
    expect(readSpecimenDraft(user, path).draft).toBeUndefined();
    expect(sessionStorage.length).toBe(0);
  });
  it("guardar, descartar o cerrar sesión elimina el borrador", () => {
    saveSpecimenDraft(user, path, '"v1"', { reason: "Motivo ficticio" }, true);
    saveSpecimenDraft(user, path, '"v1"', {}, false);
    expect(readSpecimenDraft(user, path).draft).toBeUndefined();
    saveSpecimenDraft(user, path, '"v1"', { reason: "Otro motivo" }, true);
    clearSpecimenDrafts();
    expect(sessionStorage.length).toBe(0);
  });
  it("informa almacenamiento inaccesible sin lanzar errores al formulario", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Bloqueado"); });
    expect(saveSpecimenDraft(user, path, '"v1"', { reason: "Motivo" }, true)).toContain("No se pudo conservar");
  });

  it("separa borradores de publicación y corrección por analítica y versión de informe", () => {
    saveSpecimenDraft(user, "/lab/analyses/5/results", '"v1"', { result: "Texto ficticio", specimen_ids: "1,2", reason: "Motivo" }, true);
    saveSpecimenDraft(user, "/lab/results/41/corrections", '"v2"', { result: "Corrección ficticia", reason: "Motivo" }, true);
    expect(readSpecimenDraft(user, "/lab/analyses/5/results").draft?.fields.specimen_ids).toBe("1,2");
    expect(readSpecimenDraft(user, "/lab/results/42/corrections").draft).toBeUndefined();
    expect(readSpecimenDraft(user, "/lab/results/41/corrections").draft?.fields.result).toBe("Corrección ficticia");
  });

  it("recupera revisión solo para la cuenta y rol que la escribió", () => {
    const doctor = { username: "medico.demo", role: "DOCTOR" };
    saveSpecimenDraft(doctor, "/lab/results/41/review", '"v1"', { reason: "Revisión ficticia" }, true);
    expect(readSpecimenDraft(doctor, "/lab/results/41/review").draft?.fields.reason).toBe("Revisión ficticia");
    expect(readSpecimenDraft(user, "/lab/results/41/review").draft).toBeUndefined();
  });
});
