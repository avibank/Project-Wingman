/* =============================================================================
   THE FACE, EVERYWHERE IT APPEARS. One component.
   -----------------------------------------------------------------------------
   The licence card, the app bar, the lesson composer, Crew, the Ready Room and
   every roster draw this. Before it there were four: three that read Clerk's
   `user.imageUrl` (which is never null, so they always drew Clerk's grey
   generated glyph) and one that drew initials on a hue derived from the
   person's NAME — so the same student had a different colour on the licence
   they chose it on and on the wall everybody else saw.

   What a face IS lives in src/lib/avatar.js. This puts it on the page.

   `loading` is a real state and not a blank circle: a face is the last thing
   to arrive on most of these screens, and an empty ring reads as "this person
   has nothing" rather than "this has not come back yet".
   ========================================================================= */
import { faceOf } from "../lib/avatar.js";
import "./avatar.css";

export default function Avatar({
  profile, name, size = 40, loading = false, className = "", title, onClick, label,
}) {
  const f = faceOf(profile, { name });
  const box = { width: size, height: size, fontSize: Math.round(size * 0.36) };

  if (loading) {
    return <span className={`av2 is-loading ${className}`} style={box} aria-hidden="true" />;
  }

  const inner = f.photo ? (
    <img className="av2-img" src={f.photo} alt=""
         style={{ "--z": f.zoom / 100, "--x": `${f.x}%`, "--y": `${f.y}%` }} />
  ) : f.initials;

  const style = { ...box, ...(f.photo ? null : { background: f.fill, color: f.ink }) };
  const cls = `av2${f.photo ? " has-photo" : ""} ${className}`;

  if (onClick) {
    return (
      <button type="button" className={cls} style={style} title={title}
              aria-label={label || title} onClick={onClick}>
        {inner}
      </button>
    );
  }
  return (
    <span className={cls} style={style} title={title}
          role={label ? "img" : undefined} aria-label={label}
          aria-hidden={label ? undefined : "true"}>
      {inner}
    </span>
  );
}
