// The contract content answers to.
//
// Validation fails loudly and says where. This file will be edited weekly
// during a semester, at speed, between classes — a typo has to produce a
// clear error rather than a blank chapter, because a blank chapter looks like
// a bug in the app and gets debugged as one.
const isStr = (v) => typeof v === "string" && v.length > 0;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

function check(cond, where, msg, errs) {
  if (!cond) errs.push(`${where}: ${msg}`);
  return cond;
}

/* One question's rules, shared by a quiz question and a study card, so the
   two cannot drift: a card IS a question read the other way round. */
function checkQuestion(q, w, errs) {
  check(isStr(q.question), w, "question must be a non-empty string", errs);
  check(Array.isArray(q.options) && q.options.length >= 2, w, "options must have at least two entries", errs);
  check(isNum(q.correct) && q.correct >= 0 && q.correct < (q.options?.length ?? 0),
    w, `correct must index one of the ${q.options?.length ?? 0} options`, errs);
}

export function validateContent(doc) {
  const errs = [];
  if (!doc || typeof doc !== "object") return ["root: not an object"];
  if (!check(Array.isArray(doc.modules), "root", "modules must be an array", errs)) return errs;

  const seen = new Set();
  doc.modules.forEach((m, mi) => {
    const w = `modules[${mi}]`;
    check(isStr(m.id), w, "id must be a non-empty string", errs);
    check(isStr(m.name), w, "name must be a non-empty string", errs);
    check(!seen.has(m.id), w, `duplicate module id ${m.id}`, errs);
    seen.add(m.id);
    if (!check(Array.isArray(m.chapters), w, "chapters must be an array", errs)) return;

    m.chapters.forEach((c, ci) => {
      const cw = `${w}.chapters[${ci}]`;
      check(isStr(c.id), cw, "id must be a non-empty string", errs);
      check(isStr(c.name), cw, "name must be a non-empty string", errs);
      check(!seen.has(c.id), cw, `duplicate chapter id ${c.id}`, errs);
      seen.add(c.id);
      if (!check(Array.isArray(c.lessons), cw, "lessons must be an array", errs)) return;

      c.lessons.forEach((l, li) => {
        const lw = `${cw}.lessons[${li}]`;
        check(isStr(l.id), lw, "id must be a non-empty string", errs);
        check(isStr(l.name), lw, "name must be a non-empty string", errs);
        check(!seen.has(l.id), lw, `duplicate lesson id ${l.id}`, errs);
        seen.add(l.id);
        // duration is the DISPLAY string ("9:56"); the real length is
        // video.seconds. Two fields rather than one derived from the other,
        // because a lesson can be listed before it is recorded — it has a
        // planned length and no video at all. A lesson with neither renders
        // as not yet recorded, which is a state, not an error.
        if (l.duration != null) check(/^\d+:[0-5]\d$/.test(String(l.duration)), lw, `duration must read m:ss, got ${JSON.stringify(l.duration)}`, errs);
        if (l.video != null) {
          check(isStr(l.video.src), `${lw}.video`, "src must be a non-empty string", errs);
          check(isNum(l.video.seconds) && l.video.seconds > 0, `${lw}.video`, "seconds must be a positive number", errs);
        }
      });

      if (c.quiz != null) {
        const qw = `${cw}.quiz`;
        check(isStr(c.quiz.id), qw, "id must be a non-empty string", errs);
        if (Array.isArray(c.quiz.questions)) {
          c.quiz.questions.forEach((q, qi) => checkQuestion(q, `${qw}.questions[${qi}]`, errs));
        }
      }

      /* A CHAPTER'S OWN STUDY CARDS (2026-09-21, owner request). Optional:
         without them the card set is the quiz's questions, as it always was.
         With them, each card is held to exactly the quiz question's rules,
         because StudyPad draws the back of a card from `correct` — a card
         whose answer indexes nothing flips over to a blank. Ids are held to
         their uniqueness by scripts/check-question-ids.mjs, across the quiz
         and the cards together, since a saved card is found by id. */
      if (c.cards != null) {
        if (check(Array.isArray(c.cards), cw, "cards must be an array", errs)) {
          c.cards.forEach((q, qi) => checkQuestion(q, `${cw}.cards[${qi}]`, errs));
        }
      }
    });

    /* DOWNLOADS — a file offered as a plain download and nothing else
       (2026-09-21, owner request). Not a paper: a paper opens in the reader
       and the reader is paused, while this is an <a download> to a file under
       public/. So the file must be a path on this site — no scheme, no
       leading slash, the loader adds that — and a PDF, because the row says
       "PDF". A page count is what the row prints, so it must be a real one. */
    if (m.downloads != null) {
      if (check(Array.isArray(m.downloads), w, "downloads must be an array", errs)) {
        m.downloads.forEach((d, di) => {
          const dw = `${w}.downloads[${di}]`;
          check(isStr(d.id), dw, "id must be a non-empty string", errs);
          check(!seen.has(d.id), dw, `duplicate id ${d.id}`, errs);
          seen.add(d.id);
          check(isStr(d.title), dw, "title must be a non-empty string", errs);
          check(isStr(d.file) && !/^[a-z][a-z0-9+.-]*:/i.test(d.file) && !d.file.startsWith("/")
              && !d.file.split("/").includes("..") && /\.pdf$/i.test(d.file),
            dw, `file must be a site-relative path to a .pdf, got ${JSON.stringify(d.file)}`, errs);
          check(isNum(d.pages) && d.pages > 0 && Number.isInteger(d.pages), dw, "pages must be a positive whole number", errs);
        });
      }
    }

    if (m.papers != null) {
      check(Array.isArray(m.papers), w, "papers must be an array", errs);
      (m.papers || []).forEach((p, pi) => {
        const pw = `${w}.papers[${pi}]`;
        check(isStr(p.id), pw, "id must be a non-empty string", errs);
        check(isStr(p.title), pw, "title must be a non-empty string", errs);
        if (p.pages != null) check(isNum(p.pages) && p.pages > 0, pw, "pages must be a positive number", errs);
      });
    }
  });
  // ---- the lesson surface's three objects -------------------------------
  // The rule worth validating is the one that cannot be seen by reading a
  // row: a thread with a lesson must carry a moment, and one without must
  // carry neither. That asymmetry is what keeps a module post out of every
  // lesson query, and a half-filled row would break it silently.
  const lessonIds = new Set();
  (doc.modules || []).forEach((m) => (m.chapters || []).forEach((c) =>
    (c.lessons || []).forEach((l) => lessonIds.add(l.id))));

  (doc.notes || []).forEach((n, i) => {
    const w = `notes[${i}]`;
    check(isStr(n.id), w, "id must be a non-empty string", errs);
    check(lessonIds.size === 0 || lessonIds.has(n.lessonId), w, `lessonId ${n.lessonId} matches no lesson`, errs);
    check(isNum(n.t) && n.t >= 0, w, "t must be a number of seconds", errs);
    // body may be "" on purpose — a bare pin is a valid note.
    check(typeof n.body === "string", w, "body must be a string, empty allowed", errs);
  });

  const threadIds = new Set();
  (doc.threads || []).forEach((t, i) => {
    const w = `threads[${i}]`;
    check(isStr(t.id), w, "id must be a non-empty string", errs);
    threadIds.add(t.id);
    check(isStr(t.body), w, "body must be a non-empty string", errs);
    const anchored = t.lessonId !== null && t.lessonId !== undefined;
    if (anchored) {
      check(lessonIds.size === 0 || lessonIds.has(t.lessonId), w, `lessonId ${t.lessonId} matches no lesson`, errs);
      check(isNum(t.t), w, "a thread with a lesson must carry the moment it is anchored to", errs);
    } else {
      check(t.t === null || t.t === undefined, w, "a module post has no lesson, so it must have no moment", errs);
    }
  });

  (doc.replies || []).forEach((r, i) => {
    const w = `replies[${i}]`;
    check(isStr(r.id), w, "id must be a non-empty string", errs);
    check(threadIds.size === 0 || threadIds.has(r.threadId), w, `threadId ${r.threadId} matches no thread`, errs);
    // A reply never carries a moment: it belongs to the thread, not the bar.
    check(r.t === undefined || r.t === null, w, "a reply must not carry a moment", errs);
  });

  return errs;
}
