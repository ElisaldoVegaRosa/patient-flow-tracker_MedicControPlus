const constraints: Record<string, [number, number]> = {
  name: [1, 200], document: [1, 100], location: [1, 200], assigned_to: [1, 200],
  diagnosis: [2, 500], clinical_note: [3, 2000], title: [3, 300], result: [3, 2000], note: [1, 2000],
};
export function inputError(name: string, value: string, today = new Date()): string {
  if (name === "birth_date") {
    const date = new Date(`${value}T00:00:00Z`);
    if (value.startsWith("0000-") || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value)
      return "Usa una fecha de nacimiento válida con formato AAAA-MM-DD";
    const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return value > current ? "La fecha de nacimiento no puede ser futura" : "";
  }
  const limits = constraints[name];
  if (!limits) return "";
  if (!value.trim()) return "Escribe un valor que no esté vacío ni contenga solo espacios";
  const length = [...value].length;
  return length < limits[0] || length > limits[1] ? `Usa entre ${limits[0]} y ${limits[1]} caracteres` : "";
}

/** Validate operational forms only; leave values and draft ownership intact. */
export function validateOperationalForm(form: HTMLFormElement): boolean {
  if (!form.dataset.draftKind) return true;
  let valid = true;
  for (const field of form.elements) {
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) continue;
    if (field.disabled) continue;
    if (field instanceof HTMLInputElement && field.dataset.identityOptional === "true" && !field.value.trim()) {
      field.setCustomValidity("");
      continue;
    }
    // The existing discharge handler supplies its focused empty-note message.
    const error = form.dataset.draftKind === "discharge" && !field.value.trim() ? "" : inputError(field.name, field.value);
    field.setCustomValidity(error);
    if (error) valid = false;
  }
  if (!valid) form.reportValidity();
  return valid;
}
