import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import StaffDateTimeInput from "./StaffDateTimeInput";
import { staffingDatePayload } from "./staffingAuditDate";
import { operationalFields, operationalFormDirty } from "../session/operationalWrites";

it("converts explicit AM/PM across noon and midnight and preserves native dirty/reset behavior", () => {
  const { container } = render(<form><StaffDateTimeInput name="ends_at" label="Fin" value="2026-10-26T00:00:00Z" /></form>);
  const form = container.querySelector("form")!;
  expect(screen.getByLabelText("Hora (1–12)")).toHaveValue("8");
  expect(screen.getByLabelText("AM/PM")).toHaveValue("PM");
  expect(operationalFormDirty(form)).toBe(false);
  fireEvent.change(screen.getByLabelText("Hora (1–12)"), { target: { value: "12" } });
  fireEvent.change(screen.getByLabelText("AM/PM"), { target: { value: "AM" } });
  expect(staffingDatePayload(operationalFields(form))).toEqual({ ends_at: "2026-10-25T00:00:00-04:00" });
  fireEvent.change(screen.getByLabelText("AM/PM"), { target: { value: "PM" } });
  expect(staffingDatePayload(new FormData(form))).toEqual({ ends_at: "2026-10-25T12:00:00-04:00" });
  expect(operationalFormDirty(form)).toBe(true);
  form.reset();
  expect(operationalFormDirty(form)).toBe(false);
  expect(staffingDatePayload(new FormData(form))).toEqual({ ends_at: "2026-10-25T20:00:00-04:00" });
});

it("requires date, hour and explicit AM/PM for a new schedule", () => {
  const { container } = render(<form><StaffDateTimeInput name="starts_at" label="Inicio" /></form>);
  const group = screen.getByRole("group", { name: "Inicio" });
  expect(within(group).getByLabelText("AM/PM")).toBeRequired();
  expect(container.querySelector("form")!.checkValidity()).toBe(false);
});
