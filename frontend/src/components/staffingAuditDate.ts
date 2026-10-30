export function staffingAuditDate(value: string, includeSeconds = false) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true, ...(includeSeconds ? { second: "2-digit" as const } : {}),
  }).format(date);
}

export function staffingLocalDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santo_Domingo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value)).replace(" ", "T");
}
export function staffingDatePayload(fields: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = Object.fromEntries(fields);
  for (const name of ["starts_at", "ends_at", "due_at", "occurred_at"]) {
    if (!fields.has(`${name}_date`)) continue;
    const hour = Number(fields.get(`${name}_hour`));
    const period = fields.get(`${name}_period`);
    const date = fields.get(`${name}_date`);
    const minute = fields.get(`${name}_minute`);
    const valid = date && hour >= 1 && hour <= 12 && (period === "AM" || period === "PM");
    result[name] = valid ? `${date}T${String(hour % 12 + (period === "PM" ? 12 : 0)).padStart(2, "0")}:${minute}:00-04:00` : "";
    for (const part of ["date", "hour", "minute", "period"]) delete result[`${name}_${part}`];
  }
  return result;
}
