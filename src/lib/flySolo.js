// "Fly solo" — one switch, symmetric: nobody sees you and you see nobody.
//
// Two things have to be true at once, so it is stored in two places on purpose:
//
//   * pilot_profiles.invisible, so other people's queries exclude you. That is
//     the half that cannot be enforced on your own device.
//   * a localStorage mirror, so the plain functions in this folder can read it
//     synchronously. They are not React and cannot reach the progress provider,
//     and an async read here would mean a frame where other people are visible
//     before the gate closes — which is exactly the leak.
//
// The stored key is still pw-invisible. Renaming it would silently un-hide
// everyone who had already turned the old "Fly invisible" on, which is the one
// mistake this setting must never make.
//
// This mirror did not exist before: presence.js already read this key, and
// nothing had ever written it, so the old setting never actually hid presence.

export const FLY_SOLO_KEY = "pw-invisible";

export function isFlySolo() {
  try {
    return JSON.parse(localStorage.getItem(FLY_SOLO_KEY) || "false") === true;
  } catch {
    // Storage blocked. Fail visible rather than silently hiding someone who
    // never asked to be hidden.
    return false;
  }
}

export function mirrorFlySolo(on) {
  try {
    localStorage.setItem(FLY_SOLO_KEY, JSON.stringify(!!on));
  } catch { /* storage blocked; the server side still holds */ }
}

// When on, every read of other people returns its empty shape. Callers render
// their own quiet state from that, so no surface has to know about this switch.
export const soloEmpty = (value) => (isFlySolo() ? value : null);
