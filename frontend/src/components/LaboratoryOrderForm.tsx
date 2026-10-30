import { useEffect, useRef, useState } from "react";
import OperationalWriteForm from "./OperationalWriteForm";
import { readSpecimenDraft, saveSpecimenDraft } from "../session/specimenDrafts";
import type { Episode, LaboratoryOrderRequest, SessionUser } from "../types/clinical";
import type { PendingOperations } from "../hooks/usePendingOperations";
import type { SampleApplied } from "./SpecimenWorkPanel";

function rows(fields: Record<string, string>, prefix: string, fallback: string) {
  const found = Object.keys(fields).filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length));
  return found.length ? found : [fallback];
}
function laboratoryOrderPayload(fields: FormData): LaboratoryOrderRequest {
  const values = Object.fromEntries(fields) as Record<string, string>;
  return {
    title: values.title, reason: values.reason,
    analyses: Object.keys(values).filter(key => /^analysis_a\d+$/.test(key)).map(key => ({ key: key.slice(9), title: values[key] })),
    specimens: Object.keys(values).filter(key => /^kind_s\d+$/.test(key)).map(key => {
      const id = key.slice(5);
      return { key: id, kind: values[key], ...(values[key] === "OTHER" ? { kind_description: values[`description_${id}`] } : {}),
        analysis_keys: Object.keys(values).filter(link => link.startsWith(`link_${id}_`) && values[link] === "yes").map(link => link.slice(`link_${id}_`.length)) };
    }),
  };
}

export default function LaboratoryOrderForm(props: {
  episode: Episode; user: SessionUser; operations: PendingOperations;
  onApplied: SampleApplied; onConflict: (current: () => boolean) => void;
}) {
  if (props.user.role !== "DOCTOR" || props.episode.status !== "ACTIVE" || !props.episode.laboratory) return null;
  return <OrderEditor key={props.episode.id} {...props} />;
}
function OrderEditor({ episode, user, operations, onApplied, onConflict }: Parameters<typeof LaboratoryOrderForm>[0]) {
  const path = `/episodes/${episode.id}/lab-orders`;
  const [saved] = useState(() => readSpecimenDraft(user, path));
  const [warning, setWarning] = useState(saved.warning);
  const [analyses, setAnalyses] = useState(() => rows(saved.draft?.fields ?? {}, "analysis_", "a1"));
  const [specimens, setSpecimens] = useState(() => rows(saved.draft?.fields ?? {}, "kind_", "s1"));
  const [revision, setRevision] = useState(0);
  const [kinds, setKinds] = useState<Record<string, string>>(() => Object.fromEntries(specimens.map(id => [id, saved.draft?.fields[`kind_${id}`] ?? ""])));
  const next = useRef(Math.max(1, ...analyses.concat(specimens).map(id => Number(id.slice(1)))) + 1);
  const root = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function validate() {
    const form = root.current?.querySelector("form");
    if (!form) return;
    const data = new FormData(form);
    for (const id of analyses) {
      const field = form.elements.namedItem(`analysis_${id}`);
      if (field instanceof HTMLInputElement) field.setCustomValidity(specimens.some(s => data.get(`link_${s}_${id}`) === "yes") ? "" : "Vincula esta analítica con al menos una muestra.");
    }
    for (const id of specimens) {
      const field = form.elements.namedItem(`kind_${id}`);
      if (field instanceof HTMLSelectElement) field.setCustomValidity(analyses.some(a => data.get(`link_${id}_${a}`) === "yes") ? "" : "Selecciona al menos una analítica para esta muestra.");
    }
  }
  // Revalidate the relationships after adding/removing a row, without sending it.
  useEffect(validate, [analyses, specimens]);
  function add(kind: "analysis" | "specimen") {
    const id = `${kind === "analysis" ? "a" : "s"}${next.current++}`;
    if (kind === "analysis") setAnalyses(value => [...value, id]); else setSpecimens(value => [...value, id]);
    setRevision(value => value + 1);
  }
  function remove(kind: "analysis" | "specimen", id: string) {
    if (kind === "analysis") setAnalyses(value => value.filter(row => row !== id)); else setSpecimens(value => value.filter(row => row !== id));
    setRevision(value => value + 1);
  }
  return <section className="panel laboratory-order"><h2>Nueva orden de laboratorio</h2>
    <p>Indica cada analítica y vincúlala con sus muestras. Puedes compartir una muestra entre varias analíticas. No registra obtención ni resultados.</p>
    {warning && <p role="alert">{warning}</p>}
    {!episode.clinical_version && <p role="alert">No se pudo verificar la versión del episodio. Actualiza sus datos antes de crear una orden.</p>}
    <div ref={root} onChange={validate} onReset={() => { setAnalyses(["a1"]); setSpecimens(["s1"]); setKinds({}); setRevision(0); }}>
      <OperationalWriteForm path={path} version={episode.clinical_version} label="Crear orden de laboratorio" conflictNoun="episodio"
        blocked={!episode.clinical_version} operations={operations} transform={fields => laboratoryOrderPayload(fields)}
        initialDraft={saved.draft} structureRevision={revision}
        onDraft={(version, fields, dirty) => setWarning(saveSpecimenDraft(user, path, version, fields, dirty))}
        onDirty={() => {}} onConflict={() => { if (mounted.current) onConflict(() => mounted.current); }}
        onApplied={(...args) => { if (mounted.current) onApplied(...args); }}>
        <label>Nombre de la orden<input name="title" required minLength={3} maxLength={300} /></label>
        <h3>Analíticas solicitadas</h3>
        {analyses.map((id, index) => <fieldset key={id}><legend>Analítica {index + 1}</legend>
          <label>Nombre de analítica {index + 1}<input name={`analysis_${id}`} required minLength={3} maxLength={300} /></label>
          {analyses.length > 1 && <button type="button" onClick={() => remove("analysis", id)}>Quitar analítica {index + 1}</button>}
        </fieldset>)}
        <button type="button" disabled={analyses.length >= 30} onClick={() => add("analysis")}>Añadir analítica</button>
        <h3>Muestras requeridas</h3>
        {specimens.map((id, index) => <fieldset key={id}><legend>Muestra {index + 1}</legend>
          <label>Tipo de muestra {index + 1}<select name={`kind_${id}`} required defaultValue="" onChange={e => setKinds(value => ({ ...value, [id]: e.target.value }))}>
            <option value="">Selecciona el tipo</option><option value="BLOOD">Sangre</option><option value="SALIVA">Saliva</option>
            <option value="STOOL">Heces</option><option value="URINE">Orina</option><option value="OTHER">Otra</option>
          </select></label>
          {kinds[id] === "OTHER" && <label>Descripción de muestra {index + 1}<input name={`description_${id}`} required minLength={3} maxLength={300} /></label>}
          <p>Analíticas que requieren esta muestra:</p>
          {analyses.map((a, n) => <label className="sample-analysis-link" key={a}><input type="checkbox" name={`link_${id}_${a}`} value="yes" />Muestra {index + 1} para analítica {n + 1}</label>)}
          {specimens.length > 1 && <button type="button" onClick={() => remove("specimen", id)}>Quitar muestra {index + 1}</button>}
        </fieldset>)}
        <button type="button" disabled={specimens.length >= 30} onClick={() => add("specimen")}>Añadir muestra</button>
      </OperationalWriteForm>
    </div>
  </section>;
}
