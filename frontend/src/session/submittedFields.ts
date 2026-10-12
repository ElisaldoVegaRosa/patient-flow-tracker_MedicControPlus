/** Compare against the same numeric conversion used by clinical forms. */
export function matchesSubmittedFields(fields: FormData, payload: Record<string, unknown>) {
  return Object.entries(payload).every(([name, value]) => typeof value === "number"
    ? Number(fields.get(name)) === value
    : String(fields.get(name) ?? "") === String(value ?? ""));
}
