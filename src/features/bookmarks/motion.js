import { content } from './content';
/* One switch for every animation in Bookmarks: the OS "reduce motion" setting OR Wingman's Smooth Air. */
export function isCalm() {
  const os = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let air = false; try { air = !!content.smoothAir(); } catch { air = false; }
  return os || air;
}
/* Class to put on every .bm root so CSS animations stop when Smooth Air is on. */
export const calmClass = () => (isCalm() ? ' is-calm' : '');
