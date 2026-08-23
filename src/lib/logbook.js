// §9.5 — Home answers "what do I do now"; the Logbook answers "how am I doing".
// Holding that line means the Logbook carries the analysis Home is not allowed
// to: accuracy over time, the weakest module, questions missed twice, and
// chapters due for another pass.
//
// Pure, so every rule is checkable without a database.

export const REVISIT_DAYS = 14;
export const WEAK_SCORE = 70;

// Attempts are { question_id, chapter_id, correct, created_at }.
export function missedTwice(attempts = []) {
  const byQuestion = new Map();
  for (const a of attempts) {
    if (a.correct) continue;
    const n = byQuestion.get(a.question_id) || { question_id: a.question_id, chapter_id: a.chapter_id, misses: 0, last: null };
    n.misses += 1;
    const at = new Date(a.created_at).getTime();
    if (Number.isFinite(at) && (!n.last || at > n.last)) n.last = at;
    byQuestion.set(a.question_id, n);
  }
  return [...byQuestion.values()].filter((q) => q.misses >= 2).sort((a, b) => b.misses - a.misses);
}

// Lowest average score, but only across modules actually attempted — a module
// you have never opened is not your weakest, it is simply ahead of you.
export function weakestModule(scores = {}, chapterModule = () => null) {
  const byModule = {};
  for (const [chapterId, pct] of Object.entries(scores)) {
    if (typeof pct !== "number") continue;
    const code = chapterModule(chapterId);
    if (!code) continue;
    (byModule[code] = byModule[code] || []).push(pct);
  }
  const rows = Object.entries(byModule).map(([code, list]) => ({
    code,
    average: Math.round(list.reduce((a, b) => a + b, 0) / list.length),
    chapters: list.length,
  }));
  if (rows.length < 2) return null;   // "weakest" is meaningless with one module
  return rows.sort((a, b) => a.average - b.average)[0];
}

// Completed a while ago, or passed narrowly. Both are reasons to fly it again.
export function dueForAnotherPass(completions = [], scores = {}, now = Date.now()) {
  const cutoff = now - REVISIT_DAYS * 86400e3;
  return completions
    .map((c) => {
      const at = new Date(c.completed_at).getTime();
      const score = scores[c.chapter_id];
      const stale = Number.isFinite(at) && at < cutoff;
      const shaky = typeof score === "number" && score < WEAK_SCORE;
      if (!stale && !shaky) return null;
      return {
        chapter_id: c.chapter_id,
        score: typeof score === "number" ? score : null,
        reason: shaky && stale ? "scraped it, and a while ago"
              : shaky ? `scraped it at ${score}%`
              : `${Math.floor((now - at) / 86400e3)} days ago`,
      };
    })
    .filter(Boolean);
}

// Accuracy per day, oldest first, for a small sparkline. Days with no attempts
// are absent rather than zero — a day you did not study is not a day you got
// everything wrong.
export function accuracyOverTime(attempts = []) {
  const byDay = new Map();
  for (const a of attempts) {
    const t = new Date(a.created_at);
    if (!Number.isFinite(t.getTime())) continue;
    const key = t.toDateString();
    const n = byDay.get(key) || { day: key, at: t.getTime(), right: 0, total: 0 };
    n.total += 1;
    if (a.correct) n.right += 1;
    byDay.set(key, n);
  }
  return [...byDay.values()]
    .sort((a, b) => a.at - b.at)
    .map((d) => ({ day: d.day, pct: Math.round((d.right / d.total) * 100), total: d.total }));
}
