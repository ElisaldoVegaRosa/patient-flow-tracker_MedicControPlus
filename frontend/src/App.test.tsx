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

    it("permite evaluar reglas temporales desde una accion explicita", async () => {
        localStorage.setItem("token", "token-de-prueba");

        const dashboardResponse = {
        active: 0,
        open_alerts: 0,
        patients: [],
        requested_by: "supervisor",
        };

        const supervisorResponse = {
        metrics: {
            active_patients: 0,
            high_priority_patients: 0,
            patients_at_risk: 0,
            open_alerts: 0,
            pending_tasks: 0,
        },
        rules: {
            evaluated_episodes: 0,
            generated_alerts: 0,
        },
        patients: [],
        generated_at: "2026-09-27T00:00:00+00:00",
        requested_by: "supervisor",
        };

        const evaluationResponse = {
        evaluated_episodes: 4,
        generated_alerts: 2,
        evaluated_at: "2026-09-27T00:01:00+00:00",
        requested_by: "supervisor",
        };

        const fetchMock = vi.fn(
        async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const method = init?.method ?? "GET";

            if (url.endsWith("/auth/me")) {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                username: "supervisor",
                role: "SUPERVISOR",
                }),
            } as Response;
            }

            if (
            url.endsWith("/supervisor/dashboard") &&
            method === "GET"
            ) {
            return {
                ok: true,
                status: 200,
                json: async () => supervisorResponse,
            } as Response;
            }

            if (url.endsWith("/dashboard")) {
            return {
                ok: true,
                status: 200,
                json: async () => dashboardResponse,
            } as Response;
            }

            if (
            url.endsWith("/rules/evaluate") &&
            method === "POST"
            ) {
            return {
                ok: true,
                status: 200,
                json: async () => evaluationResponse,
            } as Response;
            }

            throw new Error(`Peticion inesperada: ${method} ${url}`);
        },
        );

        vi.stubGlobal("fetch", fetchMock);

        const user = userEvent.setup();

        render(<App />);

        await user.click(
        await screen.findByRole("button", {
            name: /panel de supervisor/i,
        }),
        );

        const evaluateButton = await screen.findByRole("button", {
        name: /evaluar reglas temporales/i,
        });

        const refreshButton = screen.getByRole("button", {
        name: /actualizar indicadores/i,
        });

        await user.click(refreshButton);

        expect(
        fetchMock.mock.calls.some(
            ([url, init]) =>
            String(url).endsWith("/rules/evaluate") &&
            init?.method === "POST",
        ),
        ).toBe(false);

        await user.click(evaluateButton);

        expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8000/rules/evaluate",
        expect.objectContaining({
            method: "POST",
        }),
        );

        expect(
        fetchMock.mock.calls.some(
            ([url, init]) =>
            String(url).endsWith("/supervisor/dashboard") &&
            init?.method === undefined,
        ),
        ).toBe(true);

        expect(
        await screen.findByText(/2 alertas generadas/i),
        ).toBeInTheDocument();
    });

    it("muestra errores al evaluar reglas temporales", async () => {
        localStorage.setItem("token", "token-de-prueba");

        const dashboardResponse = {
        active: 0,
        open_alerts: 0,
        patients: [],
        requested_by: "supervisor",
        };

        const supervisorResponse = {
        metrics: {
            active_patients: 0,
            high_priority_patients: 0,
            patients_at_risk: 0,
            open_alerts: 0,
            pending_tasks: 0,
        },
        rules: {
            evaluated_episodes: 0,
            generated_alerts: 0,
        },
        patients: [],
        generated_at: "2026-09-27T00:00:00+00:00",
        requested_by: "supervisor",
        };

        const fetchMock = vi.fn(
        async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const method = init?.method ?? "GET";

            if (url.endsWith("/auth/me")) {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                username: "supervisor",
                role: "SUPERVISOR",
                }),
            } as Response;
            }

            if (
            url.endsWith("/supervisor/dashboard") &&
            method === "GET"
            ) {
            return {
                ok: true,
                status: 200,
                json: async () => supervisorResponse,
            } as Response;
            }

            if (url.endsWith("/dashboard")) {
            return {
                ok: true,
                status: 200,
                json: async () => dashboardResponse,
            } as Response;
            }

            if (
            url.endsWith("/rules/evaluate") &&
            method === "POST"
            ) {
            return {
                ok: false,
                status: 500,
                json: async () => ({
                detail: "No fue posible evaluar reglas",
                }),
            } as Response;
            }

            throw new Error(`Peticion inesperada: ${method} ${url}`);
        },
        );

        vi.stubGlobal("fetch", fetchMock);

        const user = userEvent.setup();

        render(<App />);

        await user.click(
        await screen.findByRole("button", {
            name: /panel de supervisor/i,
        }),
        );

        await user.click(
        await screen.findByRole("button", {
            name: /evaluar reglas temporales/i,
        }),
        );

        expect(
        await screen.findByText(/no fue posible evaluar reglas/i),
        ).toBeInTheDocument();
    });
    });
