/* Lifted verbatim from reference/01-module-lesson-crew.html (script lines 781-831).
   The crew helpers, crewEmpty() and renderCrew(). renderCrew shows the empty state
   whenever nobody else is on the module. The Crew tab is a dead button on live --
   clicking it does nothing at all. Wiring it and shipping this empty state is the
   single highest-value fix on the module screen. */

const YOU_CH=2;
const initials=n=>n.split(' ').map(w=>w[0]).slice(0,2).join('');
const av=(p,cls='')=>`<span class="av ${p.on?'on':''} ${cls}" style="background:oklch(.55 .09 ${p.h})">${initials(p.n)}${p.rs?'<span class="rs" title="Your right seat"><svg width="9" height="9" viewBox="0 0 24 24" fill="#fff"><path d="M12 2 4 20h16z"/></svg></span>':''}</span>`;
const MSG='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>';
const SEAT='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v9a2 2 0 0 0 2 2h7l2 5M7 15l-2 5"/></svg>';
const PLUS='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const face=p=>`<span class="av ${p.on?'on':''} ${p.sq?'sqring':''}" data-p="${people.indexOf(p)}" title="${p.n}${p.sq?' · your squadron':''}" style="background:oklch(.55 .09 ${p.h})">${initials(p.n)}</span>`;
function crewEmpty(){
  const ghost=[['Chapter 1','who has signed it off'],['Chapter 2','who is on it right now'],['Chapter 3','who is ahead of you']];
  return `<div class="cempty">
    <div class="ce-h"><h3>Nobody else on Module 1 yet</h3>
      <p>Crew is the class for this module: who's studying it, which chapter they're on, and whose stamp is on each chapter. It's how you find someone at the same point as you when you're stuck.</p></div>
    <div class="ce-ghost" aria-hidden="true">${ghost.map(([c,t])=>`<div class="ce-row"><div><b>${c}</b><span>${t}</span></div><div class="ce-faces">${[0,1,2].map(i=>`<span class="ce-face" style="animation-delay:${i*.12}s"></span>`).join('')}</div></div>`).join('')}</div>
    <div class="ce-do"><button class="pill pri" data-find="squad">Find a squadron</button><button class="pill" data-find="invite">Invite your class</button></div>
    <p class="ce-note">The moment somebody else opens Module 1, they appear here. Your own stamp shows on every chapter you sign off, whether anyone else is here or not.</p>
  </div>`;
}
function renderCrew(){
  if(!people.length)return $('#crew').innerHTML=crewEmpty(),bindEmpty();
  const q=$('#q').value.trim().toLowerCase();
  const match=p=>!q||(p.n+' '+p.cs).toLowerCase().includes(q);
  const all=people.filter(match), now=all.filter(p=>p.on);
  let h=`<div class="csum"><div><b>${all.length+1} on Module 1</b><p>${now.length} studying right now · ${people.filter(p=>p.ch===4).length} have finished it</p></div>
    <div class="stack">${now.slice(0,6).map(face).join('')}${now.length>6?`<span class="more">+${now.length-6}</span>`:''}</div></div>`;
  [1,2,3].forEach(c=>{
    const on=all.filter(p=>p.ch===c), done=all.filter(p=>p.ch>c);
    const mineDone=MOD[c-1].items.filter(i=>!i.quiz).every(i=>i.state==='done');
    h+=`<div class="cch"><div class="cch-h"><div><h3>Chapter ${c}</h3><div class="cm">${done.length+(mineDone?1:0)} signed off${c===YOU_CH?' · <span class="here">you are here</span>':''}</div></div>
      <div class="onit">${on.length?`<span>On it now</span><span class="stack">${on.map(face).join('')}</span>`:'<span>Nobody on it right now</span>'}</div></div>
      <div class="wall"><span class="wl">SIGNED OFF</span>${done.length||mineDone?
        (mineDone?`<button class="mine" data-golic title="Your stamp">${inspStamp(true,44,rot(),MYSTAMP)}</button>`:'')+done.map(p=>`<button data-p="${people.indexOf(p)}" title="${p.n}">${inspStamp(true,44,rot(),p.stamp)}</button>`).join('')
        :'<span class="none">No stamps yet. The first one here could be yours.</span>'}</div></div>`;
  });
  const helpers=all.filter(p=>p.ans>0).sort((a,b)=>b.ans-a.ans).slice(0,4);
  if(helpers.length)h+=`<div class="helpers"><h3>Answering questions</h3><p class="cm">Most answers in Module 1 threads this month</p>
    <div class="hrow">${helpers.map(p=>`<button class="hp" data-p="${people.indexOf(p)}">${face(p)}<span>${p.n.split(' ')[0]}<small>${p.ans} answers</small></span></button>`).join('')}
    <button class="pill" data-threads>Open Module 1 threads</button></div></div>`;
  $('#crew').innerHTML=all.length?h:`<div class="empty">Nobody by that name on Module 1.<br><button class="pill" style="margin-top:12px" onclick="document.getElementById('q').value='';renderCrew()">Clear search</button></div>`;
}
$('#q').oninput=()=>MT==='crew'?renderCrew():MT==='library'?renderLibrary():renderLessons();
function bindEmpty(){$$('[data-find]').forEach(b=>b.onclick=()=>toast(b.dataset.find==='squad'?'Opens Find a squadron in the Ready Room':'Opens your invite link'))}
$('#crew').addEventListener('click',e=>{
  if(e.target.closest('[data-threads]')){toast('Opening Module 1 threads in the Ready Room');return}
  const r=e.target.closest('[data-p]');if(r)openProfile(people[+r.dataset.p]);
});
function act(k,p){
  const first=p.n.split(' ')[0];
  if(k==='gc')toast('Opening Blue Tail squadron chat in the Ready Room');
  if(k==='seat'){if(p.rs){toast(first+' is already in your right seat');return}people.forEach(x=>x.rs=false);p.rs=true;toast('Right seat request sent to '+first);renderCrew();if($('#scrim').classList.contains('open'))openProfile(p)}
  if(k==='squad')toast('Squadron invite sent to '+first);
}
