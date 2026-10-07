/* =============================================================================
   THE TOUR — mounted. The engine is `tourEngine.js`; this is the wiring.
   -----------------------------------------------------------------------------
   REBUILT 2026-10-06 from the approved tour. What this file used to be — the
   four-panel dim, the docked card, `plan()`, `steps.js` — is gone; the engine
   that replaced it is the handoff's, and `tourSteps.js` is its script.

   WHAT DELIBERATELY DID NOT CHANGE, because rule 1 of the handoff says so:
   how the tour is opened (`?tour`, the profile menu, the replay hook), that it
   runs inside the `pw-demo` sessionStorage demo mode against a seeded class,
   and what leaving it means (`onLeave`, which App turns into the licence, the
   sign-up page or the page you came from). This component's props are the
   ones App already passed, untouched.

   IT IS NOT REACT INSIDE. The engine reads and writes the DOM directly — it
   measures an element, aims a frame at where that element WILL be once a
   smooth scroll finishes, and animates both on one clock. A React render in
   the middle of any of that would restart it. So this mounts the engine once
   and gets out of the way, and the only thing it renders is nothing.
   ========================================================================= */
import { useEffect, useRef } from "react";
import { startTour } from "./tourEngine.js";
import { TOUR_STEPS } from "./tourSteps.js";
import { setTourPane, setTourPanelTab, clearTourState } from "../lib/tourState.js";

export default function Guide({ go, warm, onLeave, hasStamp = false, guest = false }) {
  /* Every prop is read through this, including `guest` and `hasStamp`, so the
     effect below has no dependency on anything outside itself. That is not
     tidiness: a dep that changed would tear the tour down and start it again
     from the beta note, and these two arrive from App's own account state,
     which settles a moment after the first render. */
  const live = useRef({ go, warm, onLeave, guest, hasStamp });
  live.current = { go, warm, onLeave, guest, hasStamp };

  useEffect(() => {
    /* Every screen the tour visits is warmed while the beta note is being
       read, so a move between pages never waits for a lazy chunk. The old
       tour did this and it is the one piece of it worth keeping. */
    const t = setTimeout(() => {
      /* THE LESSON WAS MISSING FROM THIS LIST, and it is the heaviest screen
         the tour visits — it mounts a video. Measured on a production build:
         its two steps dropped 45 and 77 frames against 0 to 5 on the deck,
         which is the stutter under the light's fade-in on exactly the two
         steps the owner was looking at. Every other route the script names
         was here; this one never was. */
      live.current.warm?.(["/", "/m/m1", "/m/m1/library", "/m/m1/crew",
                           "/m/m1/M1.02/lesson/M1.02.2",
                           "/ready-room/m1", "/account/licence", "/account/preferences"]);
    }, 400);

    /* THE LAST BUTTON SAYS WHAT PRESSING IT WILL DO, and that depends on who
       is reading it — the one thing about this script that is not fixed. A
       visitor has no account yet, a student who has already issued a stamp has
       nothing to make, and everyone else is going to the stamp creator. The
       script keeps the third as its default; this swaps the label only, never
       the words above it. */
    const cta = live.current.guest ? "Create my account" : live.current.hasStamp ? "Done" : null;
    const steps = cta
      ? TOUR_STEPS.map((s, n) => (n === TOUR_STEPS.length - 1 ? { ...s, cta } : s))
      : TOUR_STEPS;

    const tour = startTour({
      steps,
      /* `go(to, { still: true })` is the app's own navigation without its
         view transition: the engine runs the page change itself, fading its
         frame around it, and two transitions on one move fight. */
      /* IT RESOLVES WHEN THE PAGE HAS FINISHED MOVING, not two frames later.
         Two frames is enough for React to commit and nowhere near enough for
         the app's own Mission Control transition to run, so the engine was
         measuring a page that was still travelling and framing a target that
         had not arrived. There is one page transition — the app's — and this
         waits for it rather than adding a second fade of the tour's own. */
      navigate: async (route) => {
        live.current.go?.(route);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        /* THE ONES THAT CAN FINISH, AND ONLY THOSE. `getAnimations` hands back
           the ambient lighting too — Deck.jsx drifts three light layers on
           `infinite` keyframes — and an infinite animation's `finished` never
           resolves. So this race was decided by its own timeout EVERY time,
           and every page change in the tour sat dark for the full 700ms with
           the light already faded out: measured at 1038ms from the press to
           the new light appearing, against a real view transition of about
           350ms. That dead second is what "not seamless" is made of.

           A finite animation is still waited for, because placing the light
           while the screen it points at is still sliding is the thing this
           wait exists to prevent. The timeout stays as a backstop. */
        const pageEl = document.querySelector(".deck, .rr-app");
        if (pageEl?.getAnimations) {
          const finite = pageEl.getAnimations({ subtree: true }).filter((a) => {
            try { return a.effect?.getTiming?.().iterations !== Infinity; } catch { return false; }
          });
          if (finite.length) {
            await Promise.race([
              Promise.all(finite.map((a) => a.finished.catch(() => {}))),
              new Promise((r) => { setTimeout(r, 700); }),
            ]);
          }
        }
        try { await document.fonts?.ready; } catch { /* no font API */ }
        /* and two frames where it has stopped moving */
        await new Promise((r) => {
          let last = "", same = 0;
          const tick = () => {
            const el = document.querySelector(".deck, .rr-app");
            const b = el ? el.getBoundingClientRect() : { top: 0, height: 0 };
            const k = `${b.top}|${b.height}`;
            same = k === last ? same + 1 : 0;
            last = k;
            if (same >= 2) r(); else requestAnimationFrame(tick);
          };
          tick();
        });
      },
      currentRoute: () => window.location.pathname,
      setPane: (pane) => setTourPane(pane),
      setPanelTab: (tab) => setTourPanelTab(tab),
      onCta: () => live.current.onLeave?.("finish"),
      /* "UNMOUNT" IS NOT "SKIP", AND CONFLATING THEM IS AN INFINITE LOOP.
         React runs an effect, its cleanup and the effect again on every mount
         in development, so the cleanup below fires once before the tour has
         been on screen for a frame. Reading that as the student leaving sent
         `onLeave("skip")` to App, which left the demo and reloaded back onto
         the `?tour` address it came from — which entered the demo again. 44
         document loads in five seconds, measured, with no error in the console
         to say why. So the engine's close carries its reason and only a real
         Skip is passed on. */
      onClose: (reason) => { if (reason === "skip") live.current.onLeave?.("skip"); },
    });

    return () => { clearTimeout(t); tour.close("unmount"); clearTourState(); };
  }, []);

  return null;
}
