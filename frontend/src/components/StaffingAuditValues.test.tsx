import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import StaffingAuditValues from "./StaffingAuditValues";

it("shows only changed fields in Dominican time without displaying technical snapshots", () => {
  const before = JSON.stringify({ ends_at: "2026-10-25T12:00:00Z", status: "ACTIVE", revision: 2, version: "old" });
  const after = JSON.stringify({ ends_at: "2026-10-26T00:00:00Z", status: "ACTIVE", revision: 3, version: "new" });
  render(<StaffingAuditValues before={before} after={after} />);
  const table = screen.getByRole("table");
  expect(within(table).getByText(/25\/10\/2026.*0?8:00.*a/)).toBeInTheDocument();
  expect(within(table).getByText(/25\/10\/2026.*0?8:00.*p/)).toBeInTheDocument();
  expect(within(table).queryByText("Estado")).not.toBeInTheDocument();
  expect(table).not.toHaveTextContent("revision");
  expect(screen.queryByText("Detalles técnicos")).not.toBeInTheDocument();
  expect(screen.queryByText(before)).not.toBeInTheDocument();
  expect(screen.queryByText(after)).not.toBeInTheDocument();
});

it("handles creation and translates availability and roles", () => {
  render(<StaffingAuditValues before="null" after={JSON.stringify({ role: "NURSE", status: "PLANNED", effective_available: false })} />);
  const table = screen.getByRole("table");
  expect(within(table).getAllByText("Sin registro")).toHaveLength(3);
  expect(table).toHaveTextContent("Enfermería");
  expect(table).toHaveTextContent("Planificado");
  expect(within(table).getByText("No")).toBeInTheDocument();
});

it("shows a support message for malformed history without exposing raw data", () => {
  render(<StaffingAuditValues before="invalid historical value" after="{}" />);
  expect(screen.getByText(/Solicita una revisión a soporte/)).toBeInTheDocument();
  expect(screen.queryByText("invalid historical value")).not.toBeInTheDocument();
});
