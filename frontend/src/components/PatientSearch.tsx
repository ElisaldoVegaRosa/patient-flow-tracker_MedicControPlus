import { useId } from "react";

type PatientSearchProps = {
  query: string;
  onChange: (query: string) => void;
  count: number;
  total: number;
  unit: "pacientes" | "episodios" | "órdenes";
};

export default function PatientSearch({ query, onChange, count, total, unit }: PatientSearchProps) {
  const id = useId();
  return <div className="patient-search" role="search" aria-label="Buscar pacientes">
    <label htmlFor={id}>Buscar por nombre o episodio</label>
    <div className="patient-search-controls">
      <input id={id} type="search" autoComplete="off" value={query}
        placeholder="Ej.: José Lara o EP-20" aria-describedby={`${id}-help`}
        onChange={event => onChange(event.target.value)} />
      <button type="button" className="secondary-button" disabled={!query} onClick={() => onChange("")}>Limpiar búsqueda</button>
    </div>
    <small id={`${id}-help`}>Busca dentro del filtro actual. Los indicadores muestran los totales generales.</small>
    <p aria-live="polite" aria-atomic="true">Mostrando {count} de {total} {unit}.</p>
  </div>;
}
