// Course content — a neutral skeleton.
//
// Four modules, five chapters each, two lessons per chapter. No videos, no
// questions, no authored prose: the design is not to be judged wearing
// placeholder content that implies the product is further along than it is.
//
// The previous mock set — twenty aviation chapters with bodies, clips and a
// 42-question bank — is in git history and nothing was removed from the
// database. Progress rows keyed to the old chapter ids are orphaned, not
// deleted.

const MODULES = [
  { code: "M1", name: "Module 1", status: "active", order: 1 },
  { code: "M2", name: "Module 2", status: "active", order: 2 },
  { code: "M3", name: "Module 3", status: "active", order: 3 },
  { code: "M4", name: "Module 4", status: "active", order: 4 },
];

const CHAPTERS = [
  {
    id: "m1c1",
    code: "M1.01",
    title: "Chapter 1",
    lessons: [
      { id: "m1c1l1", code: "M1.01.1", title: "Lesson 1" },
      { id: "m1c1l2", code: "M1.01.2", title: "Lesson 2" },
    ],
  },
  {
    id: "m1c2",
    code: "M1.02",
    title: "Chapter 2",
    lessons: [
      { id: "m1c2l1", code: "M1.02.1", title: "Lesson 1" },
      { id: "m1c2l2", code: "M1.02.2", title: "Lesson 2" },
    ],
  },
  {
    id: "m1c3",
    code: "M1.03",
    title: "Chapter 3",
    lessons: [
      { id: "m1c3l1", code: "M1.03.1", title: "Lesson 1" },
      { id: "m1c3l2", code: "M1.03.2", title: "Lesson 2" },
    ],
  },
  {
    id: "m1c4",
    code: "M1.04",
    title: "Chapter 4",
    lessons: [
      { id: "m1c4l1", code: "M1.04.1", title: "Lesson 1" },
      { id: "m1c4l2", code: "M1.04.2", title: "Lesson 2" },
    ],
  },
  {
    id: "m1c5",
    code: "M1.05",
    title: "Chapter 5",
    lessons: [
      { id: "m1c5l1", code: "M1.05.1", title: "Lesson 1" },
      { id: "m1c5l2", code: "M1.05.2", title: "Lesson 2" },
    ],
  },
  {
    id: "m2c1",
    code: "M2.01",
    title: "Chapter 1",
    lessons: [
      { id: "m2c1l1", code: "M2.01.1", title: "Lesson 1" },
      { id: "m2c1l2", code: "M2.01.2", title: "Lesson 2" },
    ],
  },
  {
    id: "m2c2",
    code: "M2.02",
    title: "Chapter 2",
    lessons: [
      { id: "m2c2l1", code: "M2.02.1", title: "Lesson 1" },
      { id: "m2c2l2", code: "M2.02.2", title: "Lesson 2" },
    ],
  },
  {
    id: "m2c3",
    code: "M2.03",
    title: "Chapter 3",
    lessons: [
      { id: "m2c3l1", code: "M2.03.1", title: "Lesson 1" },
      { id: "m2c3l2", code: "M2.03.2", title: "Lesson 2" },
    ],
  },
  {
    id: "m2c4",
    code: "M2.04",
    title: "Chapter 4",
    lessons: [
      { id: "m2c4l1", code: "M2.04.1", title: "Lesson 1" },
      { id: "m2c4l2", code: "M2.04.2", title: "Lesson 2" },
    ],
  },
  {
    id: "m2c5",
    code: "M2.05",
    title: "Chapter 5",
    lessons: [
      { id: "m2c5l1", code: "M2.05.1", title: "Lesson 1" },
      { id: "m2c5l2", code: "M2.05.2", title: "Lesson 2" },
    ],
  },
  {
    id: "m3c1",
    code: "M3.01",
    title: "Chapter 1",
    lessons: [
      { id: "m3c1l1", code: "M3.01.1", title: "Lesson 1" },
      { id: "m3c1l2", code: "M3.01.2", title: "Lesson 2" },
    ],
  },
  {
    id: "m3c2",
    code: "M3.02",
    title: "Chapter 2",
    lessons: [
      { id: "m3c2l1", code: "M3.02.1", title: "Lesson 1" },
      { id: "m3c2l2", code: "M3.02.2", title: "Lesson 2" },
    ],
  },
  {
    id: "m3c3",
    code: "M3.03",
    title: "Chapter 3",
    lessons: [
      { id: "m3c3l1", code: "M3.03.1", title: "Lesson 1" },
      { id: "m3c3l2", code: "M3.03.2", title: "Lesson 2" },
    ],
  },
  {
    id: "m3c4",
    code: "M3.04",
    title: "Chapter 4",
    lessons: [
      { id: "m3c4l1", code: "M3.04.1", title: "Lesson 1" },
      { id: "m3c4l2", code: "M3.04.2", title: "Lesson 2" },
    ],
  },
  {
    id: "m3c5",
    code: "M3.05",
    title: "Chapter 5",
    lessons: [
      { id: "m3c5l1", code: "M3.05.1", title: "Lesson 1" },
      { id: "m3c5l2", code: "M3.05.2", title: "Lesson 2" },
    ],
  },
  {
    id: "m4c1",
    code: "M4.01",
    title: "Chapter 1",
    lessons: [
      { id: "m4c1l1", code: "M4.01.1", title: "Lesson 1" },
      { id: "m4c1l2", code: "M4.01.2", title: "Lesson 2" },
    ],
  },
  {
    id: "m4c2",
    code: "M4.02",
    title: "Chapter 2",
    lessons: [
      { id: "m4c2l1", code: "M4.02.1", title: "Lesson 1" },
      { id: "m4c2l2", code: "M4.02.2", title: "Lesson 2" },
    ],
  },
  {
    id: "m4c3",
    code: "M4.03",
    title: "Chapter 3",
    lessons: [
      { id: "m4c3l1", code: "M4.03.1", title: "Lesson 1" },
      { id: "m4c3l2", code: "M4.03.2", title: "Lesson 2" },
    ],
  },
  {
    id: "m4c4",
    code: "M4.04",
    title: "Chapter 4",
    lessons: [
      { id: "m4c4l1", code: "M4.04.1", title: "Lesson 1" },
      { id: "m4c4l2", code: "M4.04.2", title: "Lesson 2" },
    ],
  },
  {
    id: "m4c5",
    code: "M4.05",
    title: "Chapter 5",
    lessons: [
      { id: "m4c5l1", code: "M4.05.1", title: "Lesson 1" },
      { id: "m4c5l2", code: "M4.05.2", title: "Lesson 2" },
    ],
  },
];

function chaptersForModule(moduleCode) {
  return CHAPTERS.filter((ch) => String(ch.code).split(".")[0] === moduleCode);
}

// The library is the one module surface that stays, so the shape stays too.
const PDFS = [];
function pdfsForModule() {
  return [];
}

const NAV = [];
const TRIVIA = [];

export { MODULES, CHAPTERS, chaptersForModule, PDFS, pdfsForModule, NAV, TRIVIA };
