import { expect, it } from "vitest";
import { clinicalLabel } from "./clinicalLabels";

it("distingue el mismo código según el recurso al que pertenece", () => {
  expect(clinicalLabel("episodeStatus", "ACTIVE")).toBe("Activo");
  expect(clinicalLabel("alertStatus", "ACTIVE")).toBe("Activa");
  expect(clinicalLabel("role", "LAB")).toBe("Laboratorio");
  expect(clinicalLabel("service", "LAB")).toBe("Laboratorio");
});

it.each(["FUTURE_STATUS", "toString", "constructor", "__proto__", ""])(
  "no inventa un estado válido ni oculta el código desconocido %j", code => {
    expect(clinicalLabel("episodeStatus", code)).toBe(`Código no reconocido (${code})`);
  },
);
