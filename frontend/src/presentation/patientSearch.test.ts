import { expect, it } from "vitest";
import { patientMatcher } from "./patientSearch";

it("busca palabras del nombre sin distinguir acentos, mayúsculas, orden o espacios", () => {
  const matches = patientMatcher("  LARA   jose  ");
  expect(matches("José Lara", 20)).toBe(true);
  expect(matches("Josefina Lara", 21)).toBe(true);
  expect(matches("José Pérez", 22)).toBe(false);
});

it.each(["20", "EP-20", "ep20", "EP 20", " ep - 020 "])(
  "interpreta %j como número de episodio exacto y no como parte de otro", query => {
    const matches = patientMatcher(query);
    expect(matches("Paciente", 20)).toBe(true);
    expect(matches("Paciente 20", 120)).toBe(false);
    expect(matches("Paciente", 2)).toBe(false);
  },
);

it("una búsqueda vacía conserva todos los resultados", () => {
  expect(patientMatcher(" \t ")("Cualquier nombre", 120)).toBe(true);
});

it("trata caracteres especiales como texto y no como expresiones regulares", () => {
  expect(patientMatcher("[a.*")("José Lara", 20)).toBe(false);
  expect(patientMatcher("[a.*")("Paciente [a.* de prueba", 20)).toBe(true);
});
