import type { RefObject } from "react";
import { getSessionRevision } from "../api/client";
import { useEpisodePresence } from "../hooks/useEpisodePresence";
import type { SessionUser } from "../types/clinical";

export default function EpisodePresence({ episodeId, user, root, isEditing }: {
  episodeId: number; user: SessionUser; root: RefObject<HTMLElement | null>; isEditing: () => boolean;
}) {
  const presence = useEpisodePresence({ context: `${getSessionRevision()}:${user.username}:${user.role}:${episodeId}`, episodeId, root, isEditing });
  return <section className="panel" aria-label="Presencia en el episodio">
    <h2>Otras sesiones en este episodio</h2>
    <p>La presencia orienta la coordinación. Los cambios se comprueban por versión al guardar; este aviso no reserva el episodio.</p>
    {presence.error && <p role="status">{presence.error}</p>}
    {!presence.data && !presence.error && <p role="status">Consultando presencia…</p>}
    {presence.data && <>
      {!presence.data.active ? <p>Episodio cerrado: la presencia ya no se renueva.</p> : <>
        {!presence.data.members.length && !presence.error && <p>No se detectaron otras sesiones o pestañas en la última actualización.</p>}
        {presence.data.members.map(member => <p key={`${member.username}:${member.role}`}>
          {member.username === user.username ? `${member.username} (tu usuario en otra pestaña o sesión)` : member.username} · {member.role} · {member.tabs} {member.tabs === 1 ? "pestaña" : "pestañas"} en {member.sessions} {member.sessions === 1 ? "sesión" : "sesiones"} · {member.editing_tabs ? `${member.editing_tabs} con cambios sin guardar` : "Consultando"}
        </p>)}
      </>}
    </>}
    <p>Renovación cada 15 segundos mientras la pestaña esté visible. La presencia caduca tras 45 segundos sin renovación.{presence.updated ? ` Última actualización: ${new Date(presence.updated).toLocaleTimeString()}.` : ""}</p>
  </section>;
}
