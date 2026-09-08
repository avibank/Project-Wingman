#!/usr/bin/env node
/* =============================================================================
   CLEAR THE PLACEHOLDER PAPERS.
   -----------------------------------------------------------------------------
   Brief §17b. The reader is handed to two real students with real course
   material, and the generated stand-ins ("Notes", "Worked examples", "Reference
   sheet", "Handout", "Summary", "Everything on one sheet", "Practice set") go.

   What this touches, and nothing else:

     src/content/test-content.json   every module's `papers` array is emptied
     public/papers/placeholder-*.pdf the generated files are deleted
     paper_annotations, paper_ink    rows pointing at a removed paper

   What it must never touch, and does not: users, profiles, modules, lessons,
   chapters, quizzes, Ready Room threads or replies, or progress. There is one
   SQL statement per table and each is restricted by `paper_id in (…)`.

   -----------------------------------------------------------------------------
   A STUDENT'S MARKS ARE NOT PLACEHOLDER CONTENT.

   §17b says never delete a student's marks — and then says that if a
   placeholder paper has marks on it, both go together. Those are only
   compatible one way: the marks are BACKED UP FIRST, in full, as INSERT
   statements that restore them exactly, and the run refuses to start if it
   cannot write that file. Deleting a mark you cannot put back is the one thing
   this script will not do.

   Dry by default. Nothing happens without --apply.

     node scripts/clear-placeholder-content.mjs                 what it would do
     node scripts/clear-placeholder-content.mjs --apply         do it
     node scripts/clear-placeholder-content.mjs --restore <dir> put it all back

   Re-runnable: a second --apply finds nothing to do and says so.
   ========================================================================= */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
/* THE FILES AND THE ROWS ARE TWO DIFFERENT DECISIONS.

   The fixture and the generated PDFs are code: they arrive in a diff, they are
   reviewable, and putting them back is a `git checkout`. The marks are
   PRODUCTION DATA belonging to a real account, and the instruction for this run
   was explicit — do not run migrations against production; I will run them
   myself after I have checked. So --apply does the files, and the rows need
   --rows on top of it, which is a second, deliberate decision made by a person
   who has read the backup. */
const ROWS = argv.includes("--rows");
const RESTORE = argv.includes("--restore") ? argv[argv.indexOf("--restore") + 1] : null;

const CONTENT = join(ROOT, "src/content/test-content.json");
const PAPERS_DIR = join(ROOT, "public/papers");
const BACKUPS = join(ROOT, "backups");

const say = (...a) => console.log(...a);
const sql = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const jsonl = (v) => (v === null || v === undefined ? "null" : `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`);

/* --------------------------------------------------------------- restore -- */
async function restore(dir) {
  const from = join(BACKUPS, dir);
  if (!existsSync(from)) { console.error(`No backup at ${from}`); process.exit(2); }

  const content = join(from, "test-content.json");
  if (existsSync(content)) { copyFileSync(content, CONTENT); say("· test-content.json put back"); }

  const files = join(from, "papers");
  if (existsSync(files)) {
    for (const f of readdirSync(files)) {
      copyFileSync(join(files, f), join(PAPERS_DIR, f));
      say(`· ${f} put back`);
    }
  }

  const rows = join(from, "rows.sql");
  if (existsSync(rows)) {
    const client = await connect();
    if (client) {
      await client.query(readFileSync(rows, "utf8"));
      await client.end();
      say("· marks and ink put back");
    } else {
      say("! could not reach the database — run rows.sql by hand:", rows);
    }
  }
  say(`\nRestored from ${from}`);
}

async function connect() {
  const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!url) return null;
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try { await client.connect(); return client; } catch { return null; }
}

/* ------------------------------------------------------------------ main -- */
if (RESTORE) { await restore(RESTORE); process.exit(0); }

const content = JSON.parse(readFileSync(CONTENT, "utf8"));

/* Every paper about to go, by id, so the database statements can be scoped to
   exactly these and nothing else. */
const going = [];
for (const m of content.modules || []) {
  for (const p of m.papers || []) going.push({ ...p, module: m.id });
}

const placeholderFiles = existsSync(PAPERS_DIR)
  ? readdirSync(PAPERS_DIR).filter((f) => f.startsWith("placeholder-") && f.endsWith(".pdf"))
  : [];

say("\nPlaceholder papers to remove\n");
if (!going.length) say("  (none — the fixture already has no papers)");
for (const m of content.modules || []) {
  const own = m.papers || [];
  say(`  ${m.id}  ${own.length ? own.map((p) => p.id).join(" ") : "(already empty)"}`);
}
say(`\nGenerated files to delete: ${placeholderFiles.length ? placeholderFiles.join(", ") : "(none)"}`);

/* --------------------------------------------------------------- the DB --- */
const client = await connect();
let marks = [], ink = [];
if (client && going.length) {
  const ids = going.map((p) => sql(p.id)).join(",");
  marks = (await client.query(`select * from paper_annotations where paper_id in (${ids})`)).rows;
  ink = (await client.query(`select * from paper_ink where paper_id in (${ids})`)).rows;
} else if (!client) {
  say("\n! No database connection (SUPABASE_DB_URL). Rows will not be touched.");
}

say(`\nMarks attached to those papers: ${marks.length}`);
for (const m of marks) say(`  ${m.paper_id}  ${m.kind}  by ${m.author_id}`);
say(`Ink strokes attached:            ${ink.length}`);

if (!APPLY) {
  say("\nDry run. Nothing was changed. Add --apply to do it.");
  process.exit(0);
}

/* ------------------------------------------------------------- back up --- */
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dir = join(BACKUPS, `content-clearout-${stamp}`);
mkdirSync(join(dir, "papers"), { recursive: true });

copyFileSync(CONTENT, join(dir, "test-content.json"));
for (const f of placeholderFiles) copyFileSync(join(PAPERS_DIR, f), join(dir, "papers", f));

/* The rows, as statements that put them back exactly — ids included, so a
   restored mark is the SAME mark and anything pointing at it still resolves. */
const lines = ["-- Restores every mark and stroke this clear-out removed.", "begin;"];
for (const m of marks) {
  lines.push(`insert into paper_annotations (id,paper_id,module_code,paper_version,author_id,kind,ring,body,colour,thread_id,resolved_at,status,anchor,hint,created_at,updated_at) values (${
    [sql(m.id), sql(m.paper_id), sql(m.module_code), m.paper_version, sql(m.author_id), sql(m.kind), sql(m.ring),
     sql(m.body), sql(m.colour), sql(m.thread_id), m.resolved_at ? sql(m.resolved_at.toISOString()) : "null",
     sql(m.status), jsonl(m.anchor), jsonl(m.hint),
     sql(m.created_at.toISOString()), sql(m.updated_at.toISOString())].join(",")
  }) on conflict (id) do nothing;`);
}
for (const k of ink) {
  lines.push(`insert into paper_ink (id,paper_id,module_code,paper_version,author_id,page,tool,colour,width,ring,points,created_at) values (${
    [sql(k.id), sql(k.paper_id), sql(k.module_code), k.paper_version, sql(k.author_id), k.page, sql(k.tool),
     sql(k.colour), k.width, sql(k.ring), jsonl(k.points), sql(k.created_at.toISOString())].join(",")
  }) on conflict (id) do nothing;`);
}
lines.push("commit;");
writeFileSync(join(dir, "rows.sql"), `${lines.join("\n")}\n`);
say(`\nBacked up to  backups/content-clearout-${stamp}/`);

/* --------------------------------------------------------------- do it --- */
let removedRows = 0;
if (client && going.length && !ROWS) {
  await client.end();
  say("\n· Marks LEFT ALONE. They belong to a real account and this run does not");
  say("  touch production data. When you are happy with the backup, re-run with:");
  say("    node --env-file=.env.local scripts/clear-placeholder-content.mjs --apply --rows");
} else if (client && going.length) {
  const ids = going.map((p) => sql(p.id)).join(",");
  const a = await client.query(`delete from paper_annotations where paper_id in (${ids})`);
  const b = await client.query(`delete from paper_ink where paper_id in (${ids})`);
  removedRows = a.rowCount + b.rowCount;
  await client.end();
}

/* MODULE 1 KEEPS EVERYTHING ELSE. Only `papers` is emptied, on every module —
   its lessons, chapters, quizzes and structure are untouched, because it stays
   the testing bed. */
for (const m of content.modules || []) m.papers = [];
writeFileSync(CONTENT, `${JSON.stringify(content, null, 2)}\n`);

for (const f of placeholderFiles) unlinkSync(join(PAPERS_DIR, f));

say(`\nRemoved`);
say(`  papers from the fixture   ${going.length}`);
say(`  generated PDFs deleted    ${placeholderFiles.length}`);
say(`  marks and strokes deleted ${removedRows}`);
say(`\nPut it all back with:`);
say(`  node scripts/clear-placeholder-content.mjs --restore content-clearout-${stamp}`);
