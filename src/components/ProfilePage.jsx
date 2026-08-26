import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Mail, LogOut, Camera, Sun, Moon, Check, X, RotateCcw, Trash2 } from "lucide-react";
import { useUser, useClerk, useReverification } from "@clerk/clerk-react";
import { useSocialPrefs } from "../lib/social.js";
import { ERROR_GENERIC } from "../lib/copy.js";

function ProfilePage({ onBack, theme, onToggleTheme, reduceMotion, onToggleReduceMotion, onResetProgress, fontSize, onChangeFontSize, dyslexiaFont, onToggleDyslexiaFont, turbulence, onToggleTurbulence }) {
  const [tab, setTab] = useState("info");
  const { user } = useUser();
  const { signOut } = useClerk();
  const updateUsername = useReverification((newUsername) => user.update({ username: newUsername }));
  const photoInputRef = useRef(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  const [username, setUsername] = useState("");
  const [showRealName, setShowRealName] = useState(true);
  const { prefs: socialPrefs, update: updateSocialPrefs } = useSocialPrefs();
  const [course, setCourse] = useState("");
  const [courseSaved, setCourseSaved] = useState(false);
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
      // Default to the real name; only an explicit opt-out switches to username-only.
      setShowRealName(user.unsafeMetadata?.showRealName !== false);
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
        setUsernameError(err?.errors?.[0]?.message || ERROR_GENERIC);
      }
    }
    setUsernameBusy(false);
  };

  const toggleShowRealName = async () => {
    if (!user) return;
    const next = !showRealName;
    setShowRealName(next);
    await user.update({ unsafeMetadata: { ...user.unsafeMetadata, showRealName: next } });
    // Social rows read identity_display, so the two must not drift apart.
    await updateSocialPrefs({ identity_display: next ? "real" : "username" });
  };

  useEffect(() => {
    if (socialPrefs?.course != null) setCourse(socialPrefs.course);
  }, [socialPrefs?.course]);

  const saveCourse = async () => {
    await updateSocialPrefs({ course: course.trim() || null });
    setCourseSaved(true);
    setTimeout(() => setCourseSaved(false), 1800);
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
      setEmailError(err?.errors?.[0]?.message || ERROR_GENERIC);
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
      setEmailError(err?.errors?.[0]?.message || ERROR_GENERIC);
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
                <input type="file" accept="image/*" aria-label="Choose a profile photo" ref={photoInputRef} style={{ display: "none" }} onChange={handlePhotoChange} />
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
                  aria-label="Bio"
                  placeholder=""
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
              <div className="settings-field">
                <div className="settings-row-title">Course or class</div>
                <div className="settings-row-sub">Optional. Used only to suggest study partners from your class — not verified, and shown to no one.</div>
                <div className="settings-inline">
                  <input
                    className="settings-input"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    placeholder="e.g. ATPL-24"
                    maxLength={40}
                  />
                  <button className="settings-save" onClick={saveCourse}>
                    {courseSaved ? <Check size={14} /> : "Save"}
                  </button>
                </div>
              </div>
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
            <div className="settings-privacy">
              {/* §9.6 — this said "saved locally on this device only, nothing is
                  sent anywhere" on a page that also offers an account, an email
                  change, a username shown to other people, and class-based
                  matching. Both could not be true, and the spec is right that
                  ambiguity here suppresses participation more than bad UI does. */}
              <p><strong>Shared with other pilots:</strong> your username, your livery, and what
                chapter you are on while you are studying. Nothing else.</p>
              <p><strong>Private to you:</strong> your scores, your saved questions, your notes,
                and your email.</p>
              <p><strong>Stored on our servers,</strong> not only on this device — that is how
                progress follows you between devices and how anyone can answer your questions.
                Turn on <em>Fly solo</em> in Settings: nobody sees you and you see nobody.</p>
            </div>
          </div>

          <div className="settings-block settings-danger-zone">
            <div className="settings-row-title" style={{ padding: "10px 14px 4px", color: "var(--danger)" }}>Delete account</div>
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
        <>
          <div className="settings-block">
            <h2 className="settings-group-label">Appearance</h2>
            <div className="settings-row" onClick={onToggleTheme}>
              <div className="settings-row-icon">{theme === "light" ? <Moon size={16} /> : <Sun size={16} />}</div>
              <div>
                <div className="settings-row-title">Dark mode</div>
                <div className="settings-row-sub">{theme === "light" ? "Off — tap for dark" : "On — tap for light"}</div>
              </div>
            </div>
            <div className="settings-row settings-row--static settings-row--centered">
              <div className="settings-row-title">Text size</div>
              <div className="settings-row-sub">Adjusts text size across chapters, discussion, and library</div>
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

          <div className="settings-block">
            <h2 className="settings-group-label">Accessibility &amp; Motion</h2>
            <div className="settings-row" onClick={onToggleReduceMotion}>
              <span className={`settings-switch ${reduceMotion ? "is-on" : ""}`}><span className="settings-switch-knob" /></span>
              <div>
                <div className="settings-row-title">Reduce motion</div>
                <div className="settings-row-sub">Reduces motion — turns off animated transitions across the app</div>
              </div>
            </div>
            <div className="settings-row" onClick={onToggleDyslexiaFont}>
              <span className={`settings-switch ${dyslexiaFont ? "is-on" : ""}`}><span className="settings-switch-knob" /></span>
              <div>
                <div className="settings-row-title">Dyslexia-friendly font</div>
                <div className="settings-row-sub">A clearer font for easier reading — designed to help with dyslexia and reading fatigue</div>
              </div>
            </div>
            <div className="settings-row" onClick={onToggleTurbulence}>
              <span className={`settings-switch ${turbulence ? "is-on" : ""}`}><span className="settings-switch-knob" /></span>
              <div>
                <div className="settings-row-title">Haptics</div>
                <div className="settings-row-sub">A subtle nudge on meaningful events</div>
              </div>
            </div>
          </div>
          <p className="settings-note">Quizzes support keyboard shortcuts: press 1-4 or A-D to answer, and Enter to continue.</p>
        </>
      )}

      <style>{`
        .profile-page { max-width: 560px; }
        .profile-page-back { display: flex; align-items: center; gap: 4px; background: transparent; border: none; color: var(--accent-muted); font-size: 14px; cursor: pointer; padding: 0; margin-bottom: 18px; }
        .profile-page-title { font-family: var(--font-display); font-size: 20px; color: var(--text); margin: 0 0 16px; }
        .profile-page-tabs { display: flex; gap: 4px; background: var(--panel-alt); border-radius: var(--r-md); padding: 4px; margin-bottom: 16px; }
        .profile-page-tabs button { flex: 1; background: transparent; border: none; color: var(--muted2); font-size: 12px; padding: 8px 4px; border-radius: var(--r-sm); cursor: pointer; }
        .profile-page-tabs button.is-active { background: var(--panel); color: var(--text); }
        .settings-block { background: var(--elev-1); border: 1px solid var(--border); box-shadow: var(--shadow-1); border-radius: var(--r-lg); padding: 8px; margin-bottom: 12px; }
        .settings-group-label { font-family: var(--font-ui); font-size: 12px; color: var(--muted2); padding: 10px 14px 4px; }
        .settings-field { padding: 14px 16px; border-bottom: 1px solid var(--border-soft); }
        .settings-inline { display: flex; gap: 8px; margin-top: 10px; }
        .settings-input { flex: 1; min-width: 0; background: var(--well); border: 1px solid var(--border); border-radius: var(--r-sm);
          color: var(--text); font-family: var(--font-body); font-size: 14px; padding: 9px 11px; box-shadow: var(--shadow-inset); }
        .settings-save { display: inline-flex; align-items: center; justify-content: center; background: var(--accent); color: var(--on-accent);
          border: none; border-radius: var(--r-sm); padding: 9px 15px; font-weight: 600; font-size: 12px; cursor: pointer; min-height: 40px; }
        .settings-row { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: var(--r-md); cursor: pointer; }
        .settings-row:hover { background: var(--panel-alt); }
        .settings-row--static { cursor: default; flex-direction: column; align-items: center; text-align: center; gap: 4px; padding: 18px 14px; }
        .settings-row--static:hover { background: transparent; }
        .settings-row--centered .settings-row-sub { margin-bottom: 10px; }
        .font-size-options { display: flex; gap: 8px; justify-content: center; margin-top: 4px; }
        .font-size-btn { background: var(--panel-alt); border: 1px solid var(--border); color: var(--muted2); font-size: 12px; padding: 8px 18px; border-radius: var(--r-sm); cursor: pointer; }
        .font-size-btn.is-active { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
        .settings-row--danger:hover { background: rgba(224,102,90,0.08); }
        .settings-row-icon { width: 34px; height: 34px; border-radius: var(--r-md); background: var(--panel-alt); display: flex; align-items: center; justify-content: center; color: var(--accent); flex-shrink: 0; }
        .settings-row--danger .settings-row-icon { color: var(--bad); }
        .settings-row-title { font-size: 14px; color: var(--text); font-weight: 600; }
        .settings-row-sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .settings-privacy { padding: 10px 14px 14px; display: grid; gap: 8px; }
        .settings-privacy p { font-size: 14px; line-height: 1.55; color: var(--text-secondary); margin: 0; max-width: 56ch; }
        .settings-privacy strong { color: var(--text-primary); font-weight: 500; }
        .settings-note { font-size: 12px; color: var(--muted2); line-height: 1.5; padding: 12px 14px 4px; }
        .settings-error { font-size: 12px; color: var(--bad); padding: 0 14px 10px; margin: 0; }
        .settings-switch { width: 34px; height: 20px; border-radius: var(--r-md); background: var(--border); position: relative; flex-shrink: 0; transition: background 180ms ease; }
        .settings-switch.is-on { background: var(--accent); }
        .settings-switch-knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 180ms ease; }
        .settings-switch.is-on .settings-switch-knob { transform: translateX(14px); }
        .settings-field-block { padding-bottom: 10px; }
        .settings-two-col { display: flex; gap: 8px; padding: 0 14px 10px; }
        .settings-nickname-block { border-bottom: 1px solid var(--border-soft); margin-bottom: 6px; padding-bottom: 6px; }
        .settings-nickname-input-row { display: flex; gap: 8px; padding: 0 14px 10px; }
        .settings-nickname-input { flex: 1; background: var(--panel-alt); border: 1px solid var(--border); border-radius: var(--r-sm); padding: 9px 12px; color: var(--text); font-size: 14px; min-width: 0; }
        .settings-nickname-input:focus { outline: none; border-color: var(--accent); }
        .settings-bio-textarea { width: 100%; background: var(--panel-alt); border: 1px solid var(--border); border-radius: var(--r-sm); padding: 9px 12px; color: var(--text); font-size: 14px; font-family: inherit; resize: vertical; min-height: 60px; box-sizing: border-box; }
        .settings-bio-textarea:focus { outline: none; border-color: var(--accent); }
        .settings-bio-count { text-align: right; font-size: 12px; color: var(--muted2); margin-top: 4px; }
        .settings-nickname-save { background: var(--accent); color: var(--on-accent); border: none; border-radius: var(--r-sm); padding: 0 16px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; min-width: 52px; }
        .settings-nickname-save:disabled { opacity: 0.6; cursor: not-allowed; }
        .settings-save-full { background: var(--accent); color: var(--on-accent); border: none; border-radius: var(--r-sm); padding: 9px 16px; font-size: 12px; font-weight: 600; cursor: pointer; margin: 0 14px 4px; }
        .settings-cancel-btn { background: transparent; border: 1px solid var(--border); color: var(--muted2); width: 36px; border-radius: var(--r-sm); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .profile-identity-centered { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 20px 14px 14px; }
        .profile-identity-photo-wrap { position: relative; margin-bottom: 12px; }
        .profile-identity-photo-btn { width: 84px; height: 84px; border-radius: 50%; padding: 0; border: none; background: transparent; cursor: pointer; display: block; }
        .profile-identity-icon { width: 84px; height: 84px; border-radius: 50%; background: var(--panel-alt); display: flex; align-items: center; justify-content: center; color: var(--accent); }
        .profile-identity-photo { width: 84px; height: 84px; border-radius: 50%; object-fit: cover; display: block; }
        .profile-identity-photo-camera { position: absolute; bottom: 0; right: 0; width: 28px; height: 28px; border-radius: 50%; background: var(--accent); color: var(--on-accent); display: flex; align-items: center; justify-content: center; border: 3px solid var(--panel); cursor: pointer; }
        .profile-identity-photo-camera:disabled { opacity: 0.5; cursor: not-allowed; }
        .profile-identity-label { font-size: 12px; color: var(--muted); }
        .profile-identity-name { font-size: 16px; color: var(--text); font-weight: 600; margin-top: 2px; }
        .photo-modal-overlay { position: fixed; inset: 0; background: color-mix(in oklab, var(--ground), transparent 15%); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .photo-modal-content { position: relative; display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .photo-modal-image { width: min(280px, 70vw); height: min(280px, 70vw); border-radius: 50%; object-fit: cover; }
        .photo-modal-placeholder { width: min(280px, 70vw); height: min(280px, 70vw); border-radius: 50%; background: var(--panel); display: flex; align-items: center; justify-content: center; color: var(--accent); }
        .photo-modal-caption { font-family: var(--font-display); font-size: 20px; font-weight: 600; color: #fff; }
        .photo-modal-close { position: absolute; top: -36px; right: -4px; width: 32px; height: 32px; border-radius: 50%; background: var(--panel); border: 1px solid var(--border-hover); color: var(--text); display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .profile-signout-btn { display: flex; align-items: center; justify-content: center; gap: 8px; background: transparent; border: 1px solid var(--border); color: var(--bad); font-size: 12px; padding: 10px; border-radius: var(--r-md); cursor: pointer; width: calc(100% - 12px); margin: 0 6px 6px; }
        .profile-signout-btn:hover { background: rgba(224,102,90,0.08); }
        .settings-danger-zone { border-color: rgba(224,102,90,0.4); }
        .settings-delete-btn { display: flex; align-items: center; gap: 6px; background: var(--bad); color: #fff; border: none; border-radius: var(--r-sm); padding: 0 14px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; }
        .settings-delete-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

export default ProfilePage;
