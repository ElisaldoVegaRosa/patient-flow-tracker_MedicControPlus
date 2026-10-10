import type { SessionUser } from "../types/clinical";

export const RECOVERY_DURATION_MS = 30 * 60 * 1000;

type Note = { username: string; episodeId: number; text: string };
type PendingNote = Note & { interruptedAt: number };

// Owned by a mounted App instance; no browser or server persistence.
export class DischargeDraftRecovery {
  private current: Note | null = null;
  private pending: PendingNote | null = null;
  version = 0;

  track(username: string, episodeId: number, text: string) {
    this.current = text.trim() ? { username, episodeId, text } : null;
  }

  suspend() {
    if (!this.pending && this.current) {
      this.pending = { ...this.current, interruptedAt: Date.now() };
      this.version += 1;
    }
    this.current = null;
  }

  remainingMs() {
    if (!this.pending) return 0;
    const elapsed = Date.now() - this.pending.interruptedAt;
    return elapsed < 0 ? 0 : Math.max(0, RECOVERY_DURATION_MS - elapsed);
  }

  forUser(user: SessionUser) {
    if (!this.pending) return null;
    if (!this.remainingMs() || user.role !== "DOCTOR" || user.username !== this.pending.username) {
      this.clear();
      return null;
    }
    return { episodeId: this.pending.episodeId, version: this.version };
  }

  take(user: SessionUser) {
    if (!this.forUser(user)) return null;
    const note = this.pending!;
    this.clear();
    return note.text;
  }

  clear() {
    this.current = null;
    this.pending = null;
    this.version += 1;
  }
}
