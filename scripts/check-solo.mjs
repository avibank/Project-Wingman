/* =============================================================================
   FLY SOLO — "Nobody sees you and you see nobody."
   -----------------------------------------------------------------------------
   §6 of the launch handoff: "Fly solo must actually hide the student from Crew,
   the route strip, the radar and presence, and hide others from them." Two
   halves, and they fail differently:

     OUTBOUND  you see nobody. Every read of other people returns its empty
               shape. A missed one shows a face to somebody who asked not to
               see any — visible, annoying, harmless.
     INBOUND   nobody sees you. A missed one shows YOUR face to a stranger
               after you asked it not to. That one is a broken promise, and
               it is invisible from your own screen — which is why it needs a
               check rather than a look.

   THE INBOUND HALF CANNOT BE DONE ON YOUR DEVICE, and this file's job is to
   keep both halves honest:
     · the switch writes pilot_profiles.invisible, which is the only half
       other people's queries can see;
     · every query for other people excludes an invisible row;
     · presence is gated at the WRITE and the row is deleted, so there is
       nothing for anybody to read — the only surface where the inbound half
       needs no cooperation from the reader.

   Run: npm run check:solo
   ========================================================================= */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { FLY_SOLO_KEY, isFlySolo, soloEmpty } from "../src/lib/flySolo.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
let fails = 0;
const ok = (name, cond, detail) => {
  if (!cond) fails++;
  console.log(`${cond ? "ok  " : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
};

/* ------------------------------------------------------------- the switch */
{
  ok("the stored key is still pw-invisible", FLY_SOLO_KEY === "pw-invisible",
     "renaming it silently un-hides everybody who already turned it on");
  /* No localStorage in node: the module must survive that rather than throw,
     because a browser with storage blocked reaches the same branch — and it
     must fail VISIBLE, never silently hide somebody who did not ask. */
  ok("with no storage at all it fails visible, not hidden", isFlySolo() === false);
  /* soloEmpty(x) is "x when the switch is on, otherwise no override". It
     reads backwards at a glance, which is worth one assertion: off, it hands
     back null so the caller carries on and does its real query. */
  ok("soloEmpty is an override, not a default — off it overrides nothing",
     soloEmpty([1, 2]) === null);

  const profile = read("src/components/Profile.jsx");
  ok("turning it on writes BOTH halves",
     /progress\.set\(FLY_SOLO_KEY, on\)/.test(profile)
     && /mirrorFlySolo\(on\)/.test(profile)
     && /saveProfile\(user\.id, \{ invisible: on \}\)/.test(profile));
  ok("and clears presence immediately rather than on the next beat",
     /if \(on && user\?\.id\) clearPresence\(user\.id\)/.test(profile),
     "the beat is every 45s; nobody sees you cannot start a minute late");
  /* `.lab` rather than `.eyebrow`: Preferences was rebuilt from the
     reference's own markup (09-preferences.html) on 2026-09-19, and the box
     gained a description line and a choice row above the switch, so the
     window is wider than it was. Same rule, same box, same switch. */
  ok("the switch lives in Preferences, under How social (§6)",
     /<p className="lab">How social<\/p>[\s\S]{0,2600}?id="fly-solo"/.test(profile));
}

/* ------------------------------------------------- outbound: you see nobody
   WHICH FUNCTIONS THIS IS ABOUT, named rather than pattern-matched. "Every
   exported async function" is the wrong net: most of these files are writes,
   and several reads are about people you are ALREADY WITH rather than people
   you might meet. Gating those would hide your own squadron from you.

   So: two lists, both named, and a third assertion that every exported async
   function in these files is on one of them. A new one fails the build until
   somebody decides which it is — the shape check:doors uses for its own
   exceptions, and for the same reason: a silent default is how a leak gets in.
*/
{
  const FILES = [
    "src/lib/presence.js", "src/lib/crew.js", "src/lib/comms.js",
    "src/lib/readyRoom.js", "src/lib/rightSeat.js", "src/lib/roomData.js",
    "src/lib/partners.js",
  ];

  /* ANSWERS "WHO ELSE IS THERE". Each of these can put a stranger, or a
     stranger's words, in front of somebody who asked to see none. */
  const MUST_BE_GATED = new Set([
    // presence: where anybody is
    "fetchChapterPresence", "fetchModulePresence", "fetchAllPresence",
    // the module's crew, and the chapter's chat
    "fetchCrew", "fetchMessages", "fetchPinned",
    // the room: questions asked, and study sessions you could walk into
    "fetchOpenSquawks", "fetchFormations",
    // the right seat, both directions
    "fetchSeat", "fetchSeatRequests", "fetchRightSeat",
    // people the app would put in front of you
    "fetchWingmen", "fetchOpenSessions", "fetchPartnerSuggestions",
  ]);

  /* NOT ABOUT MEETING ANYBODY, and each line says which kind it is:
       write      it changes something; there is nobody to show
       already    people you are already with — your squadron, a formation you
                  joined, a session you were in. Hiding those would hide your
                  own membership from you, which is not what the switch says.
       yours      your own things
       content    counts and reactions on something already on your screen */
  const NOT_ABOUT_PEOPLE = new Map(Object.entries({
    heartbeat: "write", clearPresence: "write", touch: "write",
    setNotify: "write", sendMessage: "write", pinToChapter: "write",
    maybePostOpener: "write", postSquadronMessage: "write",
    deleteMessage: "write", markDelivered: "write", markRead: "write",
    react: "write", pin: "write", unpin: "write", editMessage: "write",
    uploadAttachment: "write", addAttachments: "write",
    askRightSeat: "write", cancelRightSeat: "write", answerRightSeat: "write",
    endRightSeat: "write", seatHeartbeat: "write", postSeatMessage: "write",
    keepSeatMessage: "write", sweepSeats: "write", createSquadron: "write",
    joinSquadron: "write", leaveSquadron: "write", renameSquadron: "write",
    setMuted: "write", recordCompletion: "write", bumpJointStreak: "write",
    markAnswer: "write", markVerified: "write", createTeam: "write",
    leaveTeam: "write", joinFormation: "write", leaveFormation: "write",
    startFormation: "write", toggleReaction: "write", pinMessage: "write",
    removeWingman: "write", startCopilotSession: "write", endCopilotSession: "write",
    postQuestion: "write", postAnswer: "write", reportContent: "write",
    muteUser: "write", blockUser: "write", vote: "write", endorse: "write",
    saveProfile: "write",

    fetchMySquadrons: "already", fetchSquadronMessages: "already",
    fetchSeatMessages: "already", fetchFormationMembers: "already",
    fetchFlightLog: "already", fetchJointStreak: "already",
    fetchMyTeams: "already", fetchTeamMembers: "already",
    fetchReceipts: "already", fetchSharedCompletions: "already",

    fetchMyReactions: "yours", fetchMyCompletions: "yours",
    socialEnabledModules: "yours", fetchProfileStatus: "yours",

    fetchReactions: "content", fetchThreadVotes: "content",
    fetchProgressByModule: "content", voteThread: "write",
    setQuestion: "write", joinTeam: "write", addWingman: "write",
    recordStudyDay: "write", joinCopilotSession: "write",
    leaveCopilotSession: "write", markSquadronRead: "write",
    setSquadronMuted: "write", takeRateSlot: "write",
  }));

  const ungated = [];
  const unclassified = [];
  for (const f of FILES) {
    const src = read(f);
    for (const m of src.matchAll(/export async function (\w+)\(/g)) {
      const name = m[1];
      const body = src.slice(m.index, m.index + 640);
      if (MUST_BE_GATED.has(name)) {
        /* 640 rather than 500: fetchCrew's gate now carries the dev fixture in
           the same expression (`isFlySolo() && !demoOn()`), and the paragraph
           explaining why pushed the line past the old window. What is being
           asserted has not moved — the gate is still the first thing the
           function does with a person's data. */
        if (!/isFlySolo\(\)/.test(body)) ungated.push(`${f.split("/").pop()}:${name}`);
      } else if (!NOT_ABOUT_PEOPLE.has(name)) {
        unclassified.push(`${f.split("/").pop()}:${name}`);
      }
    }
  }
  ok("every read of other people is gated, first thing",
     ungated.length === 0, ungated.join(" · "));
  ok("and nothing in these files is unclassified",
     unclassified.length === 0,
     unclassified.length
       ? `${unclassified.join(" · ")} — add it to MUST_BE_GATED or say which kind it is`
       : "");

  /* And the gate returns the EMPTY SHAPE the caller expects, never null into
     a .map(). This is the literal crew's own gate returns. */
  const shapes = read("src/lib/crew.js");
  ok("crew's gate returns the shape the screen renders, with solo said out loud",
     /const none = \{ people: \[\], onNow: 0, finished: 0, solo: true \}/.test(shapes)
     /* `&& !demoOn()` is the dev fixture, and it is IN the gate rather than in
        front of it so that this assertion still reads one expression. */
     && /if \(isFlySolo\(\) && !demoOn\(\)\) return none;/.test(shapes));
}

/* ------------------------------------------------ inbound: nobody sees you */
{
  const crew = read("src/lib/crew.js");
  ok("Crew drops an invisible profile from everything it draws",
     /\.filter\(\(p\) => !p\.invisible\)/.test(crew));
  ok("and it selects `invisible` in order to be able to",
     /select\([^)]*invisible/.test(crew));

  const squad = read("src/lib/squadron.js");
  ok("the roster asks the server for visible rows only",
     /\.eq\("invisible", false\)/.test(squad));

  const presence = read("src/lib/presence.js");
  ok("presence is gated at the WRITE, so there is nothing to read",
     /if \(isFlySolo\(\)\) \{\s*await clearPresence\(userId\);\s*return;\s*\}/.test(presence));

  const sql = read("supabase/migrations/0030_licence_card.sql");
  ok("a licence card is refused for somebody flying solo", /p\.invisible = false/.test(sql));

  /* 0011's discovery functions are the other server-side half. people_search
     and the suggestions are where a stranger would find somebody. */
  /* 0011's people_search filtered on `discoverable`, which is a DIFFERENT
     setting — 0011's opt-out of being suggested. A student who had never
     touched it stayed findable by name while flying solo: type their callsign
     into Discover and there they were. 0032 is the one line that fixes it,
     written against the LIVE body (0012's, not 0011's) because replacing
     0011's text would have changed the return type and undone 0012's rule. */
  const solo = read("supabase/migrations/0032_fly_solo_on_the_server.sql");
  /* Each body on its own. A regex that scans to the end of the file finds the
     OTHER function's line and passes with this one's deleted — which is what
     it did, and what planting the bug showed. */
  const bodyOf = (name) => {
    const at = solo.indexOf(`create or replace function ${name}(`);
    return at < 0 ? "" : solo.slice(at, solo.indexOf("$$;", at));
  };
  ok("search on the server excludes somebody flying solo",
     /not coalesce\(p\.invisible, false\)/.test(bodyOf("people_search")));
  ok("and so does the roster — but you are still on your own",
     /m\.user_id = uid or not coalesce\(p\.invisible, false\)/.test(bodyOf("squadron_roster")));
  ok("discoverable and invisible are not the same setting, and both are kept",
     /p\.discoverable/.test(solo) && /not coalesce\(p\.invisible, false\)/.test(solo));
}

/* --------------------------------------------- nothing else reads the key
   The point of flySolo.js is that no surface has to know about this switch.
   A component reading pw-invisible directly is a surface that has an opinion,
   and the four that legitimately do are named. */
{
  const files = [];
  (function walk(dir) {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(jsx?|mjs)$/.test(p)) files.push(p);
    }
  })("src");
  const ALLOWED = new Set([
    "src/lib/flySolo.js",
    "src/App.jsx",                       // hides your own face in the app bar
    "src/components/Profile.jsx",        // the switch itself
    "src/components/ProfileMenu.jsx",    // the same face in the menu
    "src/components/module/LessonPage.jsx", // and in the composer
    /* A FIFTH SITE, AND IT DOES NOT READ THE KEY — IT PROTECTS IT.
       The storage epoch sweeps every `pw-` key that is not a device
       preference, so it has to be able to NAME the one key that must survive:
       Fly solo is a safety decision, not a setting, and the SQL wipe keeps
       `blocks` and `mutes` on exactly that reasoning. It imports FLY_SOLO_KEY
       from flySolo.js rather than writing the string out, which is the rule
       this assertion is really about.

       The rule is unchanged in substance — nobody decides whether somebody is
       flying solo except `isFlySolo()` — and that half is still asserted
       above. What is widened is the list of files allowed to mention the key
       at all, by one, with the reason. */
    "src/lib/storage.js",
  ]);
  const rogue = files.filter((f) => !ALLOWED.has(f)
    && /FLY_SOLO_KEY|["']pw-invisible["']/.test(readFileSync(f, "utf8")));
  ok("only the switch and the four faces read the key directly",
     rogue.length === 0, rogue.join(" · "));
  /* And the new one may name it, not act on it. */
  const sweep = readFileSync("src/lib/storage.js", "utf8");
  ok("the epoch names Fly solo's key to keep it, and never reads its value",
     /import \{ FLY_SOLO_KEY \} from "\.\/flySolo\.js";/.test(sweep)
     && /KEEP = new Set\(\[[\s\S]*?FLY_SOLO_KEY[\s\S]*?\]\)/.test(sweep)
     && !/isFlySolo|getItem\(FLY_SOLO_KEY|JSON\.parse\([^)]*FLY_SOLO_KEY/.test(sweep));
}

console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exitCode = fails ? 1 : 0;
