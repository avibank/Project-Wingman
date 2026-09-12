import { useEffect, useRef, useState } from "react";

/* §5 — CREATING ONE.
 *
 * The control existed on the discovery screen from the start and did nothing:
 * it called a handler App never supplied, and there was no create_squadron for
 * App to have supplied it with. This is the form, and 0022 is the other half.
 *
 * FOUR FIELDS, and the fourth is the one that matters. Who can join decides
 * whether the room appears in discovery at all, so it is asked here rather
 * than hidden in a settings screen nobody opens — and it defaults to Link only,
 * because a room that is open before it has anybody in it is a room strangers
 * walk into first.
 */
const POLICIES = [
  { id: "invite_only", label: "Link only", note: "It stays off the Find screen. You share the link." },
  { id: "request", label: "On request", note: "People can ask. You let them in." },
  { id: "open", label: "Anyone", note: "Listed on Find, and anyone in your modules can join." },
];

export default function CreateSquadron({ open, modules = [], defaultModule, onClose, onCreate, busy }) {
  const [name, setName] = useState("");
  const [moduleCode, setModuleCode] = useState(defaultModule || modules[0]?.code || "");
  const [blurb, setBlurb] = useState("");
  const [policy, setPolicy] = useState("invite_only");
  const nameRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setName(""); setBlurb(""); setPolicy("invite_only");
    setModuleCode(defaultModule || modules[0]?.code || "");
    const t = setTimeout(() => nameRef.current?.focus(), 60);
    const key = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    return () => { clearTimeout(t); document.removeEventListener("keydown", key); };
  }, [open, defaultModule, modules, onClose]);

  return (
    <>
      <div className="veil" data-open={open ? "true" : "false"} onClick={onClose} aria-hidden="true" />
      <div className="modal" data-open={open ? "true" : "false"} role="dialog" aria-modal="true"
           aria-label="Create a squadron" aria-hidden={open ? undefined : "true"}>
        {open && (
          <form className="sheet" onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || !moduleCode) return;
            onCreate({ name, moduleCode, blurb, policy });
          }}>
            <h3>Create a squadron</h3>

            <div className="field">
              <label htmlFor="cs-name">Name</label>
              <input id="cs-name" ref={nameRef} value={name} maxLength={48}
                     placeholder="M13 — November sitting"
                     onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="cs-mod">Module</label>
              <select id="cs-mod" value={moduleCode} onChange={(e) => setModuleCode(e.target.value)}>
                {modules.map((m) => (
                  <option key={m.code || m.id} value={m.code || m.id}>
                    {(m.code || m.id)} — {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="cs-blurb">One line about it</label>
              <input id="cs-blurb" value={blurb} maxLength={90}
                     placeholder="Who it's for, and when you meet"
                     onChange={(e) => setBlurb(e.target.value)} />
            </div>

            <fieldset className="field">
              <legend>Who can join</legend>
              <div className="seg">
                {POLICIES.map((p) => (
                  <button type="button" key={p.id} className="is-inline"
                          aria-pressed={policy === p.id} onClick={() => setPolicy(p.id)}>
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="hint">{POLICIES.find((p) => p.id === policy)?.note}</p>
            </fieldset>

            <div className="sheet-acts">
              <button type="button" className="ghost is-inline" onClick={onClose}>Cancel</button>
              <button type="submit" className="primary is-inline" disabled={!name.trim() || busy}>
                {busy ? "Creating" : "Create"}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
