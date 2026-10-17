import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { acknowledgeInterruptedWrites, invalidateSession } from "../api/client";

afterEach(() => {
  cleanup();
  invalidateSession();
  acknowledgeInterruptedWrites();
  localStorage.clear();
  sessionStorage.clear();
});
