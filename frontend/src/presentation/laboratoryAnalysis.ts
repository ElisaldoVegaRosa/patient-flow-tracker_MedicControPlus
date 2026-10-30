import type { LaboratoryAnalysisDetail, LaboratorySummary } from "../types/clinical";

export function laboratoryAnalysis(item: LaboratoryAnalysisDetail, reinstatementRequiresPlan = false): LaboratorySummary["analyses"][number] {
  const latest = item.versions.at(-1);
  return {
    reinstatement_requires_plan: reinstatementRequiresPlan,
    id: item.id, title: item.title, version: item.version,
    cancelled_at: item.cancelled_at, cancellation_reason: item.cancellation_reason,
    has_result: item.has_published_result, current_result: latest?.result ?? null,
    result_annulled: latest?.action === "ANNUL", result_sequence: latest?.sequence ?? null,
    needs_medical_review: item.needs_medical_review, reviewed_at: latest?.review?.reviewed_at ?? null,
    satisfies_current_samples: item.satisfies_current_samples,
    reviewer_username: item.medical_owner?.role === "DOCTOR" && item.medical_owner.active === 1 ? item.medical_owner.username : null,
    required_specimens: item.required_specimens,
    versions: item.versions.map(value => ({ id: value.id, sequence: value.sequence, action: value.action,
      result: value.result, reason: value.reason, published_at: value.published_at, reviewed_at: value.review?.reviewed_at ?? null })),
  };
}
