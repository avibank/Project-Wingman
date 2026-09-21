/* =============================================================================
   A LINE IN `reports` FROM A PHONE NOBODY HERE CAN HOLD.
   -----------------------------------------------------------------------------
   Straight to the real database with the publishable key, not through the
   app's client: inside the demo that client is a copy in memory, and a
   visitor's first minutes are spent in the demo, so a line sent through it
   would never arrive. `keepalive`, so a line sent just before a reload still
   lands. Never throws; a report that cannot be sent is not a second failure.
   ========================================================================= */
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function fieldReport(targetId, detail = {}) {
  if (!url || !key) return;
  try {
    const reason = JSON.stringify({
      at: new Date().toISOString(),
      page: `${window.location.pathname}${window.location.search}`,
      ua: navigator.userAgent,
      ...detail,
    }).slice(0, 12000);
    fetch(`${url}/rest/v1/reports`, {
      method: "POST",
      keepalive: true,
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ reporter_id: "anonymous", target_type: "route", target_id: targetId, reason }),
    }).catch(() => {});
  } catch { /* nothing more to do from here */ }
}
