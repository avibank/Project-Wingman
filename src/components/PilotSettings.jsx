
/* WHAT IS LEFT OF THIS PANEL, AND WHAT §6 TOOK OFF IT.

   It used to be the whole of a Settings page and then three settings with no
   other door. §6 deletes two of them outright and turns the third from a
   choice into a statement:

   · "When you usually study" is gone. It is asked once at signup, where it
     does its only real work — assign_squadron matches on it — and a chip row
     in Preferences invited people to change a thing whose only effect was
     already behind them. The value is still set and still read; there is no
     longer a second place to set it. See docs/launch/BACKLOG.md.
   · "Study glow" is gone, and so is the glow: a chapter no longer warms
     because somebody else is reading it. The toggle went with the feature
     rather than before it, which is the order that leaves nothing stranded.
   · NOTIFICATIONS ARE A FIXED LIST. Three chips offering "replies and your
     teams", "that plus every chapter you opened", or "nothing" made the
     middle one a trap — every chapter you have ever opened is a notification
     a week — and the third a setting that silently turns off the only three
     things this app ever sends. What it sends is short, and it is all things
     a person actually did, so it is stated instead of chosen. §11 still
     holds: never a streak warning, a countdown, or a nudge to come back.

   The blocked list that sat beside them is on the Preferences tab itself, in
   How social, which is where it belongs and where it already is. */

/* Everything this app will ever send you. Not a choice; a promise. */
const NOTICES = [
  "A reply to something you wrote",
  "An answer to a question you asked",
  "Your squadron, when somebody speaks",
  "Somebody taking the right seat beside you",
];

function PilotSettings() {
  /* NO STATE, NO FETCH, NO LOADING. Everything this panel used to read from
     pilot_profiles has gone — the study time to signup, the glow with the
     feature, and the notification mode into a sentence — so what is left is a
     statement of what the app sends. A spinner in front of a fixed list is a
     spinner in front of nothing. */
  return (
    <section className="ps2">
      <h2 className="ps2-head">Your pilot</h2>

      <div className="ps2-block">
        <p className="ps2-row-label">What you&rsquo;ll hear about</p>
        <ul className="ps2-nlist">
          {NOTICES.map((n) => <li key={n}>{n}</li>)}
        </ul>
        {/* §11 — never a streak warning, a countdown, or a nudge to come back. */}
        <p className="ps2-note">Only things a person actually did. Never a streak warning or a nudge to come back.</p>
      </div>

      <style>{`
        .ps2 { margin: 28px 0 0; }
        .ps2-head { font-family: var(--font-ui); font-size: 17px; font-weight: 500;
          color: var(--text-1); margin: 0 0 12px; }
        .ps2-block { margin-bottom: 20px; }
        .ps2-row-label { display: block; font-size: 16px; color: var(--text-1); margin: 0 0 8px; }
        .ps2-row-hint { display: block; font-size: 14px; line-height: 1.45; color: var(--text-2); max-width: 46ch; }
        .ps2-note { font-size: 14px; color: var(--text-2); margin: 8px 0 0; }
        /* The reference's .nlist: a dot, then the thing. Not chips — there is
           nothing to choose. */
        .ps2-nlist { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .ps2-nlist li { display: flex; align-items: center; gap: 10px; font-size: 14.5px; color: var(--text-1); }
        .ps2-nlist li::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--active); flex: none; }

        .ps2-callsign { display: flex; gap: 8px; }
        .ps2-input { flex: 1; min-height: 44px; padding: 0 12px; border: none; border-radius: 12px;
          background: var(--surface-2); color: var(--text-1); font-family: var(--font-ui); font-size: 16px; }
        .ps2-input:focus { outline: 2px solid var(--warm); outline-offset: -1px; }
      `}</style>
    </section>
  );
}

export default PilotSettings;
