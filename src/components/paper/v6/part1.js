/* THE SHARED MARK LIST — window.WM.
 *
 * Hand-owned since the reader stopped being generated. It used to be cut out
 * of docs/reader/v6/reader.js by scripts/build-reader-v6.mjs, which is gone:
 * the chrome that file handed over is now the source, not the output, and a
 * fix here is an ordinary edit rather than a find/replace entry in a build
 * script. docs/reader/v6/ is kept as the original, for reference only.
 *
 * WM is the one list every part of the reader draws from. The store owns the
 * rows; this owns what is on the page right now.
 */

export function mountWM(){
window.WM={marks:[],subs:[],seq:0,
  add(m){m.id=m.id||('m'+(++this.seq));this.marks.push(m);this.emit();return m.id},
  drop(id){this.marks=this.marks.filter(x=>x.g!==id&&x.id!==id);this.emit()},
  on(f){this.subs.push(f)},emit(){this.subs.forEach(f=>{try{f()}catch(e){}})}};
return window.WM;
}
