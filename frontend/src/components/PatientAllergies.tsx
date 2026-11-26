import PatientClinicalRecord from "./PatientClinicalRecord";
import type { ClinicalRecordDefinition, ClinicalRecordProps } from "./PatientClinicalRecord";
const definition: ClinicalRecordDefinition = {
  name: "alergias", title: "Alergias del paciente", suffix: "allergies", prefix: "allergy",
  labels: { UNKNOWN: "Sin información de alergias", NONE_KNOWN: "Sin alergias conocidas", REPORTED: "Alergias registradas" },
  noReviewMessage: "No hay una revisión registrada. No se ha marcado al paciente como libre de alergias.",
  reviewNote: "La revisión de este registro no significa confirmación de una alergia mediante pruebas.",
  descriptionLabel: "Alergias y reacciones informadas",
  descriptionHint: "Describe las alergias si eliges “Alergias registradas”. Para los otros estados, deja la descripción vacía; el texto anterior permanece en el historial.",
};
export default function PatientAllergies(props: ClinicalRecordProps) {
  return <PatientClinicalRecord {...props} definition={definition} />;
}
