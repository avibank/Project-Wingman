/* THE TOAST BUS, SEPARATE FROM THE TOAST.
 *
 * savesStore.js raises toasts, and the store is the part of this feature with
 * rules worth testing — instant save, revert on refusal, one row per thing,
 * a lesson's second moving rather than doubling. Those tests run in plain node
 * (`npm run check:saves`), and node cannot parse the .jsx the host lives in.
 *
 * So the bus is here and the React host is in Toast.jsx. The store imports
 * this file and nothing else; the host subscribes. onToast returns the
 * previous listener's place, and there is only ever one — a toast replaces the
 * one before it rather than stacking, which is the behaviour the design shows.
 */
let listener = null;

export function toast(message, { action, icon, ms } = {}) {
  listener?.({ message, action, icon, ms: ms ?? (action ? 5000 : 2200), key: Date.now() + Math.random() });
}

export function onToast(fn) {
  listener = fn;
  return () => { if (listener === fn) listener = null; };
}
