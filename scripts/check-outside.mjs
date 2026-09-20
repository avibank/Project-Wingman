/* THE THINGS THAT LEAVE THE APP. Run: npm run check:outside
 *
 * Half this class is on an iPhone and both of these were broken there in ways
 * that REPORT SUCCESS, which is the part that matters. A share that fails
 * loudly is a bug; a share that says "Link copied" over an empty clipboard is
 * a student pasting nothing into a group chat and wondering why nobody
 * answered.
 *
 * Driven against stand-in platforms rather than read off the source, because
 * every fault here is a runtime shape — `navigator.clipboard` being undefined,
 * `navigator.share` rejecting with AbortError, `canShare({files})` answering
 * false — and no regex can tell you what a missing API does to an optional
 * chain.
 */
let pass = 0; const fails = [];
const ok = (group, what, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok   ${group} · ${what}`); }
  else { fails.push(`${group} · ${what}`); console.log(`  FAIL ${group} · ${what}${detail ? ` — ${detail}` : ""}`); }
};

const { share, downloadBlob, SHARED, COPIED, CANCELLED, MANUAL, shareSaid, downloadSaid } =
  await import("../src/lib/outside.js");

const LINK = "https://www.wingman.institute/ready-room/M1/T-1";
/* Node 24 defines `navigator` as a getter-only global, so it is redefined
   rather than assigned. */
const set = (nav, doc) => {
  Object.defineProperty(globalThis, "navigator", { value: nav, configurable: true, writable: true });
  if (doc) Object.defineProperty(globalThis, "document", { value: doc, configurable: true, writable: true });
};
const fakeDoc = () => {
  const appended = [];
  return {
    _appended: appended,
    body: { appendChild: (el) => appended.push(el) },
    createElement: () => ({ click() { this.clicked = true; }, remove() { this.removed = true; }, set href(v) { this._href = v; }, get href() { return this._href; } }),
  };
};

/* ---- 1 · share, platform by platform ------------------------------------ */
console.log("\nshare");
{
  /* A phone with a share sheet. */
  let got = null;
  set({ share: async (d) => { got = d; } });
  ok("share", "a phone's own share sheet is tried first", await share(LINK, "A question") === SHARED);
  ok("share", "and it is handed the title and the url", got?.url === LINK && got?.title === "A question");

  /* THE ONE THAT WAS BROKEN: no clipboard at all. The old code was
     `navigator.clipboard?.writeText(url).then(...)`, which is `undefined.then`
     — a TypeError nothing caught, so the toast never fired and the control
     read as dead. */
  set({});
  ok("share", "a browser with neither answers `manual`, and does not throw",
     await share(LINK) === MANUAL);

  /* iOS Safari outside a secure context: clipboard is undefined. */
  set({ clipboard: undefined });
  ok("share", "an undefined clipboard is not a success", await share(LINK) === MANUAL);

  /* A desktop with a clipboard and no share sheet. */
  let written = null;
  set({ clipboard: { writeText: async (t) => { written = t; } } });
  ok("share", "the clipboard is awaited, and only then reported",
     await share(LINK) === COPIED && written === LINK);

  /* A clipboard that refuses — permission denied, or an insecure origin. */
  set({ clipboard: { writeText: async () => { throw new Error("denied"); } } });
  ok("share", "a refused clipboard is `manual`, never a claimed copy",
     await share(LINK) === MANUAL);

  /* A DISMISSED SHEET IS NOT A FAILURE, and must not fall through to the
     clipboard: copying a link somebody just decided not to send is the app
     overruling them. */
  let copied = false;
  set({ share: async () => { const e = new Error("x"); e.name = "AbortError"; throw e; },
        clipboard: { writeText: async () => { copied = true; } } });
  ok("share", "a dismissed sheet is cancelled, and nothing is copied behind it",
     await share(LINK) === CANCELLED && copied === false);

  /* A WebView that advertises share and then refuses it for another reason
     SHOULD fall through — that one is a failure, not a choice. */
  set({ share: async () => { throw new Error("not supported here"); },
        clipboard: { writeText: async () => { copied = true; } } });
  copied = false;
  ok("share", "a share that fails for any other reason falls through to the clipboard",
     await share(LINK) === COPIED && copied === true);

  ok("share", "an empty url never claims anything", await share("") === MANUAL);

  /* THE SENTENCE. Nothing may say "copied" unless a copy was observed. */
  ok("share", "only an observed copy is called one",
     shareSaid(COPIED) === "Link copied" && shareSaid(SHARED) === null
     && shareSaid(CANCELLED) === null && shareSaid(MANUAL) === null);
}

/* ---- 2 · downloadBlob --------------------------------------------------- */
console.log("\ndownload");
{
  const blob = { type: "application/pdf", size: 10 };
  globalThis.URL = { createObjectURL: () => "blob:x", revokeObjectURL: () => {} };
  globalThis.File = function File(parts, name, opts) { this.name = name; this.type = opts?.type; };

  /* iOS: the share sheet takes files, so it is offered before the anchor —
     which on iOS may simply navigate and leave the student looking at a file
     they cannot keep. */
  let sharedFiles = null;
  set({ canShare: (d) => !!d.files, share: async (d) => { sharedFiles = d; } }, fakeDoc());
  ok("dl", "a platform that can share files is offered it first",
     await downloadBlob(blob, "paper.pdf") === "shared" && sharedFiles?.files?.[0]?.name === "paper.pdf");

  /* Dismissing that sheet is a choice, not a failure. */
  set({ canShare: () => true, share: async () => { const e = new Error("x"); e.name = "AbortError"; throw e; } }, fakeDoc());
  ok("dl", "and dismissing it is not reported as a failure",
     await downloadBlob(blob, "paper.pdf") === "shared");

  /* A desktop: the anchor. */
  const doc = fakeDoc();
  set({ canShare: () => false }, doc);
  const r = await downloadBlob(blob, "log.md");
  ok("dl", "a desktop gets the anchor", r === "saved");
  /* APPENDED BEFORE THE CLICK — some browsers ignore a detached anchor. */
  ok("dl", "and the anchor is in the document before it is clicked",
     doc._appended.length === 1 && doc._appended[0].clicked === true);

  /* THE LIVE BUG: revoking on the next line. Safari and iOS cancel a download
     whose URL has already gone. */
  let revokedAt = null;
  const started = Date.now();
  globalThis.URL = { createObjectURL: () => "blob:y", revokeObjectURL: () => { revokedAt = Date.now() - started; } };
  set({ canShare: () => false }, fakeDoc());
  await downloadBlob(blob, "log.md");
  await new Promise((res) => setTimeout(res, 60));
  ok("dl", "the object URL is not revoked on the next line", revokedAt === null, String(revokedAt));

  ok("dl", "nothing to save is a failure, not a claim", await downloadBlob(null) === "failed");
  ok("dl", "and only a real save is called one",
     downloadSaid("saved", "paper.pdf") === "Saved paper.pdf"
     && downloadSaid("shared") === null
     && /Share button/.test(downloadSaid("opened"))
     && /did not save/.test(downloadSaid("failed")));
}

for (const k of ["navigator", "document", "URL", "File"]) { try { delete globalThis[k]; } catch { /* getter-only */ } }

/* ---- 3 · and nobody does it the old way any more ------------------------ */
console.log("\nand nowhere else");
{
  const { readdirSync, statSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const files = [];
  (function walk(d) {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(jsx?|mjs)$/.test(p)) files.push(p);
    }
  })("src");
  const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

  const rogueShare = files.filter((f) => f !== "src/lib/outside.js"
    && /navigator\.clipboard/.test(code(readFileSync(f, "utf8"))));
  ok("once", "nothing touches navigator.clipboard except the helper",
     rogueShare.length === 0, rogueShare.join(" "));

  /* A DOWNLOAD ANCHOR, not every object URL. The first version of this line
     failed Profile.jsx and attachments.js, and both were right: they make an
     object URL to SHOW something — a crop preview, an image being measured —
     and revoking it when the sheet closes is correct. What must not be built
     by hand is a download, because that is where the ordering matters and
     where LogTab revoked on the line after the click. */
  const rogueDownload = files.filter((f) => f !== "src/lib/outside.js"
    /* THE PAUSED READER IS LEFT ALONE. `paper/v6/marks.js` builds its own
       anchor for the marks export, and it is the one that got the revoke
       RIGHT — a four-second timeout — which is where this helper's timing came
       from. The pause was explicitly "not one line of it is touched", none of
       it is in the build and none of it is reachable, so rewriting it to use
       a helper would be editing dead code for tidiness. It comes through this
       check the day the reader comes back. */
    && !f.startsWith("src/components/paper/")
    && /\.download\s*=/.test(code(readFileSync(f, "utf8"))));
  ok("once", "and nothing builds a download anchor by hand",
     rogueDownload.length === 0, rogueDownload.join(" "));
}

/* ---- 4 · the two that opened nothing ------------------------------------ */
console.log("\nthe two dead buttons");
{
  const { readFileSync } = await import("node:fs");
  const profile = readFileSync("src/components/Profile.jsx", "utf8");
  const routes = readFileSync("src/lib/routes.js", "utf8");
  const app = readFileSync("src/App.jsx", "utf8");

  /* They called onNavigate("account"); "account" is not one of the three
     profile tabs, so `path.profile` fell back to /account/licence — the page
     you were already on. Pressing either did nothing at all. */
  /* Code only — the comment above the rows names the call it replaced, which
     is the explanation, not the bug. Third time today; see the two helpers of
     the same shape in check-exam.mjs. */
  const bare = (t) => t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");
  ok("account", "neither button asks for a tab that does not exist",
     !/onNavigate\("account"\)/.test(bare(profile)));
  ok("account", "Change goes to the email flow and Update to the security one",
     /onClick=\{\(\) => onNavigate\("email"\)\}/.test(profile)
     && /onClick=\{\(\) => onNavigate\("security"\)\}/.test(profile));
  ok("account", "and those two are routed to Clerk rather than back to a tab",
     /t === "security" \|\| t === "email"/.test(app) && /routePath\.clerk\(t\)/.test(app));

  /* A route only exists if it survives a refresh. */
  ok("account", "both addresses parse",
     /parts\[1\] === "security"/.test(routes) && /parts\[1\] === "email"/.test(routes));
  ok("account", "and the app answers the route name", /route\.name === "clerk"/.test(app));

  /* Clerk owns the flows — nothing here may build a password form. */
  const portal = readFileSync("src/components/AccountPortal.jsx", "utf8");
  ok("account", "Clerk's own component does the work, not a form built here",
     /<UserProfile/.test(portal)
     && !/type="password"|newPassword|currentPassword/.test(portal));

  /* THE PASSWORD ROW TELLS THE TRUTH. It said "Managed by your sign-in
     provider" to everybody — true of a Google account, false of an
     email-and-password one, and sitting next to a button offering to update
     the password it had just called somebody else's. */
  ok("account", "the password row reads the account rather than assuming",
     /user\?\.passwordEnabled/.test(profile) && /function signInWith/.test(profile));
}

console.log(`\noutside: ${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
