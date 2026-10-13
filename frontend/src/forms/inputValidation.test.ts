import { describe, expect, it } from "vitest";
import { inputError, validateOperationalForm } from "./inputValidation";

describe("operational validation", () => {
  it.each(["name", "document", "location", "assigned_to", "diagnosis", "clinical_note", "title", "result", "note"])("rejects blank %s", name => {
    expect(inputError(name, " \t\n")).toContain("espacios");
  });
  it.each([["name", 200], ["document", 100], ["location", 200], ["assigned_to", 200], ["diagnosis", 500], ["clinical_note", 2000], ["title", 300], ["result", 2000], ["note", 2000]] as const)("checks bounds for %s", (name, max) => {
    expect(inputError(name, "x".repeat(max))).toBe("");
    expect(inputError(name, "x".repeat(max + 1))).toContain("caracteres");
  });
  it("checks real dates and future dates", () => {
    const today = new Date(2026, 9, 12);
    for (const value of ["", "2026-02-30", "2026-1-01", "2026-10-13"]) expect(inputError("birth_date", value, today)).not.toBe("");
    for (const value of ["2000-02-29", "2026-10-12"]) expect(inputError("birth_date", value, today)).toBe("");
  });
  it("preserves fields and permits correction without changing text", () => {
    const form = document.createElement("form"); form.dataset.draftKind = "evaluation";
    const field = document.createElement("textarea"); field.name = "clinical_note"; field.value = "   "; form.append(field);
    expect(validateOperationalForm(form)).toBe(false); expect(field.value).toBe("   ");
    field.value = "  Evaluación\ncon acentos  ";
    expect(validateOperationalForm(form)).toBe(true); expect(field.value).toBe("  Evaluación\ncon acentos  ");
  });
  it("leaves unrelated login and disabled fields alone", () => {
    const form = document.createElement("form"); const field = document.createElement("input"); field.name = "name"; form.append(field);
    expect(validateOperationalForm(form)).toBe(true);
    form.dataset.draftKind = "arrival"; field.disabled = true; expect(validateOperationalForm(form)).toBe(true);
  });
});
