import { useLayoutEffect, useRef, useState } from "react";
import { Router, UNSAFE_createBrowserHistory as createBrowserHistory } from "react-router";

/* =============================================================================
   THE ROUTER, WITH ITS TWO DECISIONS MADE ON PURPOSE.

   This is react-router's own BrowserRouter — the same history, the same
   <Router>, the same twenty lines — with two things changed, and both are
   about the transition layer rather than about routing.

   1 · A LOCATION CHANGE COMMITS WHEN IT IS APPLIED. react-router 7 wraps every
       update in React.startTransition unless told not to. The transition layer
       navigates inside document.startViewTransition's callback with flushSync
       so that the browser photographs the NEW screen as its after-frame — and
       flushSync cannot hurry a transition update, so it committed nothing.
       Measured at the end of that callback: the address read /m/m1 while the
       page still held the Flight Deck. The old screen receded and the new one
       simply appeared afterwards, which is the "pops in after a freeze" on
       opening a module, and the same fault sat under every navigation that
       seemed to cut.

   2 · BACK AND FORWARD GO THROUGH THE SAME PATH AS A CLICK. BrowserRouter
       applies a popstate straight to its state, so the browser's own buttons
       and a swipe back never animated at all. Here a POP is handed to the app
       first (popHandler), which runs it inside a view transition exactly as it
       runs a click, and applies it plainly when nothing is registered.

   The popstate event itself is read by a listener added at import, which is
   before the history library adds its own on mount — so by the time the
   history reports a POP, the event that caused it is known, and a swipe the
   browser has already animated (hasUAVisualTransition) is not animated twice.
   ========================================================================= */

let lastPop = null;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", (e) => { lastPop = e; });
}

/* The app registers what a Back or a Forward should do. Null until it does. */
export const popHandler = { current: null };

export default function TransitionRouter({ children }) {
  const historyRef = useRef(null);
  if (historyRef.current == null) {
    historyRef.current = createBrowserHistory({ v5Compat: true });
  }
  const history = historyRef.current;
  const [state, setState] = useState({ action: history.action, location: history.location });

  useLayoutEffect(() => history.listen(({ action, location }) => {
    const apply = () => setState({ action, location });
    const handler = popHandler.current;
    if (action === "POP" && handler) {
      const uaAnimated = Boolean(lastPop?.hasUAVisualTransition);
      lastPop = null;
      handler(location, apply, { uaAnimated });
    } else {
      apply();
    }
  }), [history]);

  return (
    <Router location={state.location} navigationType={state.action} navigator={history}>
      {children}
    </Router>
  );
}
