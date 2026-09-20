/* ==========================================================================
   Wingman — exam port check.
   Paste into the browser console on the live quiz taker, then again on the
   result screen. Every line prints PASS or FAIL. A FAIL is a difference from
   reference-demo.html, not a matter of taste — fix it rather than argue it.
   Also runnable from Playwright with page.evaluate(...).
   ========================================================================== */
(() => {
  const out = [];
  const ok = (name, cond, note = '') => out.push({ check: name, result: cond ? 'PASS' : 'FAIL', note });
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const cs = (el, p) => getComputedStyle(el).getPropertyValue(p).trim();
  const page = $('.exam-page');
  const phase = $('.result') ? 'result' : $('.sheet') ? 'ending' : 'exam';

  ok('exam page present', !!page);
  ok('data-screen="exam" set on <html>', document.documentElement.dataset.screen === 'exam');

  /* ---- appearance: matte, finish-free, livery-driven ---- */
  const root = document.documentElement;
  ok('finish scenery off (--stars)', cs(root, '--stars') === 'none', cs(root, '--stars'));
  ok('finish scenery off (--grain)', cs(root, '--grain') === 'none', cs(root, '--grain'));
  ok('no shadow token on the exam', cs(root, '--shadow') === 'none' || root.dataset.variant === 'day');
  const bar = $('.exam-bar') || $('.result');
  if (bar) ok('panels use --panel', getComputedStyle(bar).backgroundColor === (() => {
    const p = document.createElement('div'); p.style.color = cs(root, '--panel'); document.body.appendChild(p);
    const c = getComputedStyle(p).color; p.remove(); return c;
  })(), getComputedStyle(bar).backgroundColor);

  /* ---- exam screen ---- */
  if (phase === 'exam') {
    ok('bookmark is in the question head', !!$('.question__head .mark'));
    ok('bookmark is NOT in the footer', !$('.question__foot .mark'));
    ok('question number is in the head', !!$('.question__head .question__num'));
    ok('footer order: Previous, Flag, Next',
      $$('.question__foot .btn').map(b => b.textContent.trim().split(/\s+/)[0]).join(',').startsWith('Previous,Flag'));
    ok('locked: no links anywhere on the exam page', $$('.exam-page a[href]').length === 0,
      $$('.exam-page a[href]').map(a => a.textContent.trim()).join(' | '));
    ok('locked: no Ready Room or profile', !$('.exam-page .pill') && !$('.exam-page .avatar'));
    ok('locked note shown', !!$('.locked-note'));
    ok('End exam button present', $$('.exam-bar .btn').some(b => /end exam/i.test(b.textContent)));
    ok('route line present in the bar', !!$('.exam-bar .route__fill'));
    ok('three options, A B C', $$('.options .option').length === 3 &&
      $$('.option__key').map(k => k.textContent.trim()).join('') === 'ABC');
    ok('question grid present', $$('.navigator__grid .qcell').length > 0);
    ok('answered cells carry the tick, not a filled block',
      $$('.qcell.is-answered').every(c => getComputedStyle(c, '::before').content !== 'none'));
  }

  /* ---- result + leaderboard ---- */
  if (phase === 'result') {
    ok('no "Go through the paper" button', !$$('.result .btn').some(b => /go through the paper/i.test(b.textContent)));
    ok('result carries the stamp, not a plane', !!$('.verdict .stamp') && !$('.result__icon'));
    ok('stamp presses on arrival', !!$('.verdict .stamp--press'));
    const rows = $$('.lb-row');
    ok('leaderboard rows present', rows.length > 0, `${rows.length} rows`);
    ok('every row has a stamp', rows.every(r => !!r.querySelector('.lb-row__stamp .stamp')));
    ok('every row reads [account] callsign',
      rows.every(r => /^\[.+\]$/.test(r.querySelector('.lb-row__acct').textContent.trim()) && r.querySelector('.lb-row__call').textContent.trim().length > 0));
    ok('exactly one row marked as yours', rows.filter(r => r.classList.contains('is-you')).length === 1);
    const vals = rows.map(r => {
      const [s, t] = [r.querySelector('.lb-row__score').textContent, r.querySelector('.lb-row__time').textContent];
      const [m, sec] = t.trim().split(':').map(Number);
      return { score: parseInt(s, 10), secs: m * 60 + sec };
    });
    ok('sorted by score desc then time asc',
      vals.every((v, i) => i === 0 || v.score < vals[i - 1].score || (v.score === vals[i - 1].score && v.secs >= vals[i - 1].secs)));
    const inks = new Set($$('.lb-row__stamp svg text').map(t => t.getAttribute('fill')));
    ok('stamps use personal ink, not one colour', inks.size > 1, `${inks.size} inks`);
  }

  /* ---- house rules that keep getting broken ---- */
  const texts = $$('.exam-page *').filter(el => el.children.length === 0 && el.textContent.trim());
  const tiny = texts.filter(el => parseFloat(cs(el, 'font-size')) < 13);
  ok('13px type floor', tiny.length === 0, tiny.slice(0, 3).map(el => el.className + ' ' + cs(el, 'font-size')).join(' | '));
  const small = $$('.exam-page button').filter(b => b.getBoundingClientRect().height < 36 && b.offsetParent);
  ok('no button under 36px tall', small.length === 0, small.slice(0, 3).map(b => b.className).join(' | '));
  const fonts = new Set($$('.exam-page *').map(el => cs(el, 'font-family').split(',')[0].replace(/"/g, '')));
  ok('only Instrument Sans and Geist Mono',
    [...fonts].every(f => /Instrument Sans|Geist Mono|^$/.test(f)), [...fonts].join(' | '));

  console.table(out);
  const failed = out.filter(o => o.result === 'FAIL');
  console.log(failed.length ? `${failed.length} FAILED — the port is not a copy yet.` : 'All checks passed.');
  return out;
})();
