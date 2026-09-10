/* GENERATED — do not edit. Source: docs/reader/v6/reader.js, part 1 (WM, the shared list).
 *
 * The chrome is finished; this is it, copied. Every departure from the file
 * that was handed over is listed below with the reason. Regenerate with
 *   node scripts/build-reader-v6.mjs
 * and `npm run check:paper` refuses if this file and the source have drifted.
 */

export function mountWM(){
window.WM={marks:[],subs:[],seq:0,
  add(m){m.id=m.id||('m'+(++this.seq));this.marks.push(m);this.emit();return m.id},
  drop(id){this.marks=this.marks.filter(x=>x.g!==id&&x.id!==id);this.emit()},
  on(f){this.subs.push(f)},emit(){this.subs.forEach(f=>{try{f()}catch(e){}})}};
return window.WM;
}
