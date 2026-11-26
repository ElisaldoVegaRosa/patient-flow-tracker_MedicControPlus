import PatientClinicalRecord from "./PatientClinicalRecord";
import type { ClinicalRecordDefinition, ClinicalRecordProps } from "./PatientClinicalRecord";
const medical: ClinicalRecordDefinition = {
  name: "antecedentes médicos", title: "Enfermedades relevantes", suffix: "background/MEDICAL", category: "MEDICAL", prefix: "background",
  labels: { UNKNOWN: "Sin información de enfermedades relevantes", NONE_REPORTED: "No refiere enfermedades relevantes", REPORTED: "Enfermedades relevantes registradas" },
  noReviewMessage: "Sin una revisión registrada no se interpreta ausencia de enfermedades relevantes.",
  descriptionLabel: "Descripción de enfermedades relevantes",
  descriptionHint: "Describe los antecedentes registrados. Para sin información o no refiere, deja la descripción vacía; lo anterior permanece en el historial.",
};
const surgical: ClinicalRecordDefinition = {
  name: "antecedentes quirúrgicos", title: "Cirugías previas", suffix: "background/SURGICAL", category: "SURGICAL", prefix: "background",
  labels: { UNKNOWN: "Sin información de cirugías previas", NONE_REPORTED: "No refiere cirugías previas", REPORTED: "Cirugías previas registradas" },
  noReviewMessage: "Sin una revisión registrada no se interpreta ausencia de cirugías previas.",
  descriptionLabel: "Descripción de cirugías previas",
  descriptionHint: "Describe las cirugías registradas. Para sin información o no refiere, deja la descripción vacía; lo anterior permanece en el historial.",
};
export default function PatientBackgrounds(props: ClinicalRecordProps) {
  if (!["DOCTOR", "NURSE"].includes(props.user.role)) return null;
  return <section aria-label="Antecedentes relevantes"><PatientClinicalRecord {...props} definition={medical} /><PatientClinicalRecord {...props} definition={surgical} /></section>;
}
