/* =============================================================================
   THE PORTED PANEL — the demo's card, its tab strip and its search field.
   -----------------------------------------------------------------------------
   §2 of the handoff: the module screen's tabs become "Lessons and Library
   only, plus the search field stretching to the end of the strip", and the
   Crew tab goes — "who's on this module now lives only as the quiz attempt
   stamps on each batch row".

   THIS IS A BRANCH, NOT A REPLACEMENT, and that is deliberate. `ModuleScreen`
   renders this when `library.batches` is on and its own `.mtabs` strip when it
   is not. The app's strip carries things this one does not — the travelling
   `.tab-pill` that `check:transitions` holds, the Crew count badge — and
   rewriting it in place would have changed the screen students are on today
   for the sake of one that is still behind a flag. The two live side by side
   until the flag goes to everyone, and then the old branch comes out.

   `wm-port` IS NOT HERE. It is on `ModuleScreen`'s own `.wm-port > .wrap`,
   two elements up, because the ported screen has to stand OUTSIDE the app's
   `.mscreen` and `.ref-mod` scopes rather than inside them — those two style
   twenty-four of the same bare words the demo does, and a descendant of either
   loses every property the demo does not also declare. `check:port` measures
   that; the comment is only the reason.

   THE ARROW KEYS AND THE ROVING tabIndex ARE THE APP'S. The demo binds a click
   handler and nothing else; a two-tab `role="tablist"` whose unselected tab is
   out of the tab order is unreachable by keyboard without them, and this strip
   is the only way into the Library. Mirrors `walkTabs` in ModuleScreen and
   `Profile.jsx` so every tablist in the app behaves the same.
   ========================================================================= */
import { useRef } from "react";

export const PORT_TABS = [
  { id: "route", label: "Lessons" },
  { id: "library", label: "Library" },
];

export default function PortPanel({
  mod, tab, onTab, query = "", onQuery, children,
}) {
  const tabsRef = useRef(null);
  const walk = (e) => {
    const btns = [...(tabsRef.current?.querySelectorAll('[role="tab"]') || [])];
    const i = btns.indexOf(document.activeElement);
    if (i < 0 || !btns.length) return;
    const move = (n) => { e.preventDefault(); btns[n]?.focus(); onTab(PORT_TABS[n].id); };
    if (e.key === "ArrowRight") move((i + 1) % btns.length);
    if (e.key === "ArrowLeft") move((i - 1 + btns.length) % btns.length);
    if (e.key === "Home") move(0);
    if (e.key === "End") move(btns.length - 1);
  };

  /* The demo swaps the placeholder with the tab, so the field says what it
     will search before anybody types in it. */
  const hint = tab === "route" ? "Search lessons" : "Search topics, ATA or page";

  return (
    <section className="card" data-ref="module-panel" aria-label={mod?.name}>
        <div className="tabs" role="tablist" aria-label={`${mod?.name || "Module"} sections`}
             ref={tabsRef} onKeyDown={walk}>
          {PORT_TABS.map((t) => (
            <button key={t.id} type="button" role="tab" className="tab"
                    aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1}
                    onClick={() => onTab(t.id)}>
              {t.label}
            </button>
          ))}
          {/* `is-inline` keeps §12's 44px floor off the INPUT: the thing a
              finger aims at is the pill around it, which is the full width of
              what the tabs leave. With the floor on, the demo's 56px strip
              came out at 77. The port's own reset undoes the floor inside
              here anyway; this keeps it off in both. */}
          <label className="search">
            <span aria-hidden="true">⌕</span>
            <input type="search" className="is-inline" value={query}
                   placeholder={hint} aria-label={hint}
                   onChange={(e) => onQuery?.(e.target.value)}
                   onKeyDown={(e) => {
                     if (e.key === "Escape" && query) { e.preventDefault(); onQuery?.(""); }
                   }} />
          </label>
        </div>
      {children}
    </section>
  );
}
