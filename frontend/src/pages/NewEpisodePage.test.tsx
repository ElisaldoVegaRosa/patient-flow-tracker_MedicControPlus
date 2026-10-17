import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import NewEpisodePage from "./NewEpisodePage";
import { AdmissionReviewError } from "../api/client";
import type { AdmissionCandidate } from "../types/clinical";

const candidate: AdmissionCandidate = {
  id: 20, name: "Paciente Ficticio", document: "TEST64", birth_date: "1990-01-01",
  matches: true, active_episode_ids: [],
};

function prepare(candidates: AdmissionCandidate[]) {
  const onSubmit = vi.fn(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    throw new AdmissionReviewError("Revisar identidad", candidates);
  });
  const onOpenEpisode = vi.fn(async () => {});
  render(<NewEpisodePage onSubmit={onSubmit} onOpenEpisode={onOpenEpisode} />);
  fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: candidate.name } });
  fireEvent.change(screen.getByLabelText("Fecha de nacimiento"), { target: { value: candidate.birth_date } });
  fireEvent.change(screen.getByLabelText("Documento"), { target: { value: candidate.document } });
  fireEvent.submit(screen.getByLabelText("Documento").closest("form")!);
  return { onSubmit, onOpenEpisode };
}

describe("Cotejo de identidad al ingresar", () => {
  it("exige selección explícita, conserva campos y la invalida al cambiar identidad", async () => {
    const { onSubmit } = prepare([candidate]);
    const confirm = await screen.findByRole("radio");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Nombre completo")).toHaveValue(candidate.name);
    const button = screen.getByRole("button", { name: "Crear episodio y pulsera" });
    expect(button).toBeDisabled();
    await userEvent.click(confirm);
    expect(button).toBeEnabled();
    const form = screen.getByLabelText("Documento").closest("form")!;
    expect(new FormData(form).get("patient_id")).toBe("20");
    fireEvent.change(screen.getByLabelText("Prioridad inicial"), { target: { value: "2" } });
    expect(confirm).toBeChecked();
    fireEvent.change(screen.getByLabelText("Documento"), { target: { value: "OTHER" } });
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(new FormData(form).get("patient_id")).toBeNull();
    expect(button).toBeEnabled();
  });

  it("abre un episodio existente sin volver a enviar y bloquea selección de otra ficha coincidente", async () => {
    const { onSubmit, onOpenEpisode } = prepare([candidate, { ...candidate, id: 21, active_episode_ids: [70, 71] }]);
    await userEvent.click(await screen.findByRole("button", { name: "Abrir episodio activo EP-70" }));
    expect(onOpenEpisode).toHaveBeenCalledWith(70);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear episodio y pulsera" })).toBeDisabled();
    expect(screen.getByText(/Hay varias fichas/)).toBeVisible();
  });

  it("no ofrece abrir ni seleccionar ante discrepancias", async () => {
    prepare([{ ...candidate, matches: false, active_episode_ids: [70] }]);
    expect(await screen.findByText(/Los datos no coinciden/)).toBeVisible();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Abrir episodio/ })).not.toBeInTheDocument();
  });
});
