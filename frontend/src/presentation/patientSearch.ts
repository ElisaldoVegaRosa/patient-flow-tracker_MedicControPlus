function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es").trim().replace(/\s+/g, " ");
}

/** A numeric query identifies one episode; name words may appear in any order. */
export function patientMatcher(query: string): (name: string, episodeId: number) => boolean {
  const normalized = normalize(query);
  const episode = normalized.match(/^(?:ep\s*-?\s*)?(\d+)$/);
  if (episode) {
    const id = episode[1].replace(/^0+(?=\d)/, "");
    return (_name, episodeId) => String(episodeId) === id;
  }
  const words = normalized.split(" ").filter(Boolean);
  return (name) => {
    const candidate = normalize(name);
    return words.every(word => candidate.includes(word));
  };
}
