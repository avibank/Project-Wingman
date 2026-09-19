/* pickPhoto() from docs/launch/code/08-photo-and-cover-pickers.js: `.pgrid` of
   two `.popt`, each with the face at `.av.sm` above its label.

   "Use your initials" is `photo_url = null` and nothing else. No Clerk call,
   so nothing can throw — that is the whole of bug 1. The reference's own note
   says the same thing in one line. */
import Avatar from "../Avatar.jsx";
import { faceOf } from "../../lib/avatar.js";
import Sheet from "./Sheet.jsx";
import "./licence.css";
import "./ref-licence.css";

const UploadIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 16V5M7 10l5-5 5 5M5 19h14" />
  </svg>
);

export default function PhotoPicker({ profile, name, onUpload, onInitials, onClose }) {
  /* The same face the card draws, at the size it is chosen at. `photo` is read
     through faceOf so a Clerk URL that somehow reached the column is treated
     as no photo here too. */
  const photo = faceOf(profile, { name }).photo;
  return (
    <Sheet label="Profile picture" onClose={onClose}>
      <h3>Profile picture</h3>
      <div className="pgrid">
        <button type="button" className={`popt${photo ? "" : " on"}`}
                aria-pressed={!photo} onClick={onInitials}>
          <Avatar className="av sm" profile={{ ...profile, photo_url: null }}
                  name={name} size={64} />
          <span>Your initials</span>
        </button>
        <button type="button" className={`popt${photo ? " on" : ""}`}
                aria-pressed={Boolean(photo)} onClick={onUpload}>
          <span className="av sm up ph">
            {photo ? <Avatar profile={profile} name={name} size={64} /> : <UploadIcon />}
          </span>
          <span>{photo ? "Change photo" : "Upload a photo"}</span>
        </button>
      </div>
    </Sheet>
  );
}
