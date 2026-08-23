// Produces supabase/SETUP.sql: the whole schema plus the two rows that are not
// schema but without which the app is not actually usable.
//
// Comments are stripped so the result is short enough to paste comfortably; the
// annotated source is the numbered files in supabase/migrations/.
//
// Run: node scripts/build-setup-sql.mjs

import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const dir = new URL("../supabase/migrations/", import.meta.url);
const files = readdirSync(dir)
  .filter((f) => /^\d{4}_.*\.sql$/.test(f) && Number(f.slice(0, 4)) >= 5)
  .sort();

const strip = (sql) =>
  sql
    .split("\n")
    .filter((l) => !/^\s*--/.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const schema = files
  .map((f) => `-- ${f}\n\n${strip(readFileSync(new URL(f, dir), "utf8"))}`)
  .join("\n\n\n");

const setup = `-- Setup. Neither of these is schema, and neither default is what you want.

-- §10 — one cohort, one module. Until a module has a row here, no channel is
-- gated and every one shows. Change 'JT' if your first cohort is elsewhere.
insert into module_social (module_code, enabled, enabled_at) values ('JT', true, now())
  on conflict (module_code) do update set enabled = true, enabled_at = now();

-- §11 — everyone starts at 'student', and only CFI standing can mark an
-- explanation verified. Replace the id with yours from the Clerk dashboard.
-- A wrong id updates zero rows and harms nothing, so check it took:
--   select user_id, status from pilot_profiles where status = 'cfi';
update pilot_profiles set status = 'cfi' where user_id = 'YOUR_CLERK_USER_ID';`;

const out = `-- ============================================================================
-- Project Wingman — full setup. Run as one paste, top to bottom.
--
-- Safe to run on a fresh database or one that already has some of this: every
-- statement is guarded, including the two check constraints that were not in
-- the first version of this file.
--
-- Assumes migrations 0001-0004 are already applied.
-- ============================================================================


${schema}


-- ============================================================================
${setup}
`;

writeFileSync(new URL("../supabase/SETUP.sql", import.meta.url), out);
console.log(`SETUP.sql: ${out.split("\n").length} lines from ${files.length} migrations`);
