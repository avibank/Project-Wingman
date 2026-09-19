/* =============================================================================
   THE LICENCE CARD. ONE COMPONENT, TWO MODES.
   -----------------------------------------------------------------------------
   §5: "The first box on the Licence tab IS the licence card. It's the same
   component other people see when they tap your face; the owner just sees it
   in edit mode." So there is one of these, and `edit` is the only difference —
   not a second component that looks similar and drifts.

   THE CARD KEEPS ITS OWNER'S COLOURS. The cover, the initials circle and the
   phrase are tinted from the ink THEY chose, handed down as inline custom
   properties, so opening somebody's card in your own livery shows you their
   card rather than a recolour of it. The panel, the greys and the rules stay
   the viewer's, because those are the app around the card.

   WHAT IS NOT DECIDED HERE: what a cover looks like (src/lib/cover.js), what a
   stamp looks like (src/lib/stamp.js and <Stamp/>), and where the numbers come
   from (src/lib/licence.js). This file arranges them.
   ========================================================================= */
import { useMemo } from "react";
import { Camera, Image as ImageIcon, ShieldCheck } from "lucide-react";
import { COVERS, coverGradient, coverOf } from "../../lib/cover.js";
import Stamp from "../Stamp.jsx";
import Avatar from "../Avatar.jsx";
import { stampOf, DEFAULT_STAMP } from "../../lib/stamp.js";
import "./licence.css";

/* The drawn cover, or the uploaded image. dangerouslySetInnerHTML for the same
   reason the stamps use it: the markup comes from a fixed set of five
   functions in cover.js and carries nothing a person typed. */
function Cover({ cover, edit, onPick }) {
  const art = useMemo(
    () => (cover.id !== "image" && COVERS[cover.id] ? COVERS[cover.id].svg() : null),
    [cover.id]);
  const style = cover.id === "image" && cover.image
    ? { backgroundImage: `url("${cover.image}")` }
    : { background: coverGradient(cover.ink) };
  return (
    <div className="lic-cover" style={style}
         data-image={cover.id === "image" && cover.image ? "1" : undefined}>
      {art && (
        <svg viewBox="0 0 640 128" preserveAspectRatio="xMidYMid slice" fill="none"
             aria-hidden="true" dangerouslySetInnerHTML={{ __html: art }} />
      )}
      {edit && (
        <button type="button" className="lic-cover-btn" onClick={onPick}>
          <ImageIcon size={14} aria-hidden="true" /> Cover
        </button>
      )}
    </div>
  );
}

export default function LicenceCard({
  profile, stats = [], stamp = null, edit = false, admin = false, loading = false,
  onPickCover, onPickPhoto, onPickPhrase, onCallsign, onBio, onCreateStamp,
  action = null,
}) {
  const cover = coverOf(profile);
  const name = profile?.callsign || profile?.real_name || "Pilot";
  const issued = Boolean(stamp);

  return (
    <div className="lic-card">
      <Cover cover={cover} edit={edit} onPick={onPickCover} />
      {admin && (
        <span className="lic-adm"><ShieldCheck size={11} aria-hidden="true" /> ADMIN</span>
      )}

      <div className="lic-body">
        <div className="lic-avw">
          {/* THE ONE AVATAR. It used to read Clerk's user.imageUrl, which is
              never null — so this always drew Clerk's generated grey glyph
              and the colour picked below it painted nothing. */}
          <Avatar className="lic-av" profile={profile} name={profile?.real_name || name}
                  size={104} loading={loading} />
          {edit && (
            <button type="button" className="lic-cam" onClick={onPickPhoto}
                    aria-label="Your picture">
              <Camera size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* The callsign is the only name editable here. The full name under it
            belongs to the account and is changed where accounts are. */}
        {edit ? (
          <input className="lic-ed lic-name" defaultValue={profile?.callsign || ""}
                 maxLength={20} aria-label="Callsign" placeholder="Your callsign"
                 onBlur={(e) => onCallsign?.(e.target.value)} />
        ) : <div className="lic-name">{name}</div>}
        {profile?.real_name && <div className="lic-real">{profile.real_name}</div>}

        {edit ? (
          <input className="lic-ed lic-bio" defaultValue={profile?.bio || ""}
                 maxLength={80} aria-label="A line about you"
                 placeholder="Add a line about you"
                 onBlur={(e) => onBio?.(e.target.value)} />
        ) : (profile?.bio ? <p className="lic-bio">{profile.bio}</p> : null)}

        {/* Plain italic text, no pill and no border (§5). A button when it is
            yours to change, a span when it is not — and it looks the same
            either way until you point at it. */}
        {edit ? (
          <button type="button" className="lic-phrase" onClick={onPickPhrase}>
            {profile?.phrase || "Pick a phrase"}
          </button>
        ) : (profile?.phrase ? <span className="lic-phrase">{profile.phrase}</span> : null)}

        <div className="lic-stats">
          {stats.map((s) => (
            <div className="lic-stat" key={s.label}>
              <b>{s.value}</b><span>{s.label}</span>
            </div>
          ))}
        </div>

        {/* The focal point: the stamp, on a dashed line. Before one is issued
            this is a ghost seal and an invitation — and only for the owner.
            Somebody else's unissued stamp is just the ghost: it is not your
            stamp to create, and a button here would say otherwise. */}
        <div className="lic-sblock">
          {issued ? (
            <span><Stamp stamp={stamp} size={150} rot={-6} label={`${name}'s stamp`} /></span>
          ) : edit ? (
            <button type="button" className="lic-ghost" onClick={onCreateStamp}
                    aria-label="Create your stamp">
              <Stamp stamp={DEFAULT_STAMP} size={150} rot={0} on={false} />
              <b>Create your stamp</b>
            </button>
          ) : (
            <span><Stamp stamp={DEFAULT_STAMP} size={150} rot={0} on={false} /></span>
          )}
        </div>

        {action}
      </div>
    </div>
  );
}

/* The card's own read of a profile row, so no screen assembles a stamp by
   hand. Exported beside the card because they always travel together. */
export const cardStamp = (row) => stampOf(row);
