/* Lifted verbatim from reference/02-licence-stamp-creator.html (script lines 755-790).
   pickPhoto(), openCrop() with zoom and drag, pickCover().
   Note pickPhoto: "use your initials" is ME.photo = null and nothing else.
   No Clerk call, so nothing can throw. That is the whole fix for the avatar bug. */

function pickPhoto(){
  openSheet(`<h3>Profile picture</h3><div class="pgrid">
    <button class="popt ${!ME.photo?'on':''}" id="useIni"><span class="av sm" style="background:${avaBg(ME.coverColor)};color:${avaFg(ME.coverColor)}">${initials(ME.name)}</span><span>Your initials</span></button>
    <button class="popt ${ME.photo?'on':''}" id="upPh"><span class="av sm up ph">${ME.photo?`<img src="${ME.photo}" alt="" style="--z:${ME.photoZ};--x:${ME.photoX}%;--y:${ME.photoY}%">`:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 16V5M7 10l5-5 5 5M5 19h14"/></svg>'}</span><span>${ME.photo?'Change photo':'Upload a photo'}</span></button></div>`);
  $('#useIni').onclick=()=>{ME.photo=null;closeV();paintCard();toast('Using your initials')};
  $('#upPh').onclick=()=>readFile(d=>openCrop(d));
}
function openCrop(src){
  let z=1.2,x=0,y=0;
  openSheet(`<h3>Position your photo</h3>
   <div class="crop" id="crop"><img id="cimg" src="${src}" alt=""><span class="cmask"></span></div>
   <div class="crow2"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6"/></svg>
     <input type="range" class="barr" id="czoom" min="100" max="300" value="120" aria-label="Zoom">
     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6M11 8v6"/></svg></div>
   <p class="snote" style="text-align:center;margin:10px 0 0">Drag the photo to move it</p>
   <div class="pbtns" style="margin-top:16px"><button class="pill" id="cCancel">Cancel</button><button class="pill pri" id="cUse">Use photo</button></div>`);
  const img=$('#cimg'),paint=()=>{img.style.setProperty('--z',z);img.style.setProperty('--x',x+'%');img.style.setProperty('--y',y+'%')};paint();
  $('#czoom').oninput=e=>{z=+e.target.value/100;e.target.style.setProperty('--p',((e.target.value-100)/200*100)+'%');paint()};
  $('#czoom').style.setProperty('--p','10%');
  let drag=false,sx,sy,ox,oy;const st=$('#crop');
  st.addEventListener('pointerdown',e=>{drag=true;sx=e.clientX;sy=e.clientY;ox=x;oy=y;st.setPointerCapture(e.pointerId);st.classList.add('grab')});
  st.addEventListener('pointermove',e=>{if(!drag)return;const r=st.getBoundingClientRect();const lim=(z-1)*50;
    x=Math.max(-lim,Math.min(lim,ox+(e.clientX-sx)/r.width*100));y=Math.max(-lim,Math.min(lim,oy+(e.clientY-sy)/r.height*100));paint()});
  st.addEventListener('pointerup',()=>{drag=false;st.classList.remove('grab')});
  $('#cCancel').onclick=()=>{closeV();pickPhoto()};
  $('#cUse').onclick=()=>{ME.photo=src;ME.photoZ=z;ME.photoX=x;ME.photoY=y;closeV();paintCard();toast('Photo updated')};
}
function pickCover(){
  const thumb=k=>`<span class="cthumb" style="background:${setBg(ME.coverColor)}"><svg viewBox="0 0 640 128" preserveAspectRatio="xMidYMid slice" fill="none">${SETS[k].svg()}</svg></span>`;
  openSheet(`<h3>Cover</h3><div class="cgrid">${Object.entries(SETS).map(([k,c])=>`<button class="copt ${ME.cover===k?'on':''}" data-cv="${k}">${thumb(k)}<span>${c.n}</span></button>`).join('')}
   <button class="copt ${ME.cover==='image'?'on':''}" id="upCv"><span class="cthumb up" ${ME.coverImg?`style="background-image:url('${ME.coverImg}');background-size:cover"`:''}>${ME.coverImg?'':'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 16V5M7 10l5-5 5 5M5 19h14"/></svg>'}</span><span>Your image</span></button></div>
   <p class="lab" style="margin:18px 0 8px">Colour</p>${colourGrid(ME.coverColor,'data-cc')}`);
  $$('[data-cv]').forEach(b=>b.onclick=()=>{ME.cover=b.dataset.cv;paintCard();pickCover()});
  $$('[data-cc]').forEach(b=>b.onclick=()=>{ME.coverColor=PALETTE[+b.dataset.cc];if(ME.cover==='image')ME.cover='contour';paintCard();pickCover()});
  $('#upCv').onclick=()=>{if(ME.coverImg&&ME.cover!=='image'){ME.cover='image';paintCard();pickCover();return}readFile(d=>{ME.coverImg=d;ME.cover='image';paintCard();pickCover()})};
}
