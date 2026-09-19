/* =============================================================================
   THE FACE IS THIS APP'S. BUGS table row 1.
   -----------------------------------------------------------------------------
   `user.imageUrl` is never null — with no photo set Clerk serves a generated
   default from img.clerk.com — so `user?.imageUrl ? user.imageUrl : null` had
   an unreachable false branch, this app's initials never rendered, and the
   colour somebody picked painted nothing. `setProfileImage({ file: null })`
   throws, which is the error the owner saw.

   Both are gone, and this is what keeps them gone. Everything here is either a
   pure rule or a grep, so it runs without a browser or a database.

   Run: npm run check:avatar
   ========================================================================= */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  faceOf, isClerkImage, initialsOf, faceInk, faceInkText, clampPan, panLimit,
  PHOTO_ZOOM_MIN, PHOTO_ZOOM_MAX,
} from "../src/lib/avatar.js";
import { PALETTE } from "../src/lib/stamp.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
/* WITHOUT THE COMMENTS. Half this codebase's comments name the bug they
   prevent, and `setProfileImage` appears in four of them — a grep that counts
   an explanation as an occurrence can never go green. */
const code = (f) => readFileSync(f, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");
let fails = 0;
const ok = (name, cond, detail) => {
  if (!cond) fails++;
  console.log(`${cond ? "ok  " : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
};

const SRC = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|mjs)$/.test(p)) SRC.push(p);
  }
})("src");

/* ------------------------------------------------- Clerk is not the avatar */
{
  const reads = SRC.filter((f) => /\bimageUrl\b/.test(code(f)));
  ok("nothing reads Clerk's imageUrl any more", reads.length === 0, reads.join(" · "));
  const writes = SRC.filter((f) => /setProfileImage/.test(code(f)));
  ok("and nothing calls setProfileImage — it throws", writes.length === 0, writes.join(" · "));

  ok("a clerk.com url is treated as no photo",
     isClerkImage("https://img.clerk.com/abc") && isClerkImage("https://clerk.com/x")
     && !isClerkImage("https://x.supabase.co/storage/v1/object/public/avatars/u/avatar.webp"));
  ok("and faceOf refuses to draw one",
     faceOf({ photo_url: "https://img.clerk.com/eyJ0eXAi" }).photo === null);
  ok("the database refuses to store one too",
     /photo_url_not_clerk[\s\S]*?!~\* 'clerk/.test(read("supabase/migrations/0033_the_avatar_is_ours.sql")));
}

/* ------------------------------------------------------------- what a face is */
{
  const none = faceOf(null, { name: "Alex Rahman" });
  ok("with no row at all there is still a face", none.initials === "AR" && Boolean(none.fill));
  ok("and it is not a photo", none.photo === null);
  ok("initials are at most two letters", initialsOf("Maximilian Bartholomew Fitzgerald-R").length === 2);
  ok("an account with no name gets no letters rather than a question mark",
     initialsOf(null) === "" && initialsOf("") === "");

  const mine = faceOf({ cover_ink: "Ruby" }, { name: "Alex Rahman" });
  ok("the face takes the ink picked for the cover — one pick, two surfaces",
     faceInk({ cover_ink: "Ruby" }).n === "Ruby" && mine.fill.includes("22"));
  ok("an unknown ink falls back rather than rendering nothing",
     Boolean(faceOf({ cover_ink: "Puce" }).fill));

  const ours = "https://x.supabase.co/storage/v1/object/public/avatars/u/avatar.webp";
  const f = faceOf({ photo_url: ours, photo_zoom: 180, photo_x: 30, photo_y: -12 });
  ok("a photo carries the zoom and offset it was positioned at",
     f.photo === ours && f.zoom === 180 && f.x === 30 && f.y === -12);
  ok("a zoom outside the slider's range is brought back into it",
     faceOf({ photo_url: ours, photo_zoom: 9000 }).zoom === PHOTO_ZOOM_MAX
     && faceOf({ photo_url: ours, photo_zoom: 1 }).zoom === PHOTO_ZOOM_MIN);
  ok("and a pan beyond the slack the zoom creates is clamped, not drawn",
     faceOf({ photo_url: ours, photo_zoom: 120, photo_x: 99 }).x === Math.round(panLimit(120)));
  ok("at the minimum zoom there is no slack at all",
     panLimit(100) === 0 && clampPan(80, 100) === 0);
  ok("the offset is ignored entirely when there is no photo",
     faceOf({ photo_x: 40, photo_y: 40 }).x === 0);
}

/* --------------------------------------------------- legible on all 36 inks */
{
  const M = [[4.0767416621, -3.3077115913, .2309699292],
             [-1.2684380046, 2.6097574011, -.3413193965],
             [-.0041960863, -.7034186147, 1.7076147010]];
  const lin = (L, C, H) => {
    const h = H * Math.PI / 180, a = C * Math.cos(h), b = C * Math.sin(h);
    const v = [(L + .3963377774 * a + .2158037573 * b) ** 3,
               (L - .1055613458 * a - .0638541728 * b) ** 3,
               (L - .0894841775 * a - 1.2914855480 * b) ** 3];
    return M.map((r) => Math.min(1, Math.max(0, r[0] * v[0] + r[1] * v[1] + r[2] * v[2])));
  };
  const Y = (c) => .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  const ratio = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  const parse = (v) => {
    const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(String(v));
    return m ? { L: +m[1], C: +m[2], H: +m[3] } : null;
  };
  let worst = 99, where = "";
  for (const p of PALETTE) {
    const fg = parse(faceInkText({ cover_ink: p.n }));
    const r = ratio(Y(lin(fg.L, fg.C, fg.H)), Y(lin(p.l, p.c, p.h)));
    if (r < worst) { worst = r; where = p.n; }
  }
  /* Two letters at 36% of the circle is large text, so the floor is 3:1. The
     threshold the reference uses put white on Khaki at 2.67 — BUGS 13. */
  ok("initials clear the large-text floor on every one of the thirty-six inks",
     worst >= 3, `worst ${worst.toFixed(2)}:1 on ${where}`);
}

/* ------------------------------------------------------------ one component */
{
  const drawers = SRC.filter((f) => /<Avatar\b/.test(code(f)));
  ok("the card, the app bar, the composer and the picker all draw the same one",
     drawers.length >= 4, drawers.map((f) => f.split("/").pop()).join(" · "));

  const card = read("src/components/licence/LicenceCard.jsx");
  ok("the licence card no longer takes a photo prop of its own",
     !/photo\s*=\s*null/.test(card) && /<Avatar/.test(card));

  const menu = read("src/components/ProfileMenu.jsx");
  ok("the app bar draws a face rather than a glyph when somebody is signed in",
     /isSignedIn\s*\?\s*<Avatar/.test(menu.replace(/\s+/g, " ")));
  ok("and Fly solo hides your own face from you too",
     /const face = flySolo \? null : profile;/.test(menu));
  ok("the bar and the card read the same name, so the same person has one set of initials",
     /const faceName = profile\?\.real_name \|\| profile\?\.callsign \|\| label/.test(menu)
     /* and it is the one actually handed to the face, not merely computed */
     && /<Avatar[^>]*name=\{faceName\}/.test(menu.replace(/\s+/g, " ")));

  const avatar = read("src/components/Avatar.jsx");
  ok("a face that has not arrived has a loading state, not an empty ring",
     /loading/.test(avatar) && /is-loading/.test(avatar));

  const profile = read("src/components/Profile.jsx");
  ok('"use your initials" is one write and nothing that can throw',
     /patchCard\(\{ photo_url: null \}\)/.test(profile));
  ok("the full name is mirrored to the row, so no surface has to ask Clerk",
     /saveProfile\(user\.id, \{ real_name: clerkName \}\)/.test(profile));
}

/* ----------------------------------------------------------- what is stored */
{
  const sql = read("supabase/migrations/0033_the_avatar_is_ours.sql");
  for (const c of ["photo_url", "photo_zoom", "photo_x", "photo_y"]) {
    ok(`pilot_profiles carries ${c}`, new RegExp(`add column if not exists ${c}\\b`).test(sql));
  }
  ok("a photo url must live in this project's own public storage",
     /photo_url_is_ours[\s\S]*?storage\/v1\/object\/public/.test(sql));
  ok("the avatars bucket is public, capped and typed",
     /'avatars', 'avatars', true, 1048576/.test(sql));
  ok("and it has all three policies — the select one is what lets an upload work at all",
     /avatars_read/.test(sql) && /avatars_upload/.test(sql) && /avatars_replace/.test(sql));
  ok("one object per pilot, at their own id",
     /name = \(storage\.foldername\(name\)\)\[1\] \|\| '\/avatar\.webp'/.test(sql));
  ok("and the viewer's read carries the face, or everybody else sees the wrong one",
     /photo_url text, photo_zoom integer, photo_x integer, photo_y integer/.test(sql));
}

console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exitCode = fails ? 1 : 0;
