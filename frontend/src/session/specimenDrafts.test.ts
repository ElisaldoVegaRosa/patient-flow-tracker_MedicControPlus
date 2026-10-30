import { describe, expect, it, vi } from "vitest";
import { clearSpecimenDrafts, readSpecimenDraft, saveSpecimenDraft } from "./specimenDrafts";
import { RECOVERY_DURATION_MS } from "./dischargeDraft";

const user = { username: "lab.demo", role: "LAB" };
const path = "/lab/specimens/1/receipt";

describe("borradores de muestras de esta pestaña", () => {
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
