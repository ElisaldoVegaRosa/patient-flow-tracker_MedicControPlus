import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const dashboard = { active: 0, open_alerts: 0, patients: [], requested_by: "demo" };
const response = (data: unknown) => ({ ok: true, status: 200, json: async () => data }) as Response;

describe("Acceso y restauración de sesión", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("envía los datos elegidos, guarda la sesión y abre el dashboard", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (path === "/auth/login") return response({
        username: "medico", role: "DOCTOR", access_token: "token-ficticio-login",
      });
      if (path === "/dashboard") return response(dashboard);
      throw new Error(`Petición inesperada: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Usuario" }), "medico");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("heading", { name: "Centro de control" })).toBeVisible();
    expect(localStorage.getItem("token")).toBe("token-ficticio-login");
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/auth/login", expect.objectContaining({
      method: "POST", body: JSON.stringify({ username: "medico", password: "demo123" }),
    }));
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/dashboard", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer token-ficticio-login" }),
    }));
  });

  it("muestra restauración mientras valida el token y después abre el dashboard", async () => {
    localStorage.setItem("token", "token-ficticio-restaurado");
    let finish!: (value: Response) => void;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (path === "/auth/me") return new Promise<Response>((resolve) => { finish = resolve; });
      if (path === "/dashboard") return Promise.resolve(response(dashboard));
      throw new Error(`Petición inesperada: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    expect(screen.getByRole("heading", { name: "Restaurando sesión" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Entrar" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => finish(response({ username: "demo", role: "RECEPTION" })));
    expect(await screen.findByRole("heading", { name: "Centro de control" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Restaurando sesión" })).not.toBeInTheDocument();
    expect(localStorage.getItem("token")).toBe("token-ficticio-restaurado");
  });

  it("vuelve al formulario y elimina el token si falla la restauración", async () => {
    localStorage.setItem("token", "token-ficticio-restaurado");
    let fail!: (reason: Error) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((_, reject) => { fail = reject; }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    expect(screen.getByRole("heading", { name: "Restaurando sesión" })).toBeVisible();
    await act(async () => fail(new Error("Error de red")));
    expect(await screen.findByRole("heading", { name: "Seguimiento clínico" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
    expect(localStorage.getItem("token")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
