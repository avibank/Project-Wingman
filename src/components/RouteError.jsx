import { Component } from "react";

// The ROUTE-level boundary. There is already a top-level one in
// src/ErrorBoundary.jsx, mounted in main.jsx, and it stays: it deliberately
// hardcodes its colours so it survives the token layer itself failing, and it
// prints a stack because by then the stack is the only useful thing left.
//
// This one sits lower, inside Suspense, and is the difference between losing a
// page and losing the app. It can be dismissed without a reload, it is built
// from tokens because the app is still standing, and it shows a name rather
// than a stack — a student is not the person who will read one.
//
// What it says is deliberately in that order: what went wrong, what to do, a
// way out. Not an apology, and not a stack trace, which helps nobody who is
// not the person who wrote it.
const RTERR_CSS = `
.rterr { display: grid; gap: 14px; padding-top: 40px; max-width: 56ch; }
.rterr-h { font-size: var(--fs-xl, 27px); font-weight: 700; letter-spacing: -.5px; margin: 0; }
.rterr-p { font-size: var(--fs-md, 17px); color: var(--t2); line-height: 1.6; margin: 0; }
.rterr-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 6px; }
.rterr-go, .rterr-alt { font-family: inherit; font-size: var(--fs-base, 16px); font-weight: 600;
  border-radius: 999px; padding: 13px 24px; cursor: pointer; min-height: var(--tap, 44px); border: 0; }
.rterr-go { background: var(--active); color: var(--ground); }
.rterr-alt { background: none; color: var(--t2); border: 1px solid var(--line); }
.rterr-tech { font-family: var(--font-mono); font-size: var(--fs-xs, 13px); color: var(--t3);
  margin: 10px 0 0; overflow-wrap: anywhere; }
`;

export default class RouteError extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Kept for the report control below; the console is where it is useful
    // during development and the report is where it is useful afterwards.
    this.lastInfo = info;
    console.error("Caught by the boundary:", error, info?.componentStack);
    this.props.onError?.(error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="content content-taxi rterr" role="alert">
        <h1 className="errb-h">This page stopped working.</h1>
        <p className="errb-p">
          Nothing you did caused it and nothing you have saved is affected.
          Reloading usually clears it.
        </p>
        <div className="errb-row">
          <button type="button" className="errb-go"
                  onClick={() => this.setState({ error: null })}>
            Try again
          </button>
          <button type="button" className="errb-alt" onClick={() => window.location.reload()}>
            Reload the page
          </button>
        </div>
        {/* The name only. A stack on screen helps nobody who did not write
            it, and the report carries the detail. */}
        <p className="errb-tech">{error.name}: {error.message}</p>
        <style>{RTERR_CSS}</style>
      </main>
    );
  }
}
