/* Lifted verbatim from reference/01-module-lesson-crew.html (script lines 832-860).
   The profile sheet that opens when you tap somebody in Crew. */

function openProfile(p){
  const i=people.indexOf(p),first=p.n.split(' ')[0];
  $('#sheet').innerHTML=`
   <div class="cover"><svg viewBox="0 0 440 96" preserveAspectRatio="none" fill="none"><path d="M0 84 C60 84 80 30 150 26 L300 26 C360 30 380 84 440 84" stroke="oklch(1 0 0 / .35)" stroke-width="1.5" stroke-dasharray="3 6"/>
     ${[150,225,300].map((x,k)=>`<circle cx="${x}" cy="26" r="${k+1===p.ch?6:4}" fill="${k+1===p.ch?'#fff':'none'}" stroke="#fff" stroke-opacity=".7"/>`).join('')}</svg>
     <button class="x" id="closeP" aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
   <div class="pbody">${av(p)}
     <h2 class="pname">${p.n}${p.cs?`<span>${p.cs}</span>`:''}</h2>
     ${p.bio?`<p class="bio">${p.bio}</p>`:'<div style="height:10px"></div>'}
     <div class="where"><span>${p.on?'● Studying now':'Last here '+p.last}</span><span>${p.ch===4?'Finished Module 1':'Module 1 · Chapter '+p.ch}</span>${p.sq?'<span>Blue Tail squadron</span>':''}</div>
     <div class="lic">
       <div><div class="k">Part-66 student licence</div><div class="v">Category B2 · Avionics</div>
         <div class="row"><span class="k">Institute</span><span class="k">On</span><span style="font-size:13.5px">AU University</span><span style="font-size:13.5px">${p.ans?p.ans+' answers in M1':'Module 1'}</span></div></div>
       <div style="color:var(--accent);line-height:0" title="${first}'s stamp">${inspStamp(true,68,-8,p.stamp)}</div>
     </div>
     <div class="pbtns">
       ${p.sq?`<button class="pill" data-pact="gc">${MSG}Squadron chat</button>`:''}
       ${p.sq?`<button class="pill pri" data-pact="seat">${SEAT}${p.rs?'In your right seat':'Invite to right seat'}</button>`:`<button class="pill pri" data-pact="squad">${PLUS}Invite to squadron</button>`}
     </div>
   </div>`;
  $('#scrim').classList.add('open');
  $('#closeP').onclick=closeProfile;
  $$('[data-pact]').forEach(b=>b.onclick=()=>act(b.dataset.pact,p));
}
function closeProfile(){$('#scrim').classList.remove('open')}
$('#scrim').onclick=e=>{if(e.target.id==='scrim')closeProfile()};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeProfile()});

/* ---- menu ---- */
