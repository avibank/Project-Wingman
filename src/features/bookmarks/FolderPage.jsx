import { useEffect, useState } from 'react';
import './bookmarks.css';
import './bm-app.css';
import { BmLink, useGo } from './nav';
import { IconLeft, IconPlay, IconQuestion, IconPage, IconBookmark, IconDown } from './icons';
import { content, routes, letter, fmtTime, plural } from './content';
import { calmClass } from './motion';
import { useModuleSaves, FOLDERS, kindFromSlug } from './useSaves';
import { useModuleParam } from './BookmarksPage';
import { removeSave, restoreSave } from './savesStore';
import { toast } from './toastBus';
import { VideoArt } from './FolderCover';
import StudyPad from './StudyPad';
import PractiseSheet from './PractiseSheet';
import TestPile from './TestPile';

/* Where each folder's saves come from — the empty line must point at a control that exists. */
const HOW = {
  question: 'on any question while you take a quiz',
  card: 'on any card in the Library’s study card sets',
  video: 'in the player while a lesson plays',
  page: 'on any page in the paper reader',
};

function Unsave({ row, name }) {
  return (
    <button type="button" className="bm-save" aria-label={`Remove from ${name}`} title="Remove bookmark"
      onClick={async (e) => { const b = e.currentTarget; b.classList.add('is-pop'); const r = await removeSave(row); if (r.ok) toast(`Removed from ${name}`, { action: { label: 'Undo', fn: () => restoreSave(r.row) } }); }}>
      <IconBookmark on />
    </button>
  );
}

/* `slug` is a prop rather than a route param: this app parses its own URLs
   (src/lib/routes.js) and App.jsx hands the folder down. An unknown slug never
   reaches here — parseRoute redirects it to /bookmarks. */
export default function FolderPage({ slug }) {
  const kind = kindFromSlug(slug);
  const nav = useGo();
  const [moduleId] = useModuleParam();
  const { byKind, ready } = useModuleSaves(moduleId);
  const [open, setOpen] = useState(null);
  const [sheet, setSheet] = useState(null);
  /* An unknown slug never reaches here — parseRoute redirects it. `pages` is
     the one that CAN: routes.js is pure and cannot read the pause switch, so
     /bookmarks/pages still parses while Pages is not a folder. It lands where
     every other unrecognised folder lands, rather than on a blank panel. */
  useEffect(() => { if (!kind) nav(routes.bookmarks()); }, [kind, nav]);
  if (!kind) return null;
  const f = FOLDERS[kind];
  const items = byKind[kind];
  const modName = moduleId === 'all' ? 'All modules' : content.modules().find((m) => m.id === moduleId)?.name ?? '';
  const libModule = moduleId === 'all' ? content.currentModuleId() : moduleId;
  if (!ready) return <section className={`bm bm-page${calmClass()}`} aria-busy="true" />;

  let label = f.action, act = null;
  if (kind === 'question') { label = `Practise ${plural(items.length, 'question')}`; act = () => { content.track?.('practise_started', { from: 'folder' }); setSheet('practise'); }; }
  if (kind === 'card') { act = () => { content.track?.('test_started', { from: 'folder' }); setSheet('test'); }; }
  if (kind === 'video') { act = () => { const v = items.find((x) => x.at > 0 && x.at < x.lesson.durationSeconds - 5) ?? items[0]; nav(routes.lessonAt(v.lesson.id, v.at)); }; }
  if (kind === 'page') { act = () => nav(routes.readerAt(items[0].paper.id, items[0].page)); }

  return (
    <section className={`bm bm-page bm-grow${calmClass()}`}>
      <BmLink className="bm-back" to={`${routes.bookmarks()}?m=${moduleId}`}><IconLeft />Bookmarks</BmLink>
      <div className="bm-head">
        <div><h1 className="bm-h1">{f.name}</h1><div className="bm-sub">{items.length ? `${items.length} saved · ${modName}` : modName}</div></div>
        {items.length > 0 && <button type="button" className="bm-btn is-primary" onClick={act}><IconPlay />{label}</button>}
      </div>

      {!items.length && (
        <div className="bm-empty">
          No {f.name.toLowerCase()} saved yet. Tap <span className="bm-mk"><IconBookmark /></span> {HOW[kind]} to keep it here.
          {kind === 'card' && <> <BmLink className="bm-link" to={routes.library(libModule)}>Open the card sets</BmLink></>}
        </div>
      )}

      {kind === 'question' && items.length > 0 && (
        <div className="bm-list">
          {items.map(({ row, q }) => {
            const isOpen = open === row.id;
            return (
              <div key={row.id} className={`bm-row${isOpen ? ' is-open' : ''}`}>
                <span className="bm-ico"><IconQuestion /></span>
                <div className="bm-body">
                  <button type="button" className="bm-q-toggle" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : row.id)}>
                    <div className="bm-ttl">{q.stem}</div><div className="bm-meta">Chapter {q.chapter} quiz</div>
                  </button>
                  {/* "OPEN IN ITS QUIZ" IS NOT HERE, and R5 of the brief is
                      what took it out: it says to remove the link rather than
                      leave one that lands in the wrong place, if the quiz
                      taker cannot open at a question without starting a graded
                      attempt. It cannot. A sitting is latched at mount, the
                      clock starts at 75 seconds a question, and the attempt is
                      written to localStorage — so tapping this on a chapter
                      with no attempt would have started a timed paper to look
                      at one question. The answer is already in the row, which
                      is what the link was mostly wanted for. It is item 7 in
                      claude/backlog-bookmarks.md, waiting on a taker that can
                      open at a question without sitting the paper. */}
                  <div className="bm-reveal"><div>
                    {q.options.map((o, j) => (<div key={j} className={`bm-o${j === q.answerIndex ? ' is-right' : ''}`}><b>{letter(j)}</b>{o}{j === q.answerIndex && <span className="bm-w">Answer</span>}</div>))}
                  </div></div>
                </div>
                <Unsave row={row} name={f.name} />
              </div>
            );
          })}
        </div>
      )}

      {kind === 'card' && items.length > 0 && (<>
        <StudyPad questions={items.map((x) => x.q)} moduleId={moduleId} mode="saved" />
        <div className="bm-pad-foot"><BmLink className="bm-link" to={routes.library(libModule)}>Browse all card sets in the Library</BmLink></div>
      </>)}

      {kind === 'video' && items.length > 0 && (
        <div className="bm-vgrid">
          {items.map(({ row, lesson, at }) => (
            <div key={row.id} className="bm-vcard">
              <BmLink className="bm-vthumb" to={routes.lessonAt(lesson.id, at)} aria-label={`Play ${lesson.title} from ${fmtTime(at)}`}>
                <VideoArt lesson={lesson} at={at} /><span className="bm-play"><IconPlay /></span><span className="bm-dur">{fmtTime(lesson.durationSeconds)}</span>
              </BmLink>
              <div className="bm-vmeta"><div className="bm-body"><div className="bm-ttl">{lesson.title}</div><div className="bm-meta">Chapter {lesson.chapter} · Lesson {lesson.lesson} · {fmtTime(at)}</div></div><Unsave row={row} name={f.name} /></div>
            </div>
          ))}
        </div>
      )}

      {kind === 'page' && items.length > 0 && (
        <div className="bm-list">
          {items.map(({ row, paper, page }) => (
            <div key={row.id} className="bm-row">
              <span className="bm-ico"><IconPage /></span>
              <div className="bm-body"><div className="bm-ttl">Page {page}</div><div className="bm-meta">{content.modules().find((m) => m.id === paper.moduleId)?.name}</div></div>
              <BmLink className="bm-pill" to={routes.readerAt(paper.id, page)}>Open</BmLink>
              <Unsave row={row} name={f.name} />
            </div>
          ))}
        </div>
      )}

      {sheet === 'practise' && <PractiseSheet questions={items.map((x) => x.q)} onClose={() => setSheet(null)} />}
      {sheet === 'test' && <TestPile cards={items.map((x) => x.q)} onClose={() => setSheet(null)} />}
    </section>
  );
}
