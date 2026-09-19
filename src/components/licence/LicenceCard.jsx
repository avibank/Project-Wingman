/* =============================================================================
   THE LICENCE CARD. ONE COMPONENT, TWO MODES.
   -----------------------------------------------------------------------------
   §5: "The first box on the Licence tab IS the licence card. It's the same
   component other people see when they tap your face; the owner just sees it
   in edit mode." So there is one of these, and `edit` is the only difference —
   not a second component that looks similar and drifts.

   THE MARKUP IS THE REFERENCE'S, element for element and class for class:
   `card()`, `coverHTML()`, `avatarHTML()` and `stampBlock()` in
   docs/launch/code/07-card-and-avatar.js. The stylesheet is that build's own,
   scoped into ref-licence.css by `npm run ref:css`; the wrapper carries
   `.ref-lic` and nothing in this file sets a layout rule. Two earlier passes
   rebuilt this screen from a written description; the class names are how you
   can tell this one did not.

   FOUR THINGS ARE THIS APP'S RATHER THAN THE REFERENCE'S, each for a reason
   already written down somewhere else in the repo:

     · NO `--accent` ON THE CARD. The reference tints each card from the
       pilot's own livery. This app has ONE livery system and the pilot one
       was deleted on 2026-09-04, columns and all (migration 0013, CLAUDE.md).
       Setting it here would be re-adding it. The owner's chosen colour still
       reaches the card where the reference actually spends it — the cover
       gradient and the initials circle, both from `cover_ink`.
     · THE FACE IS <Avatar>, under the reference's class names. §1 point 4 of
       the handoff asks for one avatar component everywhere; `.av` / `.av.ph`
       is what the sheet styles, so it is handed both.
     · THE STAMP IS <Stamp>, for the same reason — one renderer (src/lib/
       stamp.js), drawn into the reference's `.sblock`.
     · FIVE CONTROLS CARRY `.is-inline`. §12 puts a 44px floor under every
       button and input in this app, globally, in App.jsx — and it is what
       made this card 43px taller than the reference: the callsign field went
       33 -> 44, the bio 26 -> 44, the phrase 32 -> 44. The rule names its own
       exception, "the rare control that genuinely sits inside a line of
       text", and these are the definition of it: the callsign field IS the
       heading, the bio field IS the line of prose, and the phrase button IS
       a line of italic text.

       The Cover button and the camera on the avatar are not sentences, and
       they take the opt-out for a different reason, stated rather than
       smuggled: the floor made the camera 30 wide and 44 tall, which is an
       OVAL where the design draws a circle, and the Cover pill 44 tall on a
       128px banner. They are the design's 29 and 30 now. Both still clear
       WCAG 2.2 AA's 24px minimum target; §12's 44 is the stricter house rule,
       and this screen is a later signed-off design. docs/launch/DECISIONS.md
       carries the argument and the measurement.
     · THE CALLSIGN FIELD IS AS WIDE AS THE NAME IN IT, written the way the
       reference writes it — `size` on the way in, and the input element's own
       `size` set from `oninput` on the way through. Measured: without it the
       field is a browser default of 20 characters, 315px against the
       reference's 185, and the dashed rule under a ten-letter callsign runs
       130px past it. It is a DOM write in an event handler rather than state,
       which is exactly what `$('#fCs').oninput` does there; making it state
       would re-render the card on every keystroke.

   WHAT IS NOT DECIDED HERE: what a cover looks like (src/lib/cover.js), what a
   stamp looks like (src/lib/stamp.js and <Stamp/>), and where the numbers come
   from (src/lib/licence.js). This file arranges them.
   ========================================================================= */
import { useMemo } from "react";
import { COVERS, coverGradient, coverOf } from "../../lib/cover.js";
import Stamp from "../Stamp.jsx";
import Avatar from "../Avatar.jsx";
import { faceOf } from "../../lib/avatar.js";
import { stampOf, DEFAULT_STAMP } from "../../lib/stamp.js";
import "./licence.css";
import "./ref-licence.css";

/* The reference's two inline SVGs, as JSX. They are the only two icons on the
   card and they are drawn rather than imported for the same reason the rest of
   it is copied: lucide's camera is a different camera. */
const CoverIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 16 5-5 4 4 3-3 6 6" />
  </svg>
);
const CamIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
  </svg>
);
const AdmIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2.2" aria-hidden="true">
    <path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6z" />
  </svg>
);

/* coverHTML(). dangerouslySetInnerHTML for the same reason the stamps use it:
   the markup comes from a fixed set of five functions in cover.js and carries
   nothing a person typed. */
function Cover({ cover, edit, onPick }) {
  const art = useMemo(
    () => (cover.id !== "image" && COVERS[cover.id] ? COVERS[cover.id].svg() : null),
    [cover.id]);
  const style = cover.id === "image" && cover.image
    ? { backgroundImage: `url("${cover.image}")`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: coverGradient(cover.ink) };
  return (
    <div className="cover" style={style}>
      {art && (
        <svg viewBox="0 0 640 128" preserveAspectRatio="xMidYMid slice" fill="none"
             aria-hidden="true" dangerouslySetInnerHTML={{ __html: art }} />
      )}
      {edit && (
        <button type="button" className="cvbtn is-inline" onClick={onPick}>
          <CoverIcon /> Cover
        </button>
      )}
    </div>
  );
}

export default function LicenceCard({
  profile, stats = [], stamp = null, edit = false, admin = false, loading = false,
  slam = false,
  onPickCover, onPickPhoto, onPickPhrase, onCallsign, onBio, onCreateStamp,
  action = null,
}) {
  const cover = coverOf(profile);
  const name = profile?.callsign || profile?.real_name || "Pilot";
  const issued = Boolean(stamp);
  /* `.av.ph` is the reference's photo variant and positions the <img>
     absolutely; `.av` alone paints the initials. One read of the same
     function the component itself uses, so the two cannot disagree. */
  const hasPhoto = Boolean(faceOf(profile, { name: profile?.real_name || name }).photo);

  return (
    <div className="ref-lic">
      <div className={`lic${edit ? " editing" : ""}`} data-ref="licence-card">
        <Cover cover={cover} edit={edit} onPick={onPickCover} />
        {admin && <span className="adm"><AdmIcon />ADMIN</span>}

        <div className="lbody">
          <div className="avw">
            {/* THE ONE AVATAR. It used to read Clerk's user.imageUrl, which is
                never null — so this always drew Clerk's generated grey glyph
                and the colour picked below it painted nothing. */}
            <Avatar className={`av${hasPhoto ? " ph" : ""}`} profile={profile}
                    name={profile?.real_name || name} size={104} loading={loading} />
            {edit && (
              <button type="button" className="cam is-inline" onClick={onPickPhoto}
                      aria-label="Profile picture">
                <CamIcon />
              </button>
            )}
          </div>

          {/* The callsign is the only name editable here. The full name under it
              belongs to the account and is changed where accounts are. */}
          {edit ? (
            <input className="ed hn is-inline" defaultValue={profile?.callsign || ""}
                   aria-label="Callsign" maxLength={20} placeholder="Your callsign"
                   size={Math.max(6, (profile?.callsign || "").length + 1)}
                   onInput={(e) => { e.target.size = Math.max(6, e.target.value.length + 1); }}
                   onBlur={(e) => onCallsign?.(e.target.value)} />
          ) : <div className="hn">{name}</div>}
          {profile?.real_name && <div className="sn">{profile.real_name}</div>}

          {edit ? (
            <input className="ed bio is-inline" defaultValue={profile?.bio || ""}
                   maxLength={80} aria-label="A line about you"
                   placeholder="Add a line about you"
                   onBlur={(e) => onBio?.(e.target.value)} />
          ) : (profile?.bio ? <p className="bio">{profile.bio}</p> : null)}

          {/* v10 of the sheet made the phrase plain italic text — no pill, no
              border. A button when it is yours to change, a span when it is
              not, and it looks the same either way until you point at it. */}
          {edit ? (
            <button type="button" className="tag is-inline" onClick={onPickPhrase} title="Pick a phrase">
              <i /><span>{profile?.phrase || "Pick a phrase"}</span><i />
            </button>
          ) : (profile?.phrase ? (
            <span className="tag"><i /><span>{profile.phrase}</span><i /></span>
          ) : null)}

          <div className="stats">
            {stats.map((s) => (
              <div key={s.label}><b>{s.value}</b><span>{s.label}</span></div>
            ))}
          </div>

          {/* The focal point: the stamp, on a dashed line. Before one is issued
              this is a ghost seal and an invitation — and only for the owner.
              Somebody else's unissued stamp is just the ghost: it is not your
              stamp to create, and a button here would say otherwise. */}
          <div className="sblock">
            {issued ? (
              <span className={`got${slam ? " slam" : ""}`}>
                <Stamp stamp={stamp} size={150} rot={-6} label={`${name}'s stamp`} />
              </span>
            ) : edit ? (
              <button type="button" className="ghost" onClick={onCreateStamp}
                      aria-label="Create your stamp">
                <Stamp stamp={DEFAULT_STAMP} size={150} rot={0} on={false} />
                <b>Create your stamp</b>
              </button>
            ) : (
              <span className="gen"><Stamp stamp={DEFAULT_STAMP} size={150} rot={0} on={false} /></span>
            )}
          </div>

          {action}
        </div>
      </div>
    </div>
  );
}

/* The card's own read of a profile row, so no screen assembles a stamp by
   hand. Exported beside the card because they always travel together. */
export const cardStamp = (row) => stampOf(row);
