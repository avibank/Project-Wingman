/* Lifted verbatim from reference/02-licence-stamp-creator.html (script lines 846-867).
   Greeter choice -> one description line -> the label field with that greeter's placeholder.
   Your bar: min 75 (the pass mark), max 100, and it can only go up. */

/* preferences */
const GREET=[{n:'Wingman',d:"A coworker on the same shift. Notices you're here, never what you scored.",ph:"Skip it. I'll talk anyway."},
 {n:'The Hermit',d:'Says as little as possible. Still notices you showed up.',ph:"Skip it, you may. Talk anyway, I will."}];
let greeter=0;
function paintGreet(){const g=GREET[greeter];$('#gDesc').textContent=g.d;$('#gLab').textContent=`What ${g.n} calls you`;$('#callMe').placeholder=g.ph}
$$('#greet button').forEach(b=>b.onclick=()=>{greeter=+b.dataset.g;$$('#greet button').forEach(x=>x.setAttribute('aria-pressed',x===b));paintGreet()});
$('#callMe').oninput=paintGreet;paintGreet();
const SOC=['Nobody in your way. Study only.','Your squadron and right seat, nothing else.','Everything, including the module chat.'];
$$('#social button').forEach(b=>b.onclick=()=>{$$('#social button').forEach(x=>x.setAttribute('aria-pressed',x===b))});
$('#bar').oninput=e=>{const v=e.target.value;$('#barV').textContent=v+'%';e.target.style.setProperty('--p',((v-75)/25*100)+'%')};$('#bar').style.setProperty('--p','44%');
$('#solo').onclick=e=>{const on=e.currentTarget.getAttribute('aria-checked')!=='true';e.currentTarget.setAttribute('aria-checked',on);toast(on?'Flying solo · nobody sees you':'Back on the radar')};

/* device preview */
if(location.hash==='#frame')document.querySelector('.demo').style.display='none';
function device(w){document.getElementById('devwrap')?.remove();if(!w)return;
  const d=document.createElement('div');d.id='devwrap';d.innerHTML=`<div class="devbar"><b>${w===390?'Phone · 390':'Tablet · 834'}</b><button id="devx">Close</button></div><iframe src="${location.pathname}#frame" style="width:${w}px"></iframe>`;
  document.body.appendChild(d);d.querySelector('#devx').onclick=()=>device(0)}
$('#dTab').onclick=()=>device(834);$('#dPhone').onclick=()=>device(390);
$('#theme').onclick=()=>{const r=document.documentElement;const dark=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme: dark)').matches;r.dataset.theme=dark?'light':'dark'};
$('#resetStamp').onclick=()=>{MYSTAMP={...DEFAULT_STAMP};ISSUED=null;$('#maker').hidden=true;paintCard();toast('Demo reset: no stamp issued')};
let tt;function toast(m){const el=$('#toast');el.textContent=m;el.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>el.classList.remove('show'),2000)}
paintTop();paintCard();
