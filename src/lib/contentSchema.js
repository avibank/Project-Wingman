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
          c.quiz.questions.forEach((q, qi) => {
            const w2 = `${qw}.questions[${qi}]`;
            check(isStr(q.question), w2, "question must be a non-empty string", errs);
            check(Array.isArray(q.options) && q.options.length >= 2, w2, "options must have at least two entries", errs);
            check(isNum(q.correct) && q.correct >= 0 && q.correct < (q.options?.length ?? 0),
              w2, `correct must index one of the ${q.options?.length ?? 0} options`, errs);
          });
        }
      }
    });

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
  return errs;
}
