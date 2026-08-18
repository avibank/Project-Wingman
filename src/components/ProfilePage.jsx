import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Mail, LogOut, Camera, Sun, Moon, Check, X, RotateCcw, Trash2 } from "lucide-react";
import { useUser, useClerk, useReverification } from "@clerk/clerk-react";
import { ACCENT_COLORS } from "../data.js";

function ProfilePage({ onBack, theme, onToggleTheme, reduceMotion, onToggleReduceMotion, calmDiscussLights, onToggleCalmDiscussLights, onResetProgress, fontSize, onChangeFontSize, accentColor, onChangeAccentColor, dyslexiaFont, onToggleDyslexiaFont }) {
  const [tab, setTab] = useState("info");
  const { user } = useUser();
  const { signOut } = useClerk();
  const updateUsername = useReverification((newUsername) => user.update({ username: newUsername }));
  const photoInputRef = useRef(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  const [username, setUsername] = useState("");
  const [showRealName, setShowRealName] = useState(false);
  const [usernameSaved, setUsernameSaved] = useState(false);
  const [usernameError, setUsernameError] = useState(null);
  const [usernameBusy, setUsernameBusy] = useState(false);

  const [bio, setBio] = useState("");
  const [bioSaved, setBioSaved] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const BIO_MAX = 160;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nameSaved, setNameSaved] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailStep, setEmailStep] = useState("idle"); // idle | code
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingEmailObj, setPendingEmailObj] = useState(null);
  const [emailError, setEmailError] = useState(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username || "");
      setShowRealName(!!user.unsafeMetadata?.showRealName);
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setBio(user.unsafeMetadata?.bio || "");
    }
  }, [user]);

  const saveBio = async () => {
    if (!user) return;
    setBioBusy(true);
    await user.update({ unsafeMetadata: { ...user.unsafeMetadata, bio: bio.trim() } });
    setBioBusy(false);
    setBioSaved(true);
    setTimeout(() => setBioSaved(false), 1800);
  };

  const saveUsername = async () => {
    if (!user || !username.trim()) return;
    setUsernameError(null);
    setUsernameBusy(true);
    try {
      await updateUsername(username.trim());
      setUsernameSaved(true);
      setTimeout(() => setUsernameSaved(false), 1800);
    } catch (err) {
      if (err?.code !== "reverification_cancelled") {
        setUsernameError(err?.errors?.[0]?.message || "Couldn't save that username — try another.");
      }
    }
    setUsernameBusy(false);
  };

  const toggleShowRealName = async () => {
    if (!user) return;
    const next = !showRealName;
    setShowRealName(next);
    await user.update({ unsafeMetadata: { ...user.unsafeMetadata, showRealName: next } });
  };

  const saveName = async () => {
    if (!user) return;
    await user.update({ firstName: firstName.trim(), lastName: lastName.trim() });
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 1800);
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setPhotoUploading(true);
    await user.setProfileImage({ file });
    setPhotoUploading(false);
  };

  const startEmailChange = async () => {
    if (!user || !newEmail.trim()) return;
    setEmailError(null);
    setEmailBusy(true);
    try {
      const emailObj = await user.createEmailAddress({ email: newEmail.trim() });
      await emailObj.prepareVerification({ strategy: "email_code" });
      setPendingEmailObj(emailObj);
      setEmailStep("code");
    } catch (err) {
      setEmailError(err?.errors?.[0]?.message || "Couldn't start email change.");
    }
    setEmailBusy(false);
  };

  const confirmEmailChange = async () => {
    if (!pendingEmailObj) return;
    setEmailError(null);
    setEmailBusy(true);
    try {
      await pendingEmailObj.attemptVerification({ code: verificationCode.trim() });
      await user.update({ primaryEmailAddressId: pendingEmailObj.id });
      setEmailStep("idle");
      setNewEmail("");
      setVerificationCode("");
      setPendingEmailObj(null);
    } catch (err) {
      setEmailError(err?.errors?.[0]?.message || "Invalid code, please try again.");
    }
    setEmailBusy(false);
  };

  const cancelEmailChange = () => {
    setEmailStep("idle");
    setVerificationCode("");
    setPendingEmailObj(null);
    setEmailError(null);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE" || !user) return;
    setDeleting(true);
    await user.delete();
    onBack();
  };

  if (!user) return null;

  const captionName = showRealName && user.fullName ? user.fullName : (user.username || user.fullName || "Pilot");

  return (
    <div className="profile-page">
      <button className="profile-page-back" onClick={onBack}>
        <ChevronLeft size={16} /> Back
      </button>
      <h1 className="profile-page-title">Profile</h1>

      <div className="profile-page-tabs">
        <button className={tab === "info" ? "is-active" : ""} onClick={() => setTab("info")}>Edit Info</button>
        <button className={tab === "preferences" ? "is-active" : ""} onClick={() => setTab("preferences")}>Preferences</button>
      </div>

      {tab === "info" && (
        <>
          <div className="settings-block">
            <div className="profile-identity-centered">
              <div className="profile-identity-photo-wrap">
                <button className="profile-identity-photo-btn" onClick={() => setShowPhotoModal(true)} aria-label="View photo enlarged">
                  {user.imageUrl ? (
                    <img className="profile-identity-photo" src={user.imageUrl} alt="" />
                  ) : (
                    <div className="profile-identity-icon"><Mail size={22} /></div>
                  )}
                </button>
                <input type="file" accept="image/*" ref={photoInputRef} style={{ display: "none" }} onChange={handlePhotoChange} />
                <button className="profile-identity-photo-camera" onClick={() => photoInputRef.current?.click()} disabled={photoUploading} aria-label="Change photo">
                  <Camera size={13} />
                </button>
              </div>
              <div className="profile-identity-label">{photoUploading ? "Uploading photo…" : "Signed in as"}</div>
              <div className="profile-identity-name">{captionName}</div>
            </div>
            <button className="profile-signout-btn" onClick={() => signOut().then(onBack)}>
              <LogOut size={15} /> Sign out
            </button>
          </div>

          {showPhotoModal && (
            <div className="photo-modal-overlay" onClick={() => setShowPhotoModal(false)}>
              <div className="photo-modal-content" onClick={(e) => e.stopPropagation()}>
                {user.imageUrl ? (
                  <img className="photo-modal-image" src={user.imageUrl} alt="" />
                ) : (
                  <div className="photo-modal-placeholder"><Mail size={40} /></div>
                )}
                <div className="photo-modal-caption">{captionName}</div>
                <button className="photo-modal-close" onClick={() => setShowPhotoModal(false)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          <div className="settings-block">
            <div className="settings-field-block">
              <div className="settings-row-title" style={{ padding: "10px 14px 0" }}>Name</div>
              <div className="settings-two-col">
                <input className="settings-nickname-input" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                <input className="settings-nickname-input" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <button className="settings-save-full" onClick={saveName}>
                {nameSaved ? <Check size={14} /> : "Save name"}
              </button>
            </div>
          </div>

          <div className="settings-block">
            <div className="settings-field-block">
              <div className="settings-row-title" style={{ padding: "10px 14px 0" }}>Bio</div>
              <div className="settings-row-sub" style={{ padding: "0 14px 10px" }}>A short line about yourself</div>
              <div style={{ padding: "0 14px 10px" }}>
                <textarea
                  className="settings-bio-textarea"
                  placeholder="e.g. PPL student at AU Kuwait, working toward my CPL."
                  value={bio}
                  maxLength={BIO_MAX}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                />
                <div className="settings-bio-count">{bio.length}/{BIO_MAX}</div>
              </div>
              <button className="settings-save-full" onClick={saveBio} disabled={bioBusy}>
                {bioBusy ? "…" : bioSaved ? <Check size={14} /> : "Save bio"}
              </button>
            </div>
          </div>

          <div className="settings-block">
            <div className="settings-field-block">
              <div className="settings-row-title" style={{ padding: "10px 14px 0" }}>Email</div>
              <div className="settings-row-sub" style={{ padding: "0 14px 10px" }}>Current: {user.primaryEmailAddress?.emailAddress}</div>
              {emailStep === "idle" ? (
                <div className="settings-nickname-input-row">
                  <input
                    className="settings-nickname-input"
                    placeholder="New email address"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                  <button className="settings-nickname-save" onClick={startEmailChange} disabled={emailBusy}>
                    {emailBusy ? "…" : "Change"}
                  </button>
                </div>
              ) : (
                <div className="settings-nickname-input-row">
                  <input
                    className="settings-nickname-input"
                    placeholder="Enter verification code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                  />
                  <button className="settings-nickname-save" onClick={confirmEmailChange} disabled={emailBusy}>
                    {emailBusy ? "…" : "Confirm"}
                  </button>
                  <button className="settings-cancel-btn" onClick={cancelEmailChange} aria-label="Cancel"><X size={14} /></button>
                </div>
              )}
              {emailStep === "code" && <p className="settings-note" style={{ padding: "4px 14px 10px" }}>We sent a code to {newEmail} — enter it above to confirm.</p>}
              {emailError && <p className="settings-error">{emailError}</p>}
            </div>
          </div>

          <div className="settings-block">
            <div className="settings-nickname-block">
              <div className="settings-row-title" style={{ padding: "10px 14px 0" }}>Username</div>
              <div className="settings-row-sub" style={{ padding: "0 14px 10px" }}>Shown in Comments and Discussion, unless you choose to show your real name instead below</div>
              <div className="settings-nickname-input-row">
                <input
                  className="settings-nickname-input"
                  placeholder="e.g. SkyCadet"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <button className="settings-nickname-save" onClick={saveUsername} disabled={usernameBusy}>
                  {usernameBusy ? "…" : usernameSaved ? <Check size={14} /> : "Save"}
                </button>
              </div>
              {usernameError && <p className="settings-error">{usernameError}</p>}
              <div className="settings-row" onClick={toggleShowRealName}>
                <span className={`settings-switch ${showRealName ? "is-on" : ""}`}><span className="settings-switch-knob" /></span>
                <div>
                  <div className="settings-row-title">Show real name instead</div>
                  <div className="settings-row-sub">Displays your real name instead of your username throughout the app</div>
                </div>
              </div>
            </div>
            <div className="settings-row settings-row--danger" onClick={onResetProgress}>
              <div className="settings-row-icon"><RotateCcw size={16} /></div>
              <div>
                <div className="settings-row-title">Reset progress</div>
                <div className="settings-row-sub">Clears completed chapters, bookmarks, and streak on this device</div>
              </div>
            </div>
            <p className="settings-note">Progress is saved locally on this device only — nothing is sent anywhere.</p>
          </div>

          <div className="settings-block settings-danger-zone">
            <div className="settings-row-title" style={{ padding: "10px 14px 4px", color: "var(--bad)" }}>Point of No Return</div>
            <div className="settings-row-sub" style={{ padding: "0 14px 10px" }}>Permanently deletes your account and everything tied to it. This cannot be undone.</div>
            <div className="settings-nickname-input-row">
              <input
                className="settings-nickname-input"
                placeholder='Type "DELETE" to confirm'
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
              />
              <button className="settings-delete-btn" onClick={handleDeleteAccount} disabled={deleteConfirmText !== "DELETE" || deleting}>
                <Trash2 size={14} /> {deleting ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        </>
      )}

      {tab === "preferences" && (
        <div className="settings-block">
          <div className="settings-row" onClick={onToggleTheme}>
            <div className="settings-row-icon">{theme === "light" ? <Moon size={16} /> : <Sun size={16} />}</div>
            <div>
              <div className="settings-row-title">{theme === "light" ? "Day Ops" : "Night Ops"}</div>
              <div className="settings-row-sub">Currently {theme === "light" ? "light" : "dark"} mode — tap to switch</div>
            </div>
          </div>
          <div className="settings-row settings-row--static">
            <div className="settings-row-icon"><span style={{ fontSize: 15, fontWeight: 700 }}>Aa</span></div>
            <div style={{ flex: 1 }}>
              <div className="settings-row-title">Text size</div>
              <div className="settings-row-sub" style={{ marginBottom: 8 }}>Adjusts the size of chapters, discussion, and library text</div>
              <div className="font-size-options">
                {["small", "medium", "large"].map((size) => (
                  <button
                    key={size}
                    className={`font-size-btn ${fontSize === size ? "is-active" : ""}`}
                    onClick={() => onChangeFontSize(size)}
                  >
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="settings-row settings-row--static">
            <div className="settings-row-icon"><span style={{ width: 14, height: 14, borderRadius: "50%", background: ACCENT_COLORS[accentColor].swatch, display: "block" }} /></div>
            <div style={{ flex: 1 }}>
              <div className="settings-row-title">Accent color</div>
              <div className="settings-row-sub" style={{ marginBottom: 8 }}>{ACCENT_COLORS[accentColor].label}</div>
              <div className="accent-swatch-row">
                {Object.entries(ACCENT_COLORS).map(([key, c]) => (
                  <button
                    key={key}
                    className={`accent-swatch ${accentColor === key ? "is-active" : ""}`}
                    style={{ background: c.swatch }}
                    onClick={() => onChangeAccentColor(key)}
                    aria-label={c.label}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="settings-row" onClick={onToggleReduceMotion}>
            <span className={`settings-switch ${reduceMotion ? "is-on" : ""}`}><span className="settings-switch-knob" /></span>
            <div>
              <div className="settings-row-title">Smooth Air</div>
              <div className="settings-row-sub">Reduces motion — turns off animated transitions across the app</div>
            </div>
          </div>
          <div className="settings-row" onClick={onToggleCalmDiscussLights}>
            <span className={`settings-switch ${calmDiscussLights ? "is-on" : ""}`}><span className="settings-switch-knob" /></span>
            <div>
              <div className="settings-row-title">Lights Out</div>
              <div className="settings-row-sub">Replaces the pulsing red/green buttons in Discussion with a plain navy style</div>
            </div>
          </div>
          <div className="settings-row" onClick={onToggleDyslexiaFont}>
            <span className={`settings-switch ${dyslexiaFont ? "is-on" : ""}`}><span className="settings-switch-knob" /></span>
            <div>
              <div className="settings-row-title">Dyslexia-friendly font</div>
              <div className="settings-row-sub">Switches body text to a font designed for easier reading</div>
            </div>
          </div>
          <p className="settings-note">Quizzes support keyboard shortcuts: press 1-4 or A-D to answer, and Enter to continue.</p>
        </div>
      )}

      <style>{`
        .profile-page { max-width: 560px; }
        .profile-page-back { display: flex; align-items: center; gap: 4px; background: transparent; border: none; color: var(--accent); font-size: 13px; cursor: pointer; padding: 0; margin-bottom: 18px; }
        .profile-page-title { font-family: 'Space Grotesk', sans-serif; font-size: 22px; color: var(--text); margin: 0 0 16px; }
        .profile-page-tabs { display: flex; gap: 4px; background: var(--panel-alt); border-radius: 10px; padding: 4px; margin-bottom: 16px; }
        .profile-page-tabs button { flex: 1; background: transparent; border: none; color: var(--muted2); font-size: 12.5px; padding: 8px 4px; border-radius: 8px; cursor: pointer; }
        .profile-page-tabs button.is-active { background: var(--panel); color: var(--text); }
        .settings-block { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 6px; margin-bottom: 12px; }
        .settings-row { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 10px; cursor: pointer; }
        .settings-row:hover { background: var(--panel-alt); }
        .settings-row--static { cursor: default; }
        .settings-row--static:hover { background: transparent; }
        .font-size-options { display: flex; gap: 6px; }
        .font-size-btn { flex: 1; background: var(--panel-alt); border: 1px solid var(--border); color: var(--muted2); font-size: 12.5px; padding: 8px; border-radius: 8px; cursor: pointer; }
        .font-size-btn.is-active { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
        .accent-swatch-row { display: flex; gap: 10px; }
        .accent-swatch { width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; }
        .accent-swatch.is-active { border-color: var(--text); box-shadow: 0 0 0 2px var(--panel), 0 0 0 4px var(--border-hover); }
        .settings-row--danger:hover { background: rgba(224,102,90,0.08); }
        .settings-row-icon { width: 34px; height: 34px; border-radius: 10px; background: var(--panel-alt); display: flex; align-items: center; justify-content: center; color: var(--accent); flex-shrink: 0; }
        .settings-row--danger .settings-row-icon { color: var(--bad); }
        .settings-row-title { font-size: 14px; color: var(--text); font-weight: 600; }
        .settings-row-sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .settings-note { font-size: 12px; color: var(--muted2); line-height: 1.5; padding: 12px 14px 4px; }
        .settings-error { font-size: 12px; color: var(--bad); padding: 0 14px 10px; margin: 0; }
        .settings-switch { width: 34px; height: 20px; border-radius: 12px; background: var(--border); position: relative; flex-shrink: 0; transition: background 0.15s ease; }
        .settings-switch.is-on { background: var(--accent); }
        .settings-switch-knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 0.15s ease; }
        .settings-switch.is-on .settings-switch-knob { transform: translateX(14px); }
        .settings-field-block { padding-bottom: 10px; }
        .settings-two-col { display: flex; gap: 8px; padding: 0 14px 10px; }
        .settings-nickname-block { border-bottom: 1px solid var(--border-soft); margin-bottom: 6px; padding-bottom: 6px; }
        .settings-nickname-input-row { display: flex; gap: 8px; padding: 0 14px 10px; }
        .settings-nickname-input { flex: 1; background: var(--panel-alt); border: 1px solid var(--border); border-radius: 8px; padding: 9px 12px; color: var(--text); font-size: 13.5px; min-width: 0; }
        .settings-nickname-input:focus { outline: none; border-color: var(--accent); }
        .settings-bio-textarea { width: 100%; background: var(--panel-alt); border: 1px solid var(--border); border-radius: 8px; padding: 9px 12px; color: var(--text); font-size: 13.5px; font-family: inherit; resize: vertical; min-height: 60px; box-sizing: border-box; }
        .settings-bio-textarea:focus { outline: none; border-color: var(--accent); }
        .settings-bio-count { text-align: right; font-size: 11px; color: var(--muted2); margin-top: 4px; }
        .settings-nickname-save { background: var(--accent); color: var(--on-accent); border: none; border-radius: 8px; padding: 0 16px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; min-width: 52px; }
        .settings-nickname-save:disabled { opacity: 0.6; cursor: not-allowed; }
        .settings-save-full { background: var(--accent); color: var(--on-accent); border: none; border-radius: 8px; padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer; margin: 0 14px 4px; }
        .settings-cancel-btn { background: transparent; border: 1px solid var(--border); color: var(--muted2); width: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .profile-identity-centered { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 20px 14px 14px; }
        .profile-identity-photo-wrap { position: relative; margin-bottom: 12px; }
        .profile-identity-photo-btn { width: 84px; height: 84px; border-radius: 50%; padding: 0; border: none; background: transparent; cursor: pointer; display: block; }
        .profile-identity-icon { width: 84px; height: 84px; border-radius: 50%; background: var(--panel-alt); display: flex; align-items: center; justify-content: center; color: var(--accent); }
        .profile-identity-photo { width: 84px; height: 84px; border-radius: 50%; object-fit: cover; display: block; }
        .profile-identity-photo-camera { position: absolute; bottom: 0; right: 0; width: 28px; height: 28px; border-radius: 50%; background: var(--accent); color: var(--on-accent); display: flex; align-items: center; justify-content: center; border: 3px solid var(--panel); cursor: pointer; }
        .profile-identity-photo-camera:disabled { opacity: 0.5; cursor: not-allowed; }
        .profile-identity-label { font-size: 11px; color: var(--muted); }
        .profile-identity-name { font-size: 15px; color: var(--text); font-weight: 600; margin-top: 2px; }
        .photo-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .photo-modal-content { position: relative; display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .photo-modal-image { width: min(280px, 70vw); height: min(280px, 70vw); border-radius: 50%; object-fit: cover; }
        .photo-modal-placeholder { width: min(280px, 70vw); height: min(280px, 70vw); border-radius: 50%; background: var(--panel); display: flex; align-items: center; justify-content: center; color: var(--accent); }
        .photo-modal-caption { font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700; color: #fff; }
        .photo-modal-close { position: absolute; top: -36px; right: -4px; width: 32px; height: 32px; border-radius: 50%; background: var(--panel); border: 1px solid var(--border-hover); color: var(--text); display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .profile-signout-btn { display: flex; align-items: center; justify-content: center; gap: 8px; background: transparent; border: 1px solid var(--border); color: var(--bad); font-size: 13px; padding: 10px; border-radius: 10px; cursor: pointer; width: calc(100% - 12px); margin: 0 6px 6px; }
        .profile-signout-btn:hover { background: rgba(224,102,90,0.08); }
        .settings-danger-zone { border-color: rgba(224,102,90,0.4); }
        .settings-delete-btn { display: flex; align-items: center; gap: 6px; background: var(--bad); color: #fff; border: none; border-radius: 8px; padding: 0 14px; font-size: 12.5px; font-weight: 600; cursor: pointer; white-space: nowrap; }
        .settings-delete-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

export default ProfilePage;
