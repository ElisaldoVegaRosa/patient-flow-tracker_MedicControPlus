    import { render, screen } from "@testing-library/react";
    import userEvent from "@testing-library/user-event";
    import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    } from "vitest";

    import App from "./App";

    describe("Inicio de sesión de MedicControl+", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("muestra el formulario y los cinco roles", async () => {
        render(<App />);

        expect(
        await screen.findByRole("heading", {
            name: /seguimiento clínico/i,
        }),
        ).toBeInTheDocument();

        const roleSelector = screen.getByRole("combobox", {
        name: /usuario/i,
        });

        expect(roleSelector).toHaveTextContent("Recepción");
        expect(roleSelector).toHaveTextContent("Enfermería");
        expect(roleSelector).toHaveTextContent("Médico");
        expect(roleSelector).toHaveTextContent("Laboratorio");
        expect(roleSelector).toHaveTextContent("Supervisor");

        expect(
        screen.getByRole("button", {
            name: /entrar/i,
        }),
        ).toBeInTheDocument();
    });

    it("muestra el error enviado por el backend", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
            detail: "Credenciales inválidas",
        }),
        });

        vi.stubGlobal("fetch", fetchMock);

        const user = userEvent.setup();

        render(<App />);

        const passwordInput = await screen.findByLabelText(
        /contraseña/i,
        );

        await user.clear(passwordInput);
        await user.type(passwordInput, "incorrecta");

        await user.click(
        screen.getByRole("button", {
            name: /entrar/i,
        }),
        );

        expect(
        await screen.findByText("Credenciales inválidas"),
        ).toBeInTheDocument();

        expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8000/auth/login",
        expect.objectContaining({
            method: "POST",
        }),
        );
    });
    });