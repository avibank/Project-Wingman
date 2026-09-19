/* HOW BOOKMARKS NAVIGATES, and it is the app's way rather than the router's.
 *
 * The pack was written against a route table with <Link> and useNavigate().
 * This app has neither: src/lib/routes.js is a pure parser, App.jsx switches on
 * the route name, and EVERY navigation goes through go() — which decides what
 * kind of move it is, warms the chunk, names the layers and runs the view
 * transition. CLAUDE.md is explicit that a control calling navigate() directly
 * skips all of that; the quiz row and the chapter tabs both did, and both read
 * as the app refreshing rather than moving.
 *
 * So App.jsx hands go() in here once, and these two are what the screens use.
 * BmLink is a real <a href>, so the middle click, the cmd-click and the status
 * bar all still work — it only takes over the plain left click.
 */
let go = null;

export function provideNav(fn) { go = typeof fn === "function" ? fn : null; }

/** The app's navigate. Returns a no-op before App has mounted, never a crash. */
export const useGo = () => (to, opts) => { if (to) go?.(to, opts); };

export function BmLink({ to, children, ...rest }) {
  return (
    <a
      href={to}
      onClick={(e) => {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        go?.(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
