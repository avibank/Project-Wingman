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
  const { data, error } = await supabase.from("paper_ink").insert({
    /* Named on the way in when the caller has one, so a stroke that was undone
       and redone is the SAME stroke to everyone else rather than a new one
       beside the hole the first left. Left out, redo is a second stroke. */
    ...(id ? { id } : {}),
    paper_id: paperId, module_code: moduleCode, author_id: me,
    page, tool, colour, width, ring,
    // Rounded to four places on the way out: that is a fifth of a pixel on a
    // 2000px-wide render, which nobody can see, and it halves the JSON.
    points: thin(points).map(([x, y]) => [Number(x.toFixed(4)), Number(y.toFixed(4))]),
  }).select().single();
  if (error) return fail(error, null);
  return data;
}

/* Only ever called for strokes this account drew — the caller checks, because
   the server has no session to check against. Plural because the eraser hits
   whatever it touches, and one round trip beats six. */
export async function deleteStrokes(ids = []) {
  const list = ids.filter(Boolean);
  if (!list.length) return true;
  const { error } = await supabase.from("paper_ink").delete().in("id", list);
  return !fail(error, false) && !error;
}
