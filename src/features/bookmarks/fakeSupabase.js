/* A stand-in for the Supabase client with the few calls the saves store makes.
   Lets the harness prove: instant save, server failure → revert + message, offline → message, Undo. */
export function makeFakeSupabase(seed = []) {
  const db = { rows: seed.map((r) => ({ ...r })), failNext: 0, latency: 350 };
  const later = (v) => new Promise((r) => setTimeout(() => r(v), db.latency));
  const fail = () => { if (db.failNext > 0) { db.failNext--; return true; } return false; };
  const from = () => {
    const q = { _f: [], _order: null };
    const api = {
      select() { return api; },
      eq(col, v) { q._f.push((r) => r[col] === v); return api; },
      in(col, vs) { q._f.push((r) => vs.includes(r[col])); return api; },
      order(col, { ascending }) { q._order = (a, b) => (ascending ? 1 : -1) * (a[col] < b[col] ? -1 : 1); return api; },
      then(res, rej) { const data = db.rows.filter((r) => q._f.every((f) => f(r))); if (q._order) data.sort(q._order); return later({ data, error: null }).then(res, rej); },
      upsert(row) {
        return { select: () => ({ single: () => { if (fail()) return later({ data: null, error: { message: 'forced failure' } });
          const k = (r) => [r.user_id, r.kind, r.ref_id, r.page ?? ''].join('|');
          const i = db.rows.findIndex((r) => k(r) === k(row)); const saved = { ...row, id: i >= 0 ? db.rows[i].id : row.id };
          if (i >= 0) db.rows[i] = saved; else db.rows.unshift(saved); return later({ data: saved, error: null }); } }) };
      },
      delete() {
        const d = { _f: [] };
        const del = {
          eq(col, v) { d._f.push((r) => r[col] === v); return del; },
          in(col, vs) { d._f.push((r) => vs.includes(r[col])); return del; },
          then(res, rej) { if (fail()) return later({ error: { message: 'forced failure' } }).then(res, rej); db.rows = db.rows.filter((r) => !d._f.every((f) => f(r))); return later({ error: null }).then(res, rej); },
        };
        return del;
      },
    };
    return api;
  };
  return { client: { from }, db };
}
