/* The flight profile, sampled exactly as the live formation card samples it:
   121 points from x 5 to 139, ground / climb / cruise / descent / ground.
   Keep these numbers — they are the shape the module screen already draws. */

const Y = [82.0, 81.9, 81.4, 80.3, 78.6, 76.4, 73.9, 70.9, 67.6, 64.1, 60.2, 56.3,
           52.1, 47.9, 43.6, 39.4, 35.2, 31.1, 27.2, 23.5, 20.0, 16.9, 14.1, 11.6,
           9.7, 8.2, 7.3, 7.0];

export const STEP = 134 / 120;

function yIndex(i) {
  if (i < 9) return 82;
  if (i <= 36) return Y[i - 9];
  if (i < 84) return 7;
  if (i <= 111) return Y[111 - i];
  return 82;
}

/** profile height at a profile x (5..139) */
export function profileY(x) {
  const f = (x - 5) / STEP;
  const i = Math.floor(f);
  const t = f - i;
  if (i < 0 || i >= 120) return 82;
  return yIndex(i) + (yIndex(i + 1) - yIndex(i)) * t;
}

/** chapter k of n sits here on the profile — evenly between the climb start and the descent end */
export function chapterX(k, n) {
  return n < 2 ? 72 : 15.8 + (128.2 - 15.8) * (k / (n - 1));
}

/** the path in PIXELS, not a stretched viewBox: dashes stay dashes, circles stay round */
export function routePath(mapX, mapY) {
  const d = [];
  for (let i = 0; i <= 120; i++) {
    const x = 5 + i * STEP;
    d.push((i ? 'L' : 'M') + mapX(x).toFixed(1) + ',' + mapY(x).toFixed(1));
  }
  return d.join(' ');
}

/** two initials, the same everywhere a face appears */
export const initials = (name) => (name || '?').slice(0, 2).toUpperCase();

/** group people by chapter, then merge groups that land closer than `min` pixels apart */
export function clusterByPixel(people, n, mapX, min) {
  const byChapter = new Map();
  people.forEach((p) => {
    const list = byChapter.get(p.chapter) || [];
    list.push(p);
    byChapter.set(p.chapter, list);
  });

  const groups = [...byChapter.entries()]
    .map(([chapter, members]) => {
      const x = chapterX(chapter - 1, n);
      return { x, px: mapX(x), members, chapters: [chapter] };
    })
    .sort((a, b) => a.x - b.x);

  const merged = [];
  groups.forEach((g) => {
    const prev = merged[merged.length - 1];
    if (prev && g.px - prev.px < min) {
      prev.members = prev.members.concat(g.members);
      prev.chapters = prev.chapters.concat(g.chapters);
      prev.x = (prev.x + g.x) / 2;
      prev.px = mapX(prev.x);
    } else {
      merged.push({ ...g });
    }
  });
  return merged;
}
