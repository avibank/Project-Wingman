/* Lifted verbatim from reference/02-licence-stamp-creator.html (script lines 707-754).
   PHRASES, the profile shape, initials(), setBg/avaBg/avaFg, coverHTML, avatarHTML,
   stampBlock and card(). avaBg/avaFg are what give the initials the exact picked colour;
   this is the component that must replace the Clerk avatar everywhere. */

const PHRASES=["Torqued to spec. Emotionally too.","It's not a leak, it's a seep.","Could not duplicate."];
const ME={name:'Hassan Alrefaei',callsign:'h.alrefaei',bio:'',phrase:PHRASES[0],cat:'B2 · Avionics',inst:'AU University',admin:true,photo:null,photoZ:1,photoX:0,photoY:0,cover:'contour',coverColor:null,coverImg:null,livery:'sky',
  stats:[['13h 54m','Hours flown'],['7','Lessons signed off'],['12','Days flown']]};
const initials=n=>n.split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
function setBg(c){c=c||PALETTE[1];const l=c.l??.6;return `linear-gradient(135deg,${col(c,l)} 0%,${col(c,Math.max(.16,l-.26))} 100%)`}
function avaBg(c){c=c||PALETTE[1];return col(c)}
function avaFg(c){c=c||PALETTE[1];return (c.l??.6)>.7?'oklch(.2 .02 265)':'#fff'}
function coverHTML(e){
  const img=ME.cover==='image'&&ME.coverImg;
  const bg=img?`background-image:url('${ME.coverImg}');background-size:cover;background-position:center`:`background:${setBg(ME.coverColor)}`;
  return `<div class="cover" style="${bg}">${img?'':`<svg viewBox="0 0 640 128" preserveAspectRatio="xMidYMid slice" fill="none">${SETS[ME.cover].svg()}</svg>`}
   ${e?`<button class="cvbtn" id="cvBtn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/></svg>Cover</button>`:''}</div>`;
}
function avatarHTML(){return ME.photo?`<span class="av ph"><img src="${ME.photo}" alt="" style="--z:${ME.photoZ};--x:${ME.photoX}%;--y:${ME.photoY}%"></span>`:`<span class="av" style="background:${avaBg(ME.coverColor)};color:${avaFg(ME.coverColor)}">${initials(ME.name)}</span>`}
function stampBlock(e,slam){
  if(ISSUED)return `<div class="sblock"><span class="got ${slam?'slam':''}">${inspStamp(true,150,-6,MYSTAMP)}</span></div>`;
  if(e)return `<div class="sblock"><button class="ghost" id="mk" aria-label="Create your stamp">${inspStamp(false,150,0,DEFAULT_STAMP)}<b>Create your stamp</b></button></div>`;
  return `<div class="sblock"><span class="gen">${inspStamp(false,150,0,DEFAULT_STAMP)}</span></div>`;
}
function card(e,slam){
  const L=LIVERIES[ME.livery];
  return `<div class="lic ${e?'editing':''}" style="--accent:${lc(L,.68,1.1)};--accent-soft:${lc(L,.68,1.1,.14)}">${coverHTML(e)}${ME.admin?'<span class="adm"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6z"/></svg>ADMIN</span>':''}
   <div class="lbody">
    <div class="avw">${avatarHTML()}${e?'<button class="cam" id="photo" aria-label="Profile picture"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg></button>':''}</div>
    ${e?`<input class="ed hn" id="fCs" value="${ME.callsign}" aria-label="Callsign" maxlength="20" size="${Math.max(6,ME.callsign.length+1)}">`:`<div class="hn">${ME.callsign}</div>`}
    <div class="sn">${ME.name}</div>
    ${e?`<input class="ed bio" id="fBio" value="${ME.bio}" maxlength="80" placeholder="Add a line about you">`:(ME.bio?`<p class="bio">${ME.bio}</p>`:'')}
    ${e?`<button class="tag" id="phr" title="Pick a phrase"><i></i><span>${ME.phrase}</span><i></i></button>`:`<span class="tag"><i></i><span>${ME.phrase}</span><i></i></span>`}
    <div class="stats">${ME.stats.map(([v,k])=>`<div><b>${v}</b><span>${k}</span></div>`).join('')}</div>
    ${stampBlock(e,slam)}
    ${e?'':`<button class="pill pri inv" disabled>Invite to squadron</button>`}
   </div></div>`;
}
function paintTop(){const el=$('#meAv');if(!el)return;el.innerHTML=ME.photo?`<img src="${ME.photo}" alt="" style="--z:${ME.photoZ};--x:${ME.photoX}%;--y:${ME.photoY}%">`:initials(ME.name);el.className='me av ph'+(ME.photo?'':' ini');el.style.background=ME.photo?'':avaBg(ME.coverColor);el.style.color=avaFg(ME.coverColor)}
function paintCard(slam){
  $('#myCard').innerHTML=card(true,slam);
  $('#fCs').onchange=e=>{const v=e.target.value.trim();if(!v){e.target.value=ME.callsign;return}ME.callsign=v;toast('Callsign saved')};
  $('#fCs').oninput=e=>e.target.size=Math.max(6,e.target.value.length+1);
  $('#fBio').onchange=e=>{ME.bio=e.target.value.trim();toast('Saved')};
  $('#photo').onclick=pickPhoto;$('#cvBtn').onclick=pickCover;paintTop();$('#phr').onclick=pickPhrase;
  if($('#mk'))$('#mk').onclick=openMaker;
}
function pickPhrase(){
  openSheet(`<h3>Your phrase</h3><div class="plist">${PHRASES.map((p,i)=>`<button class="pp ${ME.phrase===p?'on':''}" data-ph="${i}">${p}</button>`).join('')}</div>`);
  $$('[data-ph]').forEach(b=>b.onclick=()=>{ME.phrase=PHRASES[+b.dataset.ph];closeV();paintCard();toast('Phrase set')});
}
function readFile(cb){const i=document.createElement('input');i.type='file';i.accept='image/png,image/jpeg,image/webp,image/heic';i.onchange=()=>{const f=i.files[0];if(!f)return;const r=new FileReader();r.onload=()=>cb(r.result);r.readAsDataURL(f)};i.click()}
function openSheet(html){$('#sheet').innerHTML=`<div class="pick"><button class="x2" id="closeP" aria-label="Close"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>${html}</div>`;$('#scrim').classList.add('open');$('#closeP').onclick=closeV}
