import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import OperationalWriteForm from "./OperationalWriteForm";
import { usePendingOperations } from "../hooks/usePendingOperations";
import { operationalFormDirty } from "../session/operationalWrites";
function Harness({ version, value, blocked = false }: { version: string; value: string; blocked?: boolean }) {
  return <OperationalWriteForm path="/staff/demo" label="Guardar" version={version} blocked={blocked}
    operations={usePendingOperations()} onDirty={() => {}} onConflict={() => {}} onApplied={() => {}}>
    <label>Nombre<input name="name" defaultValue={value} /></label>
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
