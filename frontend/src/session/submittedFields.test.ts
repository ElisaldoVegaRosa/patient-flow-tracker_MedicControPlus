import { expect, it } from "vitest";
import { matchesSubmittedFields } from "./submittedFields";

it("una temperatura decimal equivalente pertenece al envío confirmado", () => {
  const fields = new FormData();
  fields.set("temperature", "37.0");
  fields.set("heart_rate", "080");
  expect(matchesSubmittedFields(fields, { temperature: 37, heart_rate: 80 })).toBe(true);
  fields.set("temperature", "38.0");
  expect(matchesSubmittedFields(fields, { temperature: 37, heart_rate: 80 })).toBe(false);
});

it("una edición de texto posterior no se limpia como si fuera el envío original", () => {
  const fields = new FormData();
  fields.set("clinical_note", "Control ficticio");
  expect(matchesSubmittedFields(fields, { clinical_note: "Control ficticio" })).toBe(true);
  fields.set("clinical_note", "Control ficticio nuevo");
  expect(matchesSubmittedFields(fields, { clinical_note: "Control ficticio" })).toBe(false);
});
