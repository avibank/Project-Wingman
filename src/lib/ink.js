/* =============================================================================
   Reading and writing ink.
   -----------------------------------------------------------------------------
   Every read goes through paper_ink_for, for the same reason marks do: Fly solo
   is symmetric, blocks cut both ways, and there is exactly one opinion in this
   codebase about what a ring means. A raw select here would be a second one.

   Strokes are THINNED before they are sent. A stroke sampled at pointer rate is
   a few hundred points for a line drawn in a second; the ones that carry no
   shape are dropped in the browser rather than stored, sent, and re-parsed on
   every open forever.
   ========================================================================= */

import { supabase } from "./supabaseClient.js";
import { thin } from "./paperInk.js";

const fail = (e, f) => { if (e) console.error(e); return f; };

/* See the note on rpcFirst in annotations.js: between the deploy that starts
   calling these and the migration that creates them, PGRST202 is expected and
   the direct write is still the live one. After 0021 the fallback cannot
   succeed, and it goes. */
const MISSING_FUNCTION = "PGRST202";
async function rpcFirst(name, args, legacy) {
  const { data, error } = await supabase.rpc(name, args);
  if (!error) return { data, ok: true };
  if (error.code !== MISSING_FUNCTION) return { data: null, ok: false, error };
  return legacy();
}

export async function fetchInk(me, paperId) {
  if (!me || !paperId) return [];
  const { data, error } = await supabase.rpc("paper_ink_for", { uid: me, p_paper: paperId });
  if (error) return fail(error, []);
  return data || [];
}

export async function createStroke({
  paperId, moduleCode, me, page, tool = "pen", colour = "graphite",
  width = 0.0032, ring = "solo", points = [], id = null,
}) {
  if (!me || !paperId || !page || !points.length) return null;
  // Rounded to four places on the way out: that is a fifth of a pixel on a
  // 2000px-wide render, which nobody can see, and it halves the JSON.
  const pts = thin(points).map(([x, y]) => [Number(x.toFixed(4)), Number(y.toFixed(4))]);
  const { data, ok, error } = await rpcFirst("paper_ink_add", {
    uid: me, p_paper: paperId, p_module: moduleCode, p_page: page,
    p_points: pts, p_tool: tool, p_colour: colour, p_width: width, p_ring: ring,
    /* Named on the way in when the caller has one, so a stroke that was undone
       and redone is the SAME stroke to everyone else rather than a new one
       beside the hole the first left. Left out, redo is a second stroke. */
    p_id: id || null,
  }, async () => {
    const r = await supabase.from("paper_ink").insert({
      ...(id ? { id } : {}),
      paper_id: paperId, module_code: moduleCode, author_id: me,
      page, tool, colour, width, ring, points: pts,
    }).select().single();
    return { data: r.data, ok: !r.error, error: r.error };
  });
  if (!ok) return fail(error, null);
  return data;
}

/* Plural because the eraser hits whatever it touches, and one round trip beats
   six. It used to say the caller had to check ownership "because the server has
   no session to check against"; after 0021 the server deletes `where author_id
   = uid`, so an eraser cannot reach across accounts however the ids were come
   by. */
export async function deleteStrokes(ids = [], me = null) {
  const list = ids.filter(Boolean);
  if (!list.length) return true;
  const { ok, error } = await rpcFirst("paper_ink_delete", {
    uid: me, p_ids: list,
  }, async () => {
    const r = await supabase.from("paper_ink").delete().in("id", list);
    return { data: !r.error, ok: !r.error, error: r.error };
  });
  return !fail(error, false) && ok;
}
