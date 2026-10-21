export const OPERATION_CONFIRMED_EVENT = "mediccontrol:operational-confirmed";

export function notifyOperationalConfirmation(path: string, body?: BodyInit | null) {
  window.dispatchEvent(new CustomEvent(OPERATION_CONFIRMED_EVENT, { detail: { path, body } }));
}

export function operationalFields(form: HTMLFormElement) {
  // A pending fieldset is disabled: native FormData would omit its values.
  const fields = new FormData();
  for (const element of form.elements) {
    if ((element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) && element.name)
      fields.set(element.name, element.value);
  }
  return fields;
}

export function operationalFormDirty(form: HTMLFormElement) {
  return [...form.elements].some(element => element instanceof HTMLSelectElement
    ? element.value !== ([...element.options].find(option => option.defaultSelected)?.value ?? element.options[0]?.value ?? "")
    : (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && element.value !== element.defaultValue);
}
