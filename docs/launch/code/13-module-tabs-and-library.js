/* Lifted verbatim from reference/01-module-lesson-crew.html (script lines 706-787).
   renderLessons and renderLibrary. Library renders THREE sections in this order:
   Quizzes, Study cards, Papers. CARDSETS shows the shape a card set row needs:
   count, done, kept. The row is the stacked thumbnail + "Chapter N cards" +
   status line + done/total + "Test yourself" -- not a doc icon and an "Open" button. */

function renderLessons(){
  const q=$('#q').value.trim().toLowerCase();
  $('#mt-lessons').innerHTML=MOD.map(c=>{
    const items=c.items.filter(it=>!q||('chapter '+c.n+' '+it.t).toLowerCase().includes(q));if(!items.length)return'';
    const [st,cls]=chStatus(c);const open=openCh.has(c.n)||!!q;
    return `<div class="chap ${open?'open':''}"><button class="ch-h" data-ch="${c.n}" aria-expanded="${open}">
      <span><h2>Chapter ${c.n}</h2><div class="cm">${c.items.filter(i=>!i.quiz).length} lessons · 1 quiz</div></span>
      <span class="cs2 ${cls}">${st}<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg></span></button>
      <div class="ch-body">${items.map(it=>lrow(it)).join('')}</div></div>`}).join('')||'<div class="empty">No lessons match that.</div>';
  MOD.forEach(c=>c.items.forEach(i=>i.fresh=false));
}
function lrow(it){
  if(it.quiz){const has=it.score!=null;
    return `<button class="lrow"><span class="th quiz-thumb"><span class="quiz-thumb__sheet"><span><i class="on"></i><i></i><i></i></span><span><i></i><i></i><i class="on"></i></span><span><i></i><i class="on"></i><i></i></span></span><span class="quiz-thumb__count"><b>${it.q}</b>Qs</span></span>
     <span><div class="lt">${it.t}</div><div class="ls ${has&&it.score/it.q<.75?'warn':''}">${it.q} questions${has&&it.score/it.q<.75?' · below the pass mark':''}</div></span>
     <span class="rt">${has?`<span class="sc">${it.score} of ${it.q}</span>${it.score/it.q<.75?`<span class="pill" style="padding:4px 10px;font-size:12px">Re-check</span>`:``}`:'Not taken'}</span></button>`}
  const cur=it===CUR&&it.state!=='done';
  const sub=it.state==='done'?'Watched in full':it.state==='progress'?it.left:it.dur;
  const right=it.state==='done'?`<span class="imp ${it.fresh?'fresh':''}" style="color:var(--accent)" title="Your stamp" data-golic>${inspStamp(true,46,it.rot)}</span>`
    :it.state==='progress'?'<span class="resume">Resume</span>':'';
  return `<button class="lrow ${cur?'cur':''}" data-open="${it===CUR?1:0}"><span class="th">${it.state==='progress'?'<b style="width:30%"></b>':''}</span>
    <span><div class="lt">${it.t}</div><div class="ls">${sub}</div></span><span class="rt">${right}</span></button>`;
}
$('#mt-lessons').addEventListener('click',e=>{
  const h=e.target.closest('.ch-h');if(h){const n=+h.dataset.ch;openCh.has(n)?openCh.delete(n):openCh.add(n);renderLessons();return}
  const r=e.target.closest('.lrow');if(r){if(r.dataset.open==='1')go('lesson');else toast('Demo: only Chapter 2 · Lesson 2 opens')}
});
const CARDSETS=[{c:1,n:24,done:24,kept:6,t:'numbers arithmetic'},{c:2,n:18,done:11,kept:3,t:'standard form powers'},{c:3,n:22,done:0,kept:0,t:'geometry graphs'}];
const PAPERS=[{t:'B2 13d Instruments, Rotary Wing Aerodynamics, Autoflight and Equipment & Furnishings LTT (2)',ch:0,pages:1012,at:11},{t:'Numbers and arithmetic · class handout',ch:1,pages:42,at:42},{t:'Standard form worked examples',ch:2,pages:18,at:0}];
let pch=0;
function renderLibrary(){
  const q=$('#q').value.trim().toLowerCase();
  const quizzes=MOD.map(c=>({c:c.n,...c.items.find(i=>i.quiz)})).filter(z=>!q||('chapter '+z.c+' quiz').includes(q));
  const ps=PAPERS.filter(p=>(!pch||p.ch===pch)&&(!q||p.t.toLowerCase().includes(q)));
  const sets=CARDSETS.filter(cs=>!q||(('chapter '+cs.c+' cards')+' '+cs.t).toLowerCase().includes(q));
  $('#mt-library').innerHTML=`<div class="libsplit"><div class="lsec"><div><h2>Quizzes</h2><p>3 quizzes, one per chapter</p></div></div>
   <div class="papers">${quizzes.map(z=>{const it=z;return `<button class="lrow">${`<span class="th quiz-thumb"><span class="quiz-thumb__sheet"><span><i class="on"></i><i></i><i></i></span><span><i></i><i></i><i class="on"></i></span><span><i></i><i class="on"></i><i></i></span></span><span class="quiz-thumb__count"><b>${it.q}</b>Qs</span></span>`}
     <span><div class="lt">Chapter ${z.c} quiz</div><div class="ls">${z.q} questions</div></span>
     <span class="rt">${z.score!=null?`<span class="sc">${z.score} of ${z.q}</span><span class="act-o">Re-check</span>`:'<span class="act-o">Take it</span>'}</span></button>`}).join('')||'<div class="empty">No quizzes match.</div>'}</div></div>
   <div class="libsplit"><div class="lsec"><div><h2>Study cards</h2><p>Flip a chapter's cards and keep the ones worth another look</p></div></div>
   <div class="papers">${sets.map(cs=>`<button class="lrow"><span class="th cards-thumb"><i></i><i></i><i></i><b>${cs.n}</b></span>
     <span><div class="lt">Chapter ${cs.c} cards</div><div class="ls">${cs.kept?cs.kept+' kept for another look':cs.n+' cards · not started'}</div></span>
     <span class="rt">${cs.kept?`<span class="sc">${cs.done}/${cs.n}</span><span class="act-o">Test yourself</span>`:'<span class="act-o">Test yourself</span>'}</span></button>`).join('')||'<div class="empty">No card sets match.</div>'}</div></div>
   <div class="lsec"><div><h2>Papers</h2><p>${PAPERS.length} documents for this module</p></div><button class="pill" data-addp>Add a paper</button></div>
   <div class="lchips">${[0,1,2,3].map(n=>`<button class="chip" data-pch="${n}" aria-pressed="${pch===n}">${n?'Chapter '+n:'All'}</button>`).join('')}</div>
   <ul class="papers">${ps.map(p=>`<li class="paper"><span class="pg"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/></svg></span><span><div class="lt" style="font-weight:500">${p.t}</div><div style="font-size:12.5px;color:var(--t3)">PDF · ${p.pages} pages${p.at&&p.at<p.pages?' · you are on page '+p.at:p.at>=p.pages?' · read':''}</div>${p.at&&p.at<p.pages?`<div class="prog"><b style="width:${Math.max(2,p.at/p.pages*100)}%"></b></div>`:''}</span>${p.at&&p.at<p.pages?'<span class="resume">Resume</span>':'<span class="act-o">Open</span>'}</li>`).join('')||'<div class="empty">No papers here yet.</div>'}</ul>`;
}
$('#mt-library').addEventListener('click',e=>{const c=e.target.closest('[data-pch]');if(c){pch=+c.dataset.pch;renderLibrary();return}if(e.target.closest('[data-addp]'))toast('Add a paper opens the file picker')});
let MT='lessons';
$$('.mtabs .tab').forEach(b=>b.onclick=()=>{MT=b.dataset.mt;$$('.mtabs .tab').forEach(x=>x.setAttribute('aria-selected',x===b));
  $('#mt-lessons').hidden=MT!=='lessons';$('#mt-library').hidden=MT!=='library';$('#crew').hidden=MT!=='crew';
  $('#q').placeholder=MT==='crew'?'Find someone':MT==='library'?'Search quizzes, cards and papers':'Search lessons';$('#q').value='';renderLessons();renderLibrary();renderCrew()});

/* ---- crew ---- */
const hues=[20,160,300,75,220,120,340,40,190,260,100,55,280,5];
const people=[
 {n:'Sara Al-Mutairi',cs:'SPARROW',id:'SM·042',ch:2,on:true,sq:true,rs:true,bio:'B2 track. Avionics nerd, bad at maths, working on it.'},
 {n:'Fahad Al-Enezi',cs:'RIVET',id:'FE·208',ch:2,on:false,sq:true,last:'2h ago',bio:'Ex-line mechanic going for the licence.'},
 {n:'Yousef Karam',cs:'TORQUE',id:'YK·011',ch:1,on:true,sq:true,bio:''},
 {n:'Noor Hassan',cs:'',id:'NH·390',ch:3,on:false,sq:true,last:'yesterday',bio:'Here for the flashcards.'},
 {n:'Mariam Al-Sabah',cs:'HALO',id:'MS·155',ch:1,on:true,bio:'First year, AU aviation.'},
 {n:'Abdullah Faraj',cs:'',id:'AF·073',ch:1,on:false,last:'3d ago',bio:''},
 {n:'Dana Qasem',cs:'VECTOR',id:'DQ·260',ch:2,on:true,bio:'Studying between shifts.'},
 {n:'Hamad Rashed',cs:'',id:'HR·512',ch:2,on:false,last:'5h ago',bio:''},
 {n:'Lulwa Behbehani',cs:'MACH',id:'LB·301',ch:3,on:false,last:'1d ago',bio:'Finished Module 1 once. Back for the quiz.'},
 {n:'Omar Saleh',cs:'',id:'OS·144',ch:3,on:true,bio:''},
 {n:'Reem Al-Ali',cs:'KITE',id:'RA·087',ch:1,on:false,last:'4d ago',bio:''},
 {n:'Bader Al-Shatti',cs:'GIMBAL',ch:4,on:false,last:'2d ago',bio:'Done with M1, hanging around to help.'},
 {n:'Haya Dashti',cs:'',ch:4,on:true,bio:'Maths tutor on the side.'},
 {n:'Khaled Marafi',cs:'FLAP',ch:3,on:false,last:'6h ago',bio:''},
];
const ANS=[3,0,1,5,0,0,2,0,9,0,0,14,11,0];
const PST=[{shape:'shield',mark:'plane',text:'',sub:'SPRW'},{shape:'hex',mark:'text',text:'208',sub:''},{shape:'circle',mark:'wrench',text:'',sub:'TRQ'},{shape:'square',mark:'star',text:'',sub:''},{shape:'oval',mark:'text',text:'HALO',sub:''},{shape:'seal',mark:'tick',text:'',sub:'AF'},{shape:'hex',mark:'plane',text:'',sub:''},{shape:'circle',mark:'text',text:'HR',sub:'512'},{shape:'shield',mark:'text',text:'M',sub:'MACH'},{shape:'square',mark:'text',text:'OS',sub:''},{shape:'oval',mark:'star',text:'',sub:'KITE'}];
PST.push({shape:'seal',mark:'text',text:'BS',sub:''},{shape:'circle',mark:'star',text:'',sub:'HAYA'},{shape:'hex',mark:'wrench',text:'',sub:'KM'});
people.forEach((p,i)=>{p.h=hues[i];p.ans=ANS[i];const b=PST[i];p.stamp={shape:b.shape,mark:b.mark,text:b.text||b.sub||'',ring:p.cs&&!['oval'].includes(b.shape)?p.cs+' · B2':'',font:['stencil','plain','serif'][i%3],ink:INKS[(i*5)%6].k,seed:i+2,stars:p.ch===4?1:0};if(b.mark!=='text'&&!p.stamp.ring)p.stamp.text=''});
const YOU_CH=2;
const initials=n=>n.split(' ').map(w=>w[0]).slice(0,2).join('');
const av=(p,cls='')=>`<span class="av ${p.on?'on':''} ${cls}" style="background:oklch(.55 .09 ${p.h})">${initials(p.n)}${p.rs?'<span class="rs" title="Your right seat"><svg width="9" height="9" viewBox="0 0 24 24" fill="#fff"><path d="M12 2 4 20h16z"/></svg></span>':''}</span>`;
const MSG='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>';
const SEAT='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v9a2 2 0 0 0 2 2h7l2 5M7 15l-2 5"/></svg>';
const PLUS='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const face=p=>`<span class="av ${p.on?'on':''} ${p.sq?'sqring':''}" data-p="${people.indexOf(p)}" title="${p.n}${p.sq?' · your squadron':''}" style="background:oklch(.55 .09 ${p.h})">${initials(p.n)}</span>`;
