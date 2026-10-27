"""Bounded, read-only staff audit queries; planning permissions are unchanged."""
from datetime import datetime, time, timedelta, timezone


def history_page(connection, now, *, recent=True, page=1, page_size=50,
                 start_date=None, end_date=None, shift_id=None, professional_id=None, action=None):
    clauses, values = [], []
    if recent:
        clauses.append("julianday(c.created_at)>=julianday(?)")
        values.append((datetime.fromisoformat(now) - timedelta(days=7)).isoformat())
    # Exclude future-dated records, using the same server clock for the whole read.
    clauses.append("julianday(c.created_at)<=julianday(?)")
    values.append(now)
    zone = timezone(timedelta(hours=-4))
    if start_date:
        clauses.append("julianday(c.created_at)>=julianday(?)")
        values.append(datetime.combine(start_date, time(), zone).isoformat())
    if end_date:
        clauses.append("julianday(c.created_at)<julianday(?)")
        values.append(datetime.combine(end_date + timedelta(days=1), time(), zone).isoformat())
    if shift_id:
        clauses.append("((c.resource='shift' AND c.target_id=?) OR (c.resource='assignment' AND d.shift_id=?))")
        values.extend([shift_id, shift_id])
    if professional_id:
        clauses.append("c.resource='assignment' AND d.user_id=?")
        values.append(professional_id)
    if action:
        clauses.append("c.action=?")
        values.append(action)
    source = "FROM staff_changes c LEFT JOIN staff_assignments d ON c.resource='assignment' AND d.id=c.target_id WHERE " + " AND ".join(clauses)
    total = connection.execute("SELECT COUNT(*) " + source, values).fetchone()[0]
    rows = connection.execute("SELECT c.* " + source + " ORDER BY julianday(c.created_at) DESC,c.id DESC LIMIT ? OFFSET ?",
                              [*values, page_size, (page - 1) * page_size]).fetchall()
    return {"changes": [dict(row) for row in rows], "total": total, "page": page, "page_size": page_size,
            "has_more": page * page_size < total}
