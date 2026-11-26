import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import OperationalWriteForm from "./OperationalWriteForm";
import { usePendingOperations } from "../hooks/usePendingOperations";
import { operationalFormDirty } from "../session/operationalWrites";
function Harness({ version, value, blocked = false }: { version: string; value: string; blocked?: boolean }) {
  return <OperationalWriteForm path="/staff/demo" label="Guardar" version={version} blocked={blocked} selectDefaults={{ status: value }}
    operations={usePendingOperations()} onDirty={() => {}} onConflict={() => {}} onApplied={() => {}}>
    <label>Nombre<input name="name" defaultValue={value} /></label>
    <label>Estado<select name="status" defaultValue={value}><option value="Anterior">Anterior</option><option value="Actual">Actual</option><option value="Otro">Otro</option></select></label>
  </OperationalWriteForm>;
}
it("rebases clean disabled sibling fields when their server version changes", () => {
  const { rerender, container } = render(<Harness version="v1" value="Anterior" blocked />);
  rerender(<Harness version="v2" value="Actual" blocked />);
  expect(screen.getByLabelText("Nombre")).toHaveValue("Actual");
  expect(operationalFormDirty(container.querySelector("form")!)).toBe(false);
});
it("retains an edited draft and its old baseline when server defaults change", () => {
  const { rerender, container } = render(<Harness version="v1" value="Anterior" />);
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Borrador propio" } });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Motivo propio" } });
  rerender(<Harness version="v2" value="Actual" />);
  expect(screen.getByLabelText("Nombre")).toHaveValue("Borrador propio");
  expect(screen.getByLabelText("Motivo")).toHaveValue("Motivo propio");
  expect(operationalFormDirty(container.querySelector("form")!)).toBe(true);
  expect(screen.getByText("Esta cuenta cambió. Tus campos se conservan. Revisa los datos actuales antes de continuar.")).toBeVisible();
  expect(screen.getByRole("button", { name: /^Guardar$/ })).toBeDisabled();
});

it("rebases native select reset defaults for a clean form", () => {
  const { rerender,container } = render(<Harness version="v1" value="Anterior" />);
  rerender(<Harness version="v2" value="Actual" />);
  expect(screen.getByLabelText("Estado")).toHaveValue("Actual");
  fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "Otro" } });
  act(() => container.querySelector("form")!.reset());
  expect(screen.getByLabelText("Estado")).toHaveValue("Actual");
});
it("preserves a dirty select when authoritative defaults change", () => {
  const { rerender } = render(<Harness version="v1" value="Anterior" />);
  fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "Actual" } });
  rerender(<Harness version="v2" value="Otro" />);
  expect(screen.getByLabelText("Estado")).toHaveValue("Actual");
  expect(screen.getByRole("button", { name: /^Guardar$/ })).toBeDisabled();
});
