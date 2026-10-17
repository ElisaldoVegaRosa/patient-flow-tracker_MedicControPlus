import { useMemo, useState } from "react";
import { patientMatcher } from "../presentation/patientSearch";

export function usePatientSearch() {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => patientMatcher(query), [query]);
  return { query, setQuery, matches };
}
