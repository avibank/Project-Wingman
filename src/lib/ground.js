/* =============================================================================
   Back on the ground — what the deck's data becomes on its way into the section.
   -----------------------------------------------------------------------------
   Pure, so check:ground can hold the two rules the pack says belong to the data
   rather than to the component:

   CHAPTER GRANULARITY ONLY. A person carries a chapter number and nothing
   finer. Presence rows arrive with more on them; none of it gets through.

   RIGHT SEATS ARE SQUADRON MATES. A squadron's members come from its roster and
   from nowhere else, so somebody who is only on the module can be on your route
   but never in the right seat card.
   ========================================================================= */
import { titleOf, excerptOf, isAnswered, answerCount, when, chatUnread } from "./roomModel.js";
import { currentLesson } from "../components/module/lessonState.js";

// What shows, from the student's own preset band and whether the room is on:
// Quiet skies nothing, My flight the right seat, Open frequency all three.
export function surfacesFor(band = [], roomOn = false) {
  return {
    seat: Boolean(roomOn && band.includes("wing")),
    squad: Boolean(roomOn && band.includes("freq")),
    module: Boolean(roomOn && band.includes("freq")),
  };
}

export const chapterNumber = (chapters, chapterId) => {
  const i = chapters.findIndex((c) => c.id === chapterId);
  return i >= 0 ? i + 1 : null;
};

// Everybody the section might draw, made the same way wherever they appear.
export function makePeople({ moduleCode, chapters = [], people = [], presence = [], seatCandidates = [], seat = null, flights = [] }) {
  const where = new Map();
  for (const r of seatCandidates) {
    if (r.module_code === moduleCode && r.chapter_id) where.set(r.user_id, chapterNumber(chapters, r.chapter_id));
  }
  for (const r of presence) if (r.chapter_id) where.set(r.user_id, chapterNumber(chapters, r.chapter_id));
  const flew = new Map(flights.map((f) => [f.userId, f.lastAt]));
  const nameOf = (id) => people.find((p) => p.id === id)?.callsign
    || presence.find((r) => r.user_id === id)?.display_name || "Pilot";
  const person = (id) => ({
    id,
    name: nameOf(id),
    category: null,
    chapter: where.get(id) ?? null,
    seat: Boolean(seat?.partnerId) && seat.partnerId === id,
    flewAt: flew.get(id) || null,
  });
  return { person, nameOf };
}

// Your squadron on this module. With more than one, the one that spoke last.
export function squadronFor({ me, moduleCode, squadrons = [], messages = [], person, nameOf }) {
  const lastAt = (list) => (list.length ? list[list.length - 1].createdAt : "");
  const pick = squadrons
    .filter((x) => x.moduleCode === moduleCode)
    .map((x) => ({ x, said: messages.filter((m) => m.squadronId === x.id && !m.deletedAt) }))
    .sort((a, b) => lastAt(b.said).localeCompare(lastAt(a.said)))[0];
  if (!pick) return null;
  return {
    id: pick.x.id,
    name: pick.x.name,
    members: (pick.x.members || []).filter((id) => id !== me).map(person),
    messages: pick.said.map((m) => ({
      id: m.id, who: nameOf(m.authorId), text: m.body || "Sent an attachment", mine: m.authorId === me,
    })),
    unread: chatUnread(messages, pick.x.id, pick.x.lastReadAt, me),
    quietSince: pick.said.length ? `Quiet since ${when(lastAt(pick.said))}` : "",
  };
}

// Squadron mates when the squadron shows, everyone on the module when the
// threads show, the right seat when the seat shows. Once each, never you.
export function routePeopleFor({ me, surfaces, squadron, presence = [], seat = null, person }) {
  const on = new Map();
  const put = (id) => { if (id && id !== me && !on.has(id)) on.set(id, person(id)); };
  if (surfaces.squad && squadron) squadron.members.forEach((p) => put(p.id));
  if (surfaces.module) presence.forEach((r) => put(r.user_id));
  if (surfaces.seat && seat?.partnerId) put(seat.partnerId);
  return [...on.values()];
}

// The module's threads, newest first, in the words the card uses.
export function threadsFor({ me, moduleCode, threads = [], replies = [], nameOf }) {
  return threads
    .filter((t) => t.moduleId === moduleCode)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .map((t) => {
      const answers = answerCount(t, replies);
      const best = t.bestReplyId ? replies.find((r) => r.id === t.bestReplyId) : null;
      const mine = t.authorId === me;
      const at = when(t.createdAt);
      return {
        id: t.id, title: titleOf(t), mine, answers,
        answeredBy: best ? nameOf(best.authorId) : null,
        when: at, excerpt: excerptOf(t),
        meta: [mine ? "Yours" : null,
          isAnswered(t) ? "Answered" : answers ? `${answers} ${answers === 1 ? "answer" : "answers"}` : "Needs an answer",
          at].filter(Boolean).join(" · "),
      };
    });
}

// "You are here" is the module screen's: the first lesson not yet done. Content
// without lessons falls back to the deck's next chapter.
export function moduleFor({ name, chapters = [], progress = {}, next = null }) {
  const here = currentLesson(chapters.map((c) => ({ ...c, lessons: c.lessons || [] })), progress);
  const hereAt = here ? chapters.findIndex((c) => c.id === here.chapter.id) : -1;
  const nextAt = next ? chapters.findIndex((c) => c.id === next.id) : -1;
  return {
    name,
    chapters: chapters.length,
    youChapter: hereAt >= 0 ? hereAt + 1 : nextAt >= 0 ? nextAt + 1 : Math.max(1, chapters.length),
  };
}
