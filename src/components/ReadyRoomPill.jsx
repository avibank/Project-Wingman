import { Radio } from "lucide-react";

// §8 — the Ready Room in the app bar, in the spot the streak pill held.
//
// THE BADGE RULE, which matters more than anything else here.
//
// The count is THINGS ADDRESSED TO YOU: unread squadron messages, and replies
// in threads you are part of. It is deliberately NOT every new thread in every
// module you are enrolled in — get that wrong and the badge is permanently lit
// within a week, everyone learns to ignore it, and the one attention mechanism
// in the app has been spent on nothing.
//
// Activity you are not part of is still shown, but as a quiet unread dot on the
// row in the sidebar: visible when you are in the room, silent when you are
// not. Two levels, deliberately.
//
// §1.4 — the badge is never colour alone. It carries a number, and the
// accessible name says what the number is.
export default function ReadyRoomPill({ count = 0, onGo }) {
  const n = Math.max(0, count | 0);
  const label = n === 0
    ? "Ready Room"
    : `Ready Room, ${n} ${n === 1 ? "thing" : "things"} for you`;

  return (
    <button type="button" className="rrpill is-inline" onClick={onGo} aria-label={label}>
      <Radio size={19} aria-hidden="true" />
      <span className="rrpill-word">Ready Room</span>
      {n > 0 && (
        // Capped at 9+ because the badge is a nudge, not a tally — past nine
        // the exact figure changes nothing about what you do next.
        <span className="rrpill-n" aria-hidden="true">{n > 9 ? "9+" : n}</span>
      )}
    </button>
  );
}
