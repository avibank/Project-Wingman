// §7.8 grouping rules, kept free of any client import so they can be checked
// on their own: consecutive messages from one sender become a single block,
// and a new day always opens a divider and breaks the block.

// Consecutive messages from one sender group into a single block, and a new
// day opens a divider. Pure, so the grouping rules are checkable on their own.
export const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function groupMessages(messages = []) {
  const out = [];
  let lastDay = null;
  for (const m of messages) {
    const at = new Date(m.created_at);
    const day = at.toDateString();
    if (day !== lastDay) {
      out.push({ type: "day", id: `d-${day}`, at: m.created_at });
      lastDay = day;
    }
    const prev = out[out.length - 1];
    const sameSender =
      prev?.type === "group" &&
      prev.user_id === m.user_id &&
      at - new Date(prev.messages[prev.messages.length - 1].created_at) < GROUP_WINDOW_MS;
    if (sameSender) prev.messages.push(m);
    else out.push({ type: "group", id: `g-${m.id}`, user_id: m.user_id, at: m.created_at, messages: [m] });
  }
  return out;
}
