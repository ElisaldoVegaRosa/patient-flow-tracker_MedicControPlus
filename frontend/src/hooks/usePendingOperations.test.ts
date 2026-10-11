import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { usePendingOperations } from "./usePendingOperations";

it("adquiere antes del render, separa claves y una liberacion antigua no libera otra solicitud", () => {
  const { result } = renderHook(usePendingOperations);
  let release!: () => void;
  act(() => {
    release = result.current.start("task:1")!;
    expect(result.current.start("task:1")).toBeNull();
    expect(result.current.start("task:2")).not.toBeNull();
  });
  expect(result.current.isPending("task:1")).toBe(true);
  let next!: () => void;
  act(() => { release(); next = result.current.start("task:1")!; release(); });
  expect(result.current.isPending("task:1")).toBe(true);
  act(() => next());
  expect(result.current.isPending("task:1")).toBe(false);
  expect(result.current.isPending("task:2")).toBe(true);
});
