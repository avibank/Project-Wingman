/* §5: "Photo: initials by default, or an uploaded photo." Two choices, and
   both have to be reachable — an upload button with no way back means the
   first photo somebody picks is the one they are stuck with.

   THE PHOTO IS CLERK'S, not this app's. It is the same picture the app bar
   draws and the one Fly solo hides, so there is no second copy in Postgres
   and no second idea of what somebody looks like. Choosing initials is
   therefore clearing Clerk's image, not writing a flag. */
import { X, Upload } from "lucide-react";
import Avatar from "../Avatar.jsx";
import { faceOf } from "../../lib/avatar.js";
import "./licence.css";

export default function PhotoPicker({ profile, name, onUpload, onInitials, onClose }) {
  /* The same face the card draws, at the size it is chosen at. `photo` is
     read through faceOf so a Clerk URL that somehow reached the column is
     treated as no photo here too. */
  const photo = faceOf(profile, { name }).photo;
  return (
    <div className="lic-scrim" role="dialog" aria-label="Your picture"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lic-sheet">
        <button type="button" className="lic-x" onClick={onClose} aria-label="Close">
          <X size={15} aria-hidden="true" />
        </button>
        <h3>Your picture</h3>
        <div className="lic-cgrid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <button type="button" className={`lic-copt${photo ? "" : " is-on"}`}
                  aria-pressed={!photo} onClick={onInitials}>
            <Avatar className="lic-psw" profile={{ ...profile, photo_url: null }} name={name} size={56} />
            <span>Your initials</span>
          </button>
          <button type="button" className={`lic-copt${photo ? " is-on" : ""}`}
                  aria-pressed={Boolean(photo)} onClick={onUpload}>
            <span className="lic-psw lic-psw-up">
              {photo ? <Avatar profile={profile} name={name} size={56} />
                     : <Upload size={22} aria-hidden="true" />}
            </span>
            <span>{photo ? "Change photo" : "Upload a photo"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
