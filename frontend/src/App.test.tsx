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


describe("EpisodePage: solo lectura y permisos por rol", () => {
  const roles = ["RECEPTION", "NURSE", "DOCTOR", "LAB", "SUPERVISOR"];
  const writeButtons = [
    "Guardar triaje y asignación", "Guardar y evaluar reglas",
    "Guardar evaluación médica", "Crear y asignar orden", "Completar",
    "Reconocer", "Escalar", "Resolver", "Cerrar episodio · Alta médica",
  ];

  beforeEach(() => localStorage.setItem("token", "token-de-prueba"));
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  async function openEpisode(role: string, status: string) {
    const date = "2026-10-03T12:00:00Z";
    const episode: import("./types/clinical").Episode = {
      id: 42, name: "Paciente ficticio", document: "QA-READONLY",
      birth_date: "1990-01-01", qr_token: "qr-ficticio", status,
      priority: 2, location: "Observación", started_at: date,
      closed_at: status === "CLOSED" ? date : null,
      vitals: [{ id: 1, episode_id: 42, temperature: 38.2,
        heart_rate: 104, systolic: 120, diastolic: 80, spo2: 96,
        respiratory_rate: 18, created_at: date }],
      alerts: ["ACTIVE", "ACKNOWLEDGED", "ESCALATED", "RESOLVED"].map(
        (alertStatus, index) => ({
          id: index + 1, episode_id: 42, reason: `Alerta ${alertStatus}`,
          severity: "HIGH", status: alertStatus, responsible: "medico",
          created_at: date, updated_at: date,
          history: [{ id: index + 1, alert_id: index + 1,
            old_status: "ACTIVE", new_status: alertStatus,
            username: "auditor-ficticio", created_at: date }],
        }),
      ),
      tasks: [
        { id: 1, episode_id: 42, title: "Tarea pendiente ficticia",
          service: "NURSING", status: "PENDING", result: null },
        { id: 2, episode_id: 42, title: "Hemograma ficticio",
          service: "LAB", status: "COMPLETED", result: "Resultado simulado" },
      ],
      events: [
        { id: 1, episode_id: 42, type: "TASK_COMPLETED", username: "laboratorio",
          note: "Hemograma ficticio: Resultado simulado", created_at: date },
        { id: 2, episode_id: 42, type: "VITALS_RECORDED", username: "enfermeria",
          note: "Vitales históricos ficticios", created_at: date },
      ],
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (init?.method && init.method !== "GET") throw new Error("Mutación inesperada");
      const responses: Record<string, unknown> = {
        "/auth/me": { username: "usuario-ficticio", role },
        "/dashboard": { active: 0, open_alerts: 0, patients: [], requested_by: role },
        "/scan/qr-ficticio": episode,
      };
      if (!(path in responses)) throw new Error(`Petición inesperada: ${path}`);
      return { ok: true, status: 200, json: async () => responses[path] } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Escanear pulsera" }));
    await user.type(screen.getByRole("textbox"), "qr-ficticio");
    await user.click(screen.getByRole("button", { name: "Identificar paciente" }));
    await screen.findByRole("heading", { name: episode.name });
    return { user, fetchMock };
  }

  it.each(roles)("CLOSED es solo lectura para %s y conserva la auditoría", async (role) => {
    const { user, fetchMock } = await openEpisode(role, "CLOSED");
    // Incluye controles dentro de details cerrados: tampoco deben existir en el DOM.
    expect.soft(screen.queryByText("Registrar nuevos signos")).not.toBeInTheDocument();
    for (const name of writeButtons) {
      expect.soft(screen.queryAllByRole("button", { name, hidden: true })).toHaveLength(0);
    }
    expect.soft(document.querySelectorAll("main form, main input, main select, main textarea")).toHaveLength(0);
    expect.soft(screen.queryByRole("status")).toHaveTextContent("Episodio cerrado — solo lectura");
    expect(screen.getByText("Episodio EP-42 · CLOSED")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Línea de tiempo auditable" })).toBeVisible();
    expect(screen.getByText("38.2 °C")).toBeVisible();
    expect(screen.getByText("104 lpm")).toBeVisible();
    expect(screen.getByText("Vitales históricos ficticios")).toBeVisible();
    expect(screen.getByText("Tarea pendiente ficticia")).toBeVisible();
    expect(screen.getByText("Hemograma ficticio: Resultado simulado")).toBeVisible();
    await user.click(screen.getByText(/Alertas resueltas/));
    for (const status of ["ACTIVE", "ACKNOWLEDGED", "ESCALATED", "RESOLVED"]) {
      expect(screen.getByText(`HIGH · Alerta ${status}`)).toBeVisible();
    }
    for (const summary of screen.getAllByText(/Ver historial/)) await user.click(summary);
    for (const entry of screen.getAllByText(/auditor-ficticio/)) expect(entry).toBeVisible();
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      "/auth/me", "/dashboard", "/scan/qr-ficticio",
    ]);
  });

  it.each(roles)("ACTIVE conserva los controles existentes para %s", async (role) => {
    const { user } = await openEpisode(role, "ACTIVE");
    const nurseOrDoctor = role === "NURSE" || role === "DOCTOR";
    if (nurseOrDoctor) await user.click(screen.getByText("Registrar nuevos signos"));
    else expect(screen.queryByText("Registrar nuevos signos")).not.toBeInTheDocument();
    const allowed = [
      role === "NURSE" || role === "SUPERVISOR", nurseOrDoctor,
      role === "DOCTOR", role === "DOCTOR", true,
      nurseOrDoctor || role === "SUPERVISOR", nurseOrDoctor || role === "SUPERVISOR",
      role === "DOCTOR" || role === "SUPERVISOR", role === "DOCTOR",
    ];
    writeButtons.forEach((name, index) => {
      const buttons = screen.queryAllByRole("button", { name });
      if (allowed[index]) {
        expect(buttons.length).toBeGreaterThan(0);
        buttons.forEach((button) => expect(button).toBeEnabled());
      } else expect(buttons).toHaveLength(0);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
