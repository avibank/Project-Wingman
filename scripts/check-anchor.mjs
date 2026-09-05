/* The anchor suite that shipped with the brief, run as part of `npm run check`.
   29 cases. Copied as supplied, with only the import path changed — this is the
   contract for the one file in the feature that must not be rewritten.

   Run: npm run check:anchor */
import { createAnchor, resolveAnchor, normalise, flatten } from '../src/lib/anchor.js';

let pass = 0, fail = 0;
const ok = (name, cond, detail='') => {
  if (cond){ pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  ' + detail : '')); }
};

/* A native-content version of the opening of the pdf.js test paper. */
const NATIVE = [
  'Dynamic languages such as JavaScript are more difficult to compile than statically typed ones.',
  'Since no concrete type information is available, traditional compilers need to emit generic code that can handle all possible type combinations at runtime.',
  'We present an alternative compilation technique for dynamically-typed languages that identifies frequently executed loop traces at run-time.',
  'Our method provides cheap inter-procedural type specialization, and the resulting traces are compiled to machine code.',
  'Dynamic languages such as JavaScript are more difficult to compile than statically typed ones.'
].join('\n\n');

/* The same opening as it comes out of a PDF: hard wraps and a hyphenated break. */
const FROM_PDF = [
  'Dynamic languages such as JavaScript are more difficult to com-',
  'pile than statically typed ones. Since no concrete type informa-',
  'tion is available, traditional compilers need to emit generic code',
  'that can handle all possible type combinations at runtime.'
].join('\n');

/* ---- 1. normalisation ---------------------------------------------------- */
console.log('\nnormalisation');
{
  const { norm } = normalise(FROM_PDF);
  ok('de-hyphenates across a line break', norm.includes('to compile than'), JSON.stringify(norm.slice(40, 70)));
  ok('collapses hard wraps to single spaces', !/\s{2,}|\n/.test(norm));
  const { norm: n2, map } = normalise('  a\n\n  b  ');
  ok('maps normalised positions back to the source',
     n2 === 'a b' && map[0] === 2 && map[1] === 3 && map[2] === 7,
     JSON.stringify({ n2, map }));
}

/* ---- 2. the easy case ---------------------------------------------------- */
console.log('\nunchanged document');
{
  const start = NATIVE.indexOf('traditional compilers need to emit generic code');
  const a = createAnchor(NATIVE, start, start + 47);
  const r = resolveAnchor(a, NATIVE);
  ok('resolves exactly', r && r.method === 'exact' && r.score === 1, JSON.stringify(r));
  ok('offsets point at the right words', r && NATIVE.slice(r.start, r.end) === 'traditional compilers need to emit generic code',
     r && JSON.stringify(NATIVE.slice(r.start, r.end)));
}

/* ---- 3. an edit somewhere else in the paper ------------------------------ */
console.log('\npaper edited above the annotation');
{
  const start = NATIVE.indexOf('frequently executed loop traces');
  const a = createAnchor(NATIVE, start, start + 31);
  const edited = 'A new opening paragraph that did not exist before, added later.\n\n' +
                 NATIVE.replace('no concrete type information is available', 'no concrete type information whatsoever is available');
  const r = resolveAnchor(a, edited);
  ok('still resolves', !!r, JSON.stringify(r));
  ok('lands on the same words', r && edited.slice(r.start, r.end) === 'frequently executed loop traces',
     r && JSON.stringify(edited.slice(r.start, r.end)));
}

/* ---- 4. the annotated passage itself was edited -------------------------- */
console.log('\nthe passage itself was edited');
{
  const start = NATIVE.indexOf('Our method provides cheap inter-procedural type specialization');
  const a = createAnchor(NATIVE, start, start + 61);
  const edited = NATIVE.replace('cheap inter-procedural type specialization',
                                'cheap inter procedural type specialisation');
  const r = resolveAnchor(a, edited);
  ok('recovers by similarity', r && r.method === 'fuzzy', JSON.stringify(r));
  ok('reports less than full confidence', r && r.score < 1 && r.score >= 0.75, r && String(r.score));
  ok('overlaps the right sentence', r && edited.slice(r.start, r.end).includes('cheap inter procedural'),
     r && JSON.stringify(edited.slice(r.start, r.end)));
}

/* ---- 5. two identical passages ------------------------------------------- */
console.log('\nthe same sentence appears twice');
{
  const first  = NATIVE.indexOf('Dynamic languages such as JavaScript');
  const second = NATIVE.lastIndexOf('Dynamic languages such as JavaScript');
  ok('fixture really does repeat it', first !== second);

  const aSecond = createAnchor(NATIVE, second, second + 36);
  ok('records which occurrence it was', aSecond.occurrence === 1, String(aSecond.occurrence));
  const r = resolveAnchor(aSecond, NATIVE);
  ok('context picks the second one, not the first', r && Math.abs(r.start - second) < 3,
     JSON.stringify({ got: r && r.start, want: second }));

  const aFirst = createAnchor(NATIVE, first, first + 36);
  const r2 = resolveAnchor(aFirst, NATIVE);
  ok('and the first one when that is what was marked', r2 && Math.abs(r2.start - first) < 3,
     JSON.stringify({ got: r2 && r2.start, want: first }));
}

/* ---- 6. PDF-era anchor against the native rewrite ------------------------ */
console.log('\nannotation made on the PDF, paper later becomes native content');
{
  const s = FROM_PDF.indexOf('traditional compilers');
  const e = FROM_PDF.indexOf('at runtime.') + 'at runtime.'.length;
  const a = createAnchor(FROM_PDF, s, e);
  ok('the stored quote is already de-hyphenated', !a.quote.includes('-\n') && a.quote.includes('generic code'));
  const r = resolveAnchor(a, NATIVE);
  ok('migrates to the native text', !!r, JSON.stringify(r));
  ok('lands on the same sentence', r && NATIVE.slice(r.start, r.end).startsWith('traditional compilers'),
     r && JSON.stringify(NATIVE.slice(r.start, r.end).slice(0, 60)));
}

/* ---- 7. the passage was deleted ------------------------------------------ */
console.log('\nthe passage was deleted');
{
  const start = NATIVE.indexOf('Our method provides cheap inter-procedural type specialization, and the resulting traces are compiled to machine code.');
  const a = createAnchor(NATIVE, start, start + 118);
  const gutted = NATIVE.replace(
    'Our method provides cheap inter-procedural type specialization, and the resulting traces are compiled to machine code.',
    'Nothing whatsoever remains of the previous claim in this location.');
  const r = resolveAnchor(a, gutted);
  ok('returns null rather than guessing', r === null, JSON.stringify(r));
}

/* ---- 8. edges ------------------------------------------------------------ */
console.log('\nedges');
{
  const a = createAnchor(NATIVE, 0, 7);
  ok('a selection at the very start has no prefix', a.prefix === '');
  ok('and still resolves', (r => r && NATIVE.slice(r.start, r.end) === 'Dynamic')(resolveAnchor(a, NATIVE)));

  const b = createAnchor(NATIVE, NATIVE.length - 5, NATIVE.length);
  ok('a selection at the very end has no suffix', b.suffix === '');
  ok('and still resolves', !!resolveAnchor(b, NATIVE));

  let threw = false;
  try { createAnchor(NATIVE, 10, 10); } catch { threw = true; }
  ok('an empty selection is refused', threw);
}

/* ---- 9. a decoy sentence must not win ------------------------------------ */
console.log('\na near-duplicate elsewhere must not steal the anchor');
{
  const start = NATIVE.indexOf('Our method provides cheap');
  const a = createAnchor(NATIVE, start, start + 61);
  const withDecoy = NATIVE + '\n\nOur method provides cheap intra-procedural type specialization, unlike the above.';
  const r = resolveAnchor(a, withDecoy);
  ok('sticks with the original, not the decoy', r && r.start < NATIVE.length,
     JSON.stringify({ got: r && r.start, nativeLen: NATIVE.length }));
}

/* ---- 10. overlapping highlights flatten ---------------------------------- */
console.log('\noverlapping highlights');
{
  const segs = flatten([
    { id:'a', start:0,  end:20 },
    { id:'b', start:10, end:30 },
    { id:'c', start:10, end:20 }
  ]);
  ok('produces non-overlapping segments', segs.every((s,i) => i === 0 || s.start >= segs[i-1].end),
     JSON.stringify(segs));
  const mid = segs.find(s => s.start === 10 && s.end === 20);
  ok('the busiest segment counts all three', mid && mid.count === 3, JSON.stringify(mid));
  ok('covers the whole span once', segs[0].start === 0 && segs[segs.length-1].end === 30);
}

/* ---- 11. it is fast enough on a real-sized paper ------------------------- */
console.log('\nperformance on a paper-sized document');
{
  const big = (NATIVE + '\n\n').repeat(60);            // ~40k characters, ~14 pages
  const start = big.indexOf('frequently executed loop traces', big.length / 2);
  const a = createAnchor(big, start, start + 31);
  const edited = big.slice(0, 500) + 'inserted\n\n' + big.slice(500);
  const t0 = Date.now();
  let r;
  for (let i = 0; i < 50; i++) r = resolveAnchor(a, edited);
  const per = (Date.now() - t0) / 50;
  ok('resolves in the repeated document', !!r, JSON.stringify(r));
  ok('under 15ms per annotation (' + per.toFixed(1) + 'ms, ' + big.length + ' chars)', per < 15);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
