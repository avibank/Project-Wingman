/* Lifted verbatim from reference/02-licence-stamp-creator.html (script lines 546-852).
   The whole stamp system: MOTTO, PALETTE, SHAPES, PATTERNS, inkFilter, layout(),
   pathPts/radii/fitArc/rimRun (the rim-text engine), ringPt/ringPattern, patternArt,
   endorseArt(), inspStamp() and colourGrid().
   inspStamp(issued, size, rotation, stamp) is the ONLY way a stamp should ever be drawn,
   on the licence card, on a lesson row, on a chapter wall and in Crew.

   Rim text, in short: layout() gives each shape a rimOut (the outline the letters must
   stay inside, as [path, inset]) and an optional rimSpan (how far round the line may
   travel, [top, bottom]). rimRun() walks the corridor between rimOut and the code
   frame, fits a TRUE CIRCLE through it so the letters never kink on a polygon, pulls
   that arc inward until it clears both borders, and sizes the font by whichever is
   tighter: the arc length or the band thickness. The text is then centred on the arc
   (text-anchor=middle, startOffset=50%) and tracked to its own width, so a three-letter
   rim sits compactly at the crown instead of being stretched end to end. */

const MOTTO='Never fly alone';
const DEFAULT_STAMP={shape:'seal',code:'',sym:'tick',ring:'',pattern:'stars',font:'normal',ink:null,seed:1};
const PALETTE=[
 {n:'Midnight',l:.34,c:.09,h:268},{n:'Lapiz',l:.48,c:.22,h:264},{n:'Miami',l:.74,c:.13,h:210},{n:'Baby',l:.84,c:.075,h:228},{n:'Powder',l:.76,c:.045,h:255},{n:'Glacier',l:.92,c:.03,h:205},
 {n:'Teal',l:.58,c:.1,h:200},{n:'Seafoam',l:.82,c:.09,h:172},{n:'Emerald',l:.58,c:.16,h:158},{n:'Racing',l:.38,c:.08,h:162},{n:'Sage',l:.72,c:.05,h:150},{n:'Matcha',l:.765,c:.152,h:126},
 {n:'Olive',l:.52,c:.09,h:120},{n:'Khaki',l:.7,c:.07,h:90},{n:'Sand',l:.86,c:.045,h:85},{n:'Butter',l:.92,c:.1,h:100},{n:'Honey',l:.78,c:.15,h:75},{n:'Papaya',l:.78,c:.15,h:62},
 {n:'Clementine',l:.72,c:.19,h:48},{n:'Coral',l:.72,c:.16,h:28},{n:'Ruby',l:.56,c:.22,h:22},{n:'Cherry',l:.46,c:.17,h:15},{n:'Peach',l:.84,c:.08,h:55},{n:'Latte',l:.78,c:.05,h:65},
 {n:'Mocha',l:.58,c:.06,h:45},{n:'Espresso',l:.38,c:.05,h:40},{n:'Nardo',l:.64,c:.008,h:240},{n:'Gunmetal',l:.46,c:.02,h:250},{n:'Chalk',l:.94,c:.008,h:90},{n:'Mauve',l:.64,c:.07,h:340},
 {n:'Blush',l:.84,c:.065,h:10},{n:'Bubblegum',l:.78,c:.15,h:355},{n:'Barbie',l:.63,c:.25,h:355},{n:'Lilac',l:.8,c:.08,h:312},{n:'Lavender',l:.7,c:.12,h:292},{n:'Plum',l:.42,c:.12,h:330}];
let MYSTAMP={...DEFAULT_STAMP}, ISSUED=null;
const col=(c,l)=>`oklch(${l??c.l??.64} ${c.c} ${c.h})`;
const SHAPES={
 seal:{o:()=>{let d='';const n=30;for(let i=0;i<n*2;i++){const r=i%2?16.4:18.4;const a=i/(n*2)*Math.PI*2-Math.PI/2;d+=(i?'L':'M')+(20+r*Math.cos(a)).toFixed(2)+','+(20+r*Math.sin(a)).toFixed(2)}return `<path d="${d}Z" stroke-width="1.2"/>`}},
 roundel:{o:()=>'<circle cx="20" cy="20" r="18.2" stroke-width="1.35"/><circle cx="20" cy="20" r="17.1" stroke-width=".32"/><circle cx="20" cy="20" r="14.6" stroke-width=".75"/><circle cx="20" cy="20" r="13.9" stroke-width=".28"/>'},
 window:{o:()=>'<rect x="6.5" y="1.8" width="27" height="36.4" rx="13.5" stroke-width="1.5"/><rect x="7.8" y="3.1" width="24.4" height="33.8" rx="12.2" stroke-width=".4"/>'},
 gauge:{o:()=>`<rect x="2.4" y="2.4" width="35.2" height="35.2" rx="6" stroke-width="1.4"/><circle cx="20" cy="20" r="15.6" stroke-width="1"/><circle cx="20" cy="20" r="14.8" stroke-width=".3"/>${[[6.6,6.6],[33.4,6.6],[6.6,33.4],[33.4,33.4]].map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="1.5" stroke-width=".6"/><path d="M${x-1} ${y+(i%2?-.5:.5)}L${x+1} ${y+(i%2?.5:-.5)}" stroke-width=".5"/>`).join('')}`},
 postage:{o:()=>`<path d="${postageP()}" stroke-width="1.2"/><rect x="6.2" y="6.2" width="27.6" height="27.6" stroke-width=".4"/>`},
 tag:{o:()=>`<path d="M9 6.5H36a1.6 1.6 0 0 1 1.6 1.6V31.9a1.6 1.6 0 0 1-1.6 1.6H9L2.4 26.4V13.6Z" stroke-width="1.3"/><circle cx="7.6" cy="20" r="1.9" stroke-width=".7"/><circle cx="7.6" cy="20" r="3" stroke-width=".35"/><path d="M11.8 8.6V31.4" stroke-width=".35" stroke-dasharray=".9 .9"/>`},
 shield:{o:()=>`<path d="${SHIELD}" stroke-width="1.4"/><path d="${SHIELD}" transform="${sc(.915)}" stroke-width=".4"/>`},


 hex:{o:()=>`<path d="${hexP(18.4)}" stroke-width="1.35" stroke-linejoin="round"/><path d="${hexP(16.9)}" stroke-width=".38" stroke-linejoin="round"/>`},


};
const MARKS={
 tick:'<path d="M14.5 20.5 18.5 24.5 26 16" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
 plane:'<path d="M20 11.5c.9 0 1.3.9 1.3 1.9v4.3l6.4 3.9v1.9l-6.4-2v3.8l2 1.6v1.5L20 27.5l-3.3.9v-1.5l2-1.6v-3.8l-6.4 2v-1.9l6.4-3.9v-4.3c0-1 .4-1.9 1.3-1.9Z" stroke="none"/>',
 wrench:'<path d="M24.8 12.2a4.6 4.6 0 0 0-5.9 5.8l-6.3 6.3a1.6 1.6 0 0 0 2.3 2.3l6.3-6.3a4.6 4.6 0 0 0 5.8-5.9l-2.7 2.7-2.3-.6-.6-2.3Z" stroke="none"/>',
 prop:'<g stroke="none"><ellipse cx="20" cy="14.2" rx="2.6" ry="5.6"/><ellipse cx="20" cy="14.2" rx="2.6" ry="5.6" transform="rotate(120 20 20)"/><ellipse cx="20" cy="14.2" rx="2.6" ry="5.6" transform="rotate(240 20 20)"/></g><circle cx="20" cy="20" r="2.2" stroke="none" fill="currentColor"/><circle cx="20" cy="20" r=".9" stroke="none" fill="var(--bgc,#0b1220)"/>',
 wings:'<path d="M20 17.5c-1.6 0-2.6 1-2.6 2.5s1 2.5 2.6 2.5 2.6-1 2.6-2.5-1-2.5-2.6-2.5ZM16.4 19.2c-3-1.6-6.8-2.2-10.4-1.4 1.6 1 3.6 1.4 5.4 1.5-1.4.3-2.7.8-3.8 1.6 2.2.3 4.8.1 7-.5-1 .4-1.9 1-2.6 1.7 1.8 0 3.4-.5 4.6-1.3ZM23.6 19.2c3-1.6 6.8-2.2 10.4-1.4-1.6 1-3.6 1.4-5.4 1.5 1.4.3 2.7.8 3.8 1.6-2.2.3-4.8.1-7-.5 1 .4 1.9 1 2.6 1.7-1.8 0-3.4-.5-4.6-1.3Z" stroke="none"/>',
 wheart:'<path d="M20 26.5c-4.2-3-6.4-5.3-6.4-8 0-1.9 1.4-3.2 3.1-3.2 1.4 0 2.6.8 3.3 2 .7-1.2 1.9-2 3.3-2 1.7 0 3.1 1.3 3.1 3.2 0 2.7-2.2 5-6.4 8Z" stroke="none"/><path d="M12.9 18.4c-2.4-.9-5-1-7.4-.2 1.3.8 2.8 1 4.2 1-1 .3-1.8.8-2.5 1.4 1.7.2 3.5 0 5.2-.5M27.1 18.4c2.4-.9 5-1 7.4-.2-1.3.8-2.8 1-4.2 1 1 .3 1.8.8 2.5 1.4-1.7.2-3.5 0-5.2-.5" stroke-width="1.1" stroke-linecap="round" fill="none"/>',
 bolt:'<path d="M21.6 10.5 14 21.6h5.1L18 29.5l7.9-11.3h-5.2Z" stroke="none"/>',
 sparkle:'<path d="M20 10.5c.7 4.6 2.9 6.8 7.5 7.5-4.6.7-6.8 2.9-7.5 7.5-.7-4.6-2.9-6.8-7.5-7.5 4.6-.7 6.8-2.9 7.5-7.5Z" stroke="none"/><path d="M27.5 24.5c.3 1.6 1 2.3 2.6 2.6-1.6.3-2.3 1-2.6 2.6-.3-1.6-1-2.3-2.6-2.6 1.6-.3 2.3-1 2.6-2.6Z" stroke="none"/>',
 star:'<path d="m20 12 2.4 5.1 5.6.6-4.2 3.8 1.2 5.5L20 24.2 15 27l1.2-5.5-4.2-3.8 5.6-.6Z" stroke="none"/>',
};
const SYMS=['plane','wrench','prop'];
const inkVal=k=>!k?'var(--accent)':(typeof k==='string'?k:col(k,Math.max(k.l??.64,.58)));
function inkFilter(seed){const id='ink2_'+seed;if(!document.getElementById(id)){const d=document.querySelector('svg defs');
  const f=document.createElementNS('http://www.w3.org/2000/svg','filter');f.id=id;f.setAttribute('x','-6%');f.setAttribute('y','-6%');f.setAttribute('width','112%');f.setAttribute('height','112%');f.setAttribute('color-interpolation-filters','sRGB');
  const px=(seed*37%100)/100;
  f.innerHTML=`<feTurbulence type="fractalNoise" baseFrequency="2.1" numOctaves="2" seed="${seed*17+3}" result="fine"/>
   <feDisplacementMap in="SourceGraphic" in2="fine" scale=".42" xChannelSelector="R" yChannelSelector="G" result="rough"/>
   <feGaussianBlur in="rough" stdDeviation=".12" result="soft"/>
   <feColorMatrix in="fine" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.9 1.78" result="grain"/>
   <feTurbulence type="fractalNoise" baseFrequency=".055" numOctaves="1" seed="${seed*29+11}" result="coarse"/>
   <feColorMatrix in="coarse" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.9 ${(.05+px*.1).toFixed(2)}" result="press"/>
   <feComposite in="grain" in2="press" operator="arithmetic" k1="1" result="m"/>
   <feComposite in="soft" in2="m" operator="in"/>`;d.appendChild(f)}return id}
let RID=0;
const star4=(x,y,r)=>`<path d="M${x} ${y-r}L${x+r*.3} ${y-r*.3}L${x+r} ${y}L${x+r*.3} ${y+r*.3}L${x} ${y+r}L${x-r*.3} ${y+r*.3}L${x-r} ${y}L${x-r*.3} ${y-r*.3}Z" fill="currentColor" stroke="none"/>`;
const PATTERNS={none:'None',rays:'Rays',checks:'Checks',guilloche:'Guilloche',crochet:'Crochet',knurl:'Knurl'};
const star5=(x,y,r)=>{let d='';for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.42:r;d+=(i?'L':'M')+(x+rr*Math.cos(a)).toFixed(2)+' '+(y+rr*Math.sin(a)).toFixed(2)}return `<path d="${d}Z" fill="currentColor" stroke="none"/>`};
function patternArt(p,a,b){let o='';
  if(p==='rays'){for(let t=0;t<360;t+=10){const q=t*Math.PI/180;o+=`<path d="M${(20+2*Math.cos(q)).toFixed(2)} ${(20+2*Math.sin(q)).toFixed(2)}L${(20+20*Math.cos(q)).toFixed(2)} ${(20+20*Math.sin(q)).toFixed(2)}" stroke-width="${t%20?.22:.42}"/>`}}
  if(p==='checks'){const z=1.8;for(let y=a,i=0;y<b;y+=z,i++)for(let x=a,j=0;x<b;x+=z,j++)if((i+j)%2===0)o+=`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${z}" height="${z}" fill="currentColor" stroke="none"/>`}
  return o}
const shade=ink=>{if(!ink)return 'color-mix(in oklab,var(--accent) 55%,var(--ground))';const l=ink.l??.64;return `oklch(${(l>.66?l-.2:l+.18).toFixed(2)} ${Math.max(.02,ink.c*.8).toFixed(3)} ${ink.h+(ink.c>.05?12:0)})`};
function rosetteP(R,n){const pts=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2-Math.PI/2;pts.push([20+R*Math.cos(a),20+R*Math.sin(a)])}const rb=(R*Math.sin(Math.PI/n)*1.12).toFixed(2);
  let d=`M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;for(let i=1;i<=n;i++){const p=pts[i%n];d+=`A${rb} ${rb} 0 0 1 ${p[0].toFixed(2)} ${p[1].toFixed(2)}`}return d+'Z'}
function postageP(){const a=3,b=37,r=.95,st=3.4;let d=`M${a} ${a}`;const n=Math.floor((b-a)/st),off=(b-a-(n-1)*st)/2;
  for(let i=0;i<n;i++){const x=a+off+i*st;d+=`L${(x-r).toFixed(2)} ${a}A${r} ${r} 0 0 0 ${(x+r).toFixed(2)} ${a}`}d+=`L${b} ${a}`;
  for(let i=0;i<n;i++){const y=a+off+i*st;d+=`L${b} ${(y-r).toFixed(2)}A${r} ${r} 0 0 0 ${b} ${(y+r).toFixed(2)}`}d+=`L${b} ${b}`;
  for(let i=0;i<n;i++){const x=b-off-i*st;d+=`L${(x+r).toFixed(2)} ${b}A${r} ${r} 0 0 0 ${(x-r).toFixed(2)} ${b}`}d+=`L${a} ${b}`;
  for(let i=0;i<n;i++){const y=b-off-i*st;d+=`L${a} ${(y+r).toFixed(2)}A${r} ${r} 0 0 0 ${a} ${(y-r).toFixed(2)}`}return d+'Z'}
function wingP(side){const x0=20+side*12.3,f=[[15.2,7.2,1.7],[17.9,6.6,1.6],[20.6,5.6,1.5],[23.2,4.3,1.3],[25.6,2.9,1.1]];
  return f.map(([y,len,w])=>{const x1=x0+side*len,ty=y-len*.42,mx=(x0+x1)/2;
    return `<path d="M${x0.toFixed(2)} ${(y-w/2).toFixed(2)}Q${mx.toFixed(2)} ${(y-w*.55-len*.14).toFixed(2)} ${x1.toFixed(2)} ${ty.toFixed(2)}Q${(mx+side*.6).toFixed(2)} ${(y+w*.1-len*.12).toFixed(2)} ${x0.toFixed(2)} ${(y+w/2).toFixed(2)}Z"/>`}).join('')}
const sc=k=>`translate(20 20) scale(${k}) translate(-20 -20)`;
const circ=r=>`M${20-r} 20a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 ${-2*r} 0Z`;
const hexP=R=>{const p=[0,60,120,180,240,300].map(d=>{const a=d*Math.PI/180;return `${(20+R*Math.cos(a)).toFixed(2)} ${(20+R*Math.sin(a)).toFixed(2)}`});return 'M'+p.join('L')+'Z'};
const SHIELD='M20 1.5 36.5 7V19c0 10-7.4 16.6-16.5 19.6C10.9 35.6 3.5 29 3.5 19V7Z';
/* a ring of petals; k controls how round the petal is (1 = shallow, 1.5 = full) */
const petalRing=(R,n,k=1.3,off=0)=>{const pts=[];for(let i=0;i<n;i++){const a=off+i/n*Math.PI*2-Math.PI/2;pts.push([20+R*Math.cos(a),20+R*Math.sin(a)])}
  const rb=(R*Math.sin(Math.PI/n)*k).toFixed(2);let d=`M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for(let i=1;i<=n;i++){const q=pts[i%n];d+=`A${rb} ${rb} 0 0 1 ${q[0].toFixed(2)} ${q[1].toFixed(2)}`}return d+'Z'};
const polyP=(n,R,rot=0)=>{const p=[];for(let i=0;i<n;i++){const a=rot+i/n*Math.PI*2-Math.PI/2;p.push(`${(20+R*Math.cos(a)).toFixed(2)} ${(20+R*Math.sin(a)).toFixed(2)}`)}return 'M'+p.join('L')+'Z'};
/* how many modules a full licence covers, and where the endorsement band sits */
const MODS_TOTAL=13, TIERS=[.34,.67,1];
/* Progression as outlines. Each tier adds a line that follows the stamp's own
   outline, pushed outward — so a rose grows rose-shaped rings and a ticket grows
   ticket-shaped ones. It only ever adds, so an old sign-off and a new one can
   show the same stamp without either being a lie. */
function endorseArt(n,Ly){if(!n||n<1)return '';
  const frac=Math.min(1,n/MODS_TOTAL),done=frac>=1;
  let tier=0;TIERS.forEach(t=>{if(frac>=t)tier++});
  if(!tier)return '';
  const base=Ly.fill;let o='';
  for(let k=1;k<=tier;k++){
    const last=k===tier;
    o+=`<path d="${base}" transform="${sc(1+k*.078)}" stroke-width="${done&&last?'.8':last?'.42':'.24'}"/>`}
  if(done)o+=`<path d="${base}" transform="${sc(1+tier*.078+.042)}" stroke-width=".22"/>`;
  return o}
function polyTrim(pts,t){const seg=[];let tot=0;for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);seg.push(d);tot+=d}
  const at=dist=>{let acc=0;for(let i=0;i<seg.length;i++){if(acc+seg[i]>=dist){const f=(dist-acc)/seg[i];return [pts[i][0]+(pts[i+1][0]-pts[i][0])*f,pts[i][1]+(pts[i+1][1]-pts[i][1])*f,i]}acc+=seg[i]}return [...pts[pts.length-1],seg.length-1]};
  const [x0,y0,i0]=at(t),[x1,y1,i1]=at(tot-t);let d=`M${x0.toFixed(2)} ${y0.toFixed(2)}`;for(let i=i0+1;i<=i1;i++)d+=`L${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)}`;d+=`L${x1.toFixed(2)} ${y1.toFixed(2)}`;return [d,(tot-2*t).toFixed(2)]}
function bezLen(p){let L=0,px=p[0],py=p[1];for(let k=1;k<=40;k++){const t=k/40,u=1-t,x=u*u*u*p[0]+3*u*u*t*p[2]+3*u*t*t*p[4]+t*t*t*p[6],y=u*u*u*p[1]+3*u*u*t*p[3]+3*u*t*t*p[5]+t*t*t*p[7];L+=Math.hypot(x-px,y-py);px=x;py=y}return L}
function layout(shape){
  if(shape==='hex'){const r=12.1,g=17*Math.PI/180,pt=a=>`${(20+r*Math.cos(a)).toFixed(2)} ${(20+r*Math.sin(a)).toFixed(2)}`,L=(r*(Math.PI-2*g)).toFixed(2);
    return {fill:hexP(18.2),frame:'<circle cx="20" cy="20" r="9.1" stroke-width=".9"/><circle cx="20" cy="20" r="8.3" stroke-width=".3"/>',inner:circ(9.4),band:hexP(15.8),
      top:`M${pt(Math.PI+g)}A${r} ${r} 0 0 1 ${pt(-g)}`,tl:L,bot:`M${pt(Math.PI-g)}A${r} ${r} 0 0 0 ${pt(g)}`,bl:L,stars:[[20-r,20],[20+r,20]],fz:[3.4,3],star:1.3,rimOut:[hexP(16.9),.19],rimSpan:[48,56],ring:{type:'circle',ri:9.1,ro:15.4},clip:hexP(18)}}
  if(shape==='cog'){const r=11.9,g=17*Math.PI/180,pt=a=>`${(20+r*Math.cos(a)).toFixed(2)} ${(20+r*Math.sin(a)).toFixed(2)}`,L=(r*(Math.PI-2*g)).toFixed(2);
    return {fill:circ(18.2),frame:'<circle cx="20" cy="20" r="8.7" stroke-width=".85"/><circle cx="20" cy="20" r="7.9" stroke-width=".3"/>',inner:circ(9),band:circ(14.1),
      top:`M${pt(Math.PI+g)}A${r} ${r} 0 0 1 ${pt(-g)}`,tl:L,bot:`M${pt(Math.PI-g)}A${r} ${r} 0 0 0 ${pt(g)}`,bl:L,stars:[[20-r,20],[20+r,20]],fz:[3.2,2.8],star:1.2,ring:{type:'circle',ri:8.7,ro:14.2},clip:circ(15.2)}}
  if(shape==='ticket')return {fill:'M4.4 8.6H29.2A1.4 1.4 0 0 0 32 8.6H35.6a1.8 1.8 0 0 1 1.8 1.8V29.6a1.8 1.8 0 0 1-1.8 1.8H32A1.4 1.4 0 0 0 29.2 31.4H4.4a1.8 1.8 0 0 1-1.8-1.8V10.4a1.8 1.8 0 0 1 1.8-1.8Z',
    frame:'<rect x="9" y="14" width="15.4" height="12" rx="1.5" stroke-width=".85"/><rect x="9.8" y="14.8" width="13.8" height="10.4" rx="1" stroke-width=".3"/>',
    inner:'M9.4 14.4H24V25.6H9.4Z',band:'M5.4 11.2H27.4V28.8H5.4Z',
    top:'M5.8 12.4H28.2',tl:'22.4',bot:'M5.8 27.6H28.2',bl:'22.4',stars:[[4.8,20],[29.2,20]],fz:[2.95,2.4],star:1,cx:16.7,
    ring:{type:'rect',a:[9,14,24.4,26],b:[4.2,10.4,29,29.6]},clip:'M4.4 8.6H29.2A1.4 1.4 0 0 0 32 8.6H35.6a1.8 1.8 0 0 1 1.8 1.8V29.6a1.8 1.8 0 0 1-1.8 1.8H32A1.4 1.4 0 0 0 29.2 31.4H4.4a1.8 1.8 0 0 1-1.8-1.8V10.4a1.8 1.8 0 0 1 1.8-1.8Z'};
  if(shape==='shield'){const rt=12.4,rb=11.5,gt=21*Math.PI/180,gb=30*Math.PI/180;
    const pt=(r,a)=>`${(20+r*Math.cos(a)).toFixed(2)} ${(20+r*Math.sin(a)).toFixed(2)}`;
    return {fill:SHIELD,frame:'<circle cx="20" cy="20" r="9.1" stroke-width=".9"/><circle cx="20" cy="20" r="8.3" stroke-width=".3"/>',inner:circ(9.4),band:SHIELD,
      top:`M${pt(rt,Math.PI+gt)}A${rt} ${rt} 0 0 1 ${pt(rt,-gt)}`,tl:(rt*(Math.PI-2*gt)).toFixed(2),
      bot:`M${pt(rb,Math.PI-gb)}A${rb} ${rb} 0 0 0 ${pt(rb,gb)}`,bl:(rb*(Math.PI-2*gb)).toFixed(2),
      stars:[[20-rt,19.4],[20+rt,19.4]],fz:[3.3,2.8],star:1.25,rimOut:[SHIELD,1.75],rimSpan:[56,66],ring:{type:'circle',ri:9.1,ro:15},clip:SHIELD}}
  if(shape==='postage')return {fill:'M3 3H37V37H3Z',frame:'<rect x="12.2" y="13" width="15.6" height="14" rx="1.6" stroke-width=".8"/>',inner:'M12.6 13.4H27.4V26.6H12.6Z',band:'M6.6 6.6H33.4V33.4H6.6Z',
    top:'M9.4 9.9H30.6',tl:'21.2',bot:'M9.4 30.1H30.6',bl:'21.2',stars:[[9.3,20],[30.7,20]],fz:[2.9,2.25],ring:{type:'rect',a:[12.2,13,27.8,27],b:[6.3,6.3,33.7,33.7]},clip:'M6.6 6.6H33.4V33.4H6.6Z'};
  if(shape==='tag')return {fill:'M9 6.5H37.6V33.5H9L2.4 26.4V13.6Z',frame:'<rect x="16.6" y="14.4" width="16.8" height="11.2" rx="1.4" stroke-width=".8"/>',inner:'M17 14.8H33V25.2H17Z',band:'M13 8.6H36V31.4H13Z',
    top:'M14.6 11H35.4',tl:'20.8',bot:'M14.6 29H35.4',bl:'20.8',stars:[[14.4,20],[35.6,20]],fz:[2.8,2.15],star:1.05,cx:25,ring:{type:'rect',a:[16.6,14.4,33.4,25.6],b:[12.2,6.7,37.4,33.3]},clip:'M12.4 7.2H35.9a1.2 1.2 0 0 1 1.2 1.2V31.6a1.2 1.2 0 0 1-1.2 1.2H12.4Z'};
  if(shape==='window'){const r=10.15,g=22*Math.PI/180,pa=(cy,a)=>`${(20+r*Math.cos(a)).toFixed(2)} ${(cy+r*Math.sin(a)).toFixed(2)}`,L=(r*(Math.PI-2*g)).toFixed(2);
    return {fill:'M6.5 15.3a13.5 13.5 0 0 1 27 0V24.7a13.5 13.5 0 0 1-27 0Z',frame:'<rect x="12.9" y="13.6" width="14.2" height="12.8" rx="3.2" stroke-width=".85"/><rect x="13.7" y="14.4" width="12.6" height="11.2" rx="2.6" stroke-width=".3"/>',inner:'M13.3 14H26.7V26H13.3Z',band:'M8.9 15.3a11.1 11.1 0 0 1 22.2 0V24.7a11.1 11.1 0 0 1-22.2 0Z',
      top:`M${pa(15.3,Math.PI+g)}A${r} ${r} 0 0 1 ${pa(15.3,-g)}`,tl:L,bot:`M${pa(24.7,Math.PI-g)}A${r} ${r} 0 0 0 ${pa(24.7,g)}`,bl:L,stars:[[10.4,20],[29.6,20]],fz:[2.7,2.25],star:1,rimOut:['M7.8 15.3a12.2 12.2 0 0 1 24.4 0V24.7a12.2 12.2 0 0 1-24.4 0Z',.2],rimIn:'M12.5 13.2H27.5V26.8H12.5Z',rimSpan:[58,68],ring:{type:'rect',a:[12.9,13.6,27.1,26.4],b:[7.6,2.9,32.4,37.1]},clip:'M8.3 15.3a11.7 11.7 0 0 1 23.4 0V24.7a11.7 11.7 0 0 1-23.4 0Z'}}
  if(shape==='roundel'){const r=12.5,g=33*Math.PI/180,pt=a=>`${(20+r*Math.cos(a)).toFixed(2)} ${(20+r*Math.sin(a)).toFixed(2)}`,L=(r*(Math.PI-2*g)).toFixed(2);
    return {fill:circ(16.2),frame:'<rect x="1.2" y="14.8" width="37.6" height="10.4" rx="1.2" stroke-width="1.3"/><rect x="2.3" y="15.9" width="35.4" height="8.2" rx=".6" stroke-width=".35"/>',inner:'M2.6 16.2H37.4V23.8H2.6Z',band:circ(15.8),
      top:`M${pt(Math.PI+g)}A${r} ${r} 0 0 1 ${pt(-g)}`,tl:L,bot:`M${pt(Math.PI-g)}A${r} ${r} 0 0 0 ${pt(g)}`,bl:L,stars:[],fz:[3.1,2.3],rimOut:[circ(13.9),.14],rimIn:'M0.55 14.15H39.45V25.85H0.55Z',ring:{type:'circle',ri:5.4,ro:16.6},bar:true,clip:circ(16.1)}}
  if(shape==='gauge'){const r=11.9,g=17*Math.PI/180,pt=a=>`${(20+r*Math.cos(a)).toFixed(2)} ${(20+r*Math.sin(a)).toFixed(2)}`,L=(r*(Math.PI-2*g)).toFixed(2);
    return {fill:circ(14.6),frame:'<circle cx="20" cy="20" r="8.7" stroke-width=".85"/><circle cx="20" cy="20" r="7.9" stroke-width=".3"/>',inner:circ(9),band:circ(14.2),
      top:`M${pt(Math.PI+g)}A${r} ${r} 0 0 1 ${pt(-g)}`,tl:L,bot:`M${pt(Math.PI-g)}A${r} ${r} 0 0 0 ${pt(g)}`,bl:L,stars:[[20-r,20],[20+r,20]],fz:[3.2,2.8],star:1.2,rimOut:[circ(14.8),.15],rimSpan:[64,72],ring:{type:'circle',ri:8.7,ro:15},clip:circ(14.5)}}
  const r=shape==='compass'?12:12.8,g=16*Math.PI/180,pt=a=>`${(20+r*Math.cos(a)).toFixed(2)} ${(20+r*Math.sin(a)).toFixed(2)}`,L=(r*(Math.PI-2*g)).toFixed(2);
  const cp=shape==='compass',ri=cp?8.8:9.4;
  return {fill:circ(cp?15.2:16.2),frame:`<circle cx="20" cy="20" r="${ri}" stroke-width=".9"/><circle cx="20" cy="20" r="${ri-.8}" stroke-width=".3"/>`,inner:circ(ri+.3),band:circ(cp?14.2:15.3),
    top:`M${pt(Math.PI+g)}A${r} ${r} 0 0 1 ${pt(-g)}`,tl:L,bot:`M${pt(Math.PI-g)}A${r} ${r} 0 0 0 ${pt(g)}`,bl:L,stars:[[20-r,20],[20+r,20]],fz:cp?[3.3,2.9]:[3.5,3.1],star:cp?1.2:1.35,rimOut:[circ(cp?15.1:16.4),.6],rimSpan:[64,72],ring:{type:'circle',ri:ri,ro:16.8},clip:circ(16)};
}
/* Patterns follow the shape, not a circle: both boundaries of the band are real
   paths, sampled by arc length, and the pattern is drawn between them. */
const _PS={};
function pathPts(d){if(_PS[d])return _PS[d];
  const svg=document.querySelector('svg defs').parentNode;
  const el=document.createElementNS('http://www.w3.org/2000/svg','path');el.setAttribute('d',d);svg.appendChild(el);
  const L=el.getTotalLength(),N=480,pts=[];
  for(let i=0;i<=N;i++){const q=el.getPointAtLength(L*i/N);pts.push([q.x,q.y])}
  el.remove();return _PS[d]={pts,N}}
function ptAt(d,t){const {pts,N}=pathPts(d);const u=((t%1)+1)%1*N,i=Math.floor(u),f=u-i,a=pts[i],b=pts[(i+1)%N];
  return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]}
/* The rim text follows the shape, not a circle: read the outline's radius at every
   angle, smooth it, then sit the line a fixed way between the code frame and the edge. */
const _RAD={};
function radii(d){const key=d;if(_RAD[key])return _RAD[key];
  const {pts,N}=pathPts(d),M=360,r=new Array(M).fill(0);
  for(let i=0;i<N;i++){const dx=pts[i][0]-20,dy=pts[i][1]-20;
    let a=Math.atan2(dy,dx)*180/Math.PI;if(a<0)a+=360;
    const b=Math.round(a)%M,v=Math.hypot(dx,dy);if(v>r[b])r[b]=v}
  for(let b=0;b<M;b++)if(!r[b]){let p=b,n=b;while(!r[(p+M-1)%M])p--;while(!r[(n+1)%M])n++;
    r[b]=(r[(p+M-1)%M]+r[(n+1)%M])/2}
  const sm=new Array(M);for(let b=0;b<M;b++){let t=0;for(let j=-3;j<=3;j++)t+=r[(b+j+M)%M];sm[b]=t/7}
  return _RAD[key]=sm}
/* The rim line is cut from the outline itself. It keeps a constant clearance
   inside the rim — dead centre when the band is thin — and it stops running
   down the sides the moment the band is too thin to hold the letters. */
const nrm=v=>Array.isArray(v)?v:[v,0];
/* Letters must never kink. Whatever the outline does, the line they sit on is a
   true arc: fit a circle to the ideal path, then pull it in until it clears
   both borders. A straight-ish edge just gives a very large radius. */
function fitArc(pts){const n=pts.length;let Sx=0,Sy=0,Sxx=0,Syy=0,Sxy=0,Sz=0,Sxz=0,Syz=0;
  for(const [x,y] of pts){const z=x*x+y*y;Sx+=x;Sy+=y;Sxx+=x*x;Syy+=y*y;Sxy+=x*y;Sz+=z;Sxz+=x*z;Syz+=y*z}
  const M=[[Sxx,Sxy,Sx],[Sxy,Syy,Sy],[Sx,Sy,n]],V=[Sxz,Syz,Sz],
    dt=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]),
    D=dt(M);
  if(Math.abs(D)<1e-7)return null;
  const rep=k=>{const A=M.map(r=>r.slice());for(let i=0;i<3;i++)A[i][k]=V[i];return dt(A)/D},
    cx=rep(0)/2,cy=rep(1)/2,R2=rep(2)+cx*cx+cy*cy;
  return R2>0?{cx,cy,R:Math.sqrt(R2)}:null}

function rimRun(out,inn,base,len,down,cap){
  const M=1.05,RO=radii(out[0]),RI=radii(inn[0]),
    g=a=>((Math.round(a)%360)+360)%360,
    ro=a=>RO[g(a)]-out[1],th=a=>ro(a)-RI[g(a)]-inn[1],C=down?90:270,
    rr=(a,f)=>ro(a)-Math.min(Math.max(th(a),0)/2,f*.5+M);
  const span=f=>{const need=f*.8+M*2;let s=0;
    while(s<cap&&th(C+s+1)>=need&&th(C-s-1)>=need)s++;return Math.max(22,s)};
  const build=(s,f)=>{const raw=[];let tmin=1e9;
    for(let a=C-s;a<=C+s+1e-6;a+=1.5){const t=a*Math.PI/180,q=rr(a,f);
      raw.push([20+q*Math.cos(t),20+q*Math.sin(t)]);tmin=Math.min(tmin,th(a))}
    let pts=raw;const F=fitArc(raw),cl=f*.5+.92;
    if(F&&F.R<400&&F.R>4){let Rk=F.R;
      const an=q=>Math.atan2(q[1]-F.cy,q[0]-F.cx);
      let a0=an(raw[0]),a1=an(raw[raw.length-1]);
      while(a1-a0>Math.PI)a1-=2*Math.PI;while(a1-a0<-Math.PI)a1+=2*Math.PI;
      const walk=Rw=>{const q=[];for(let i=0;i<=40;i++){const t=a0+(a1-a0)*i/40;
        q.push([F.cx+Rw*Math.cos(t),F.cy+Rw*Math.sin(t)])}return q};
      const viol=Rw=>{let hi=0,lo=0;
        for(const [x,y] of walk(Rw)){const dx=x-20,dy=y-20;let g2=Math.atan2(dy,dx)*180/Math.PI;if(g2<0)g2+=360;
          const q=Math.hypot(dx,dy);
          hi=Math.max(hi,q-(ro(g2)-cl));lo=Math.max(lo,RI[((Math.round(g2)%360)+360)%360]+inn[1]+cl-q)}
        return [hi,lo]};
      for(let k=0;k<20;k++){const [hi,lo]=viol(Rk);
        if(hi<.03&&lo<.03)break;
        const step=Math.min(hi,.5)-Math.min(lo,.5);
        if(Math.abs(step)<.01)break;
        Rk=Math.max(3,Rk-step)}
      /* an arc that still cannot clear both borders loses to the exact path */
      if(viol(Rk)[0]<.18)pts=walk(Rk)}
    if(down)pts.reverse();
    let L=0;for(let i=1;i<pts.length;i++)L+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
    return {d:'M'+pts.map(q=>q[0].toFixed(2)+' '+q[1].toFixed(2)).join('L'),L,tmin}};
  let f=base,b;
  for(let i=0;i<5;i++){b=build(span(f),f);
    const nf=Math.max(1.8,Math.min(base*1.14,b.L/(Math.max(1,len)*1.06),(b.tmin-M*2)/.8));
    if(Math.abs(nf-f)<.02){f=nf;break}f=nf}
  b=build(span(f),f);
  return {d:b.d,L:b.L.toFixed(2),f:+f.toFixed(2),rr:rr(0,f)}}
function ringPt(R,t,d){if(R.type==='path'){const A=ptAt(R.a,t+(R.rot||0)),B=ptAt(R.b,t+(R.rot||0));
    return [A[0]+(B[0]-A[0])*d,A[1]+(B[1]-A[1])*d]}
  if(R.type==='circle'){const a=t*Math.PI*2-Math.PI/2,r=R.ri+(R.ro-R.ri)*d;return [20+r*Math.cos(a),20+r*Math.sin(a)]}
  const per=(q,t)=>{const [x0,y0,x1,y1]=q,w=x1-x0,h=y1-y0,P=2*(w+h);let u=((t%1)+1)%1*P;if(u<w)return [x0+u,y0];u-=w;if(u<h)return [x1,y0+u];u-=h;if(u<w)return [x1-u,y1];u-=w;return [x0,y1-u]};
  const A=per(R.a,t),B=per(R.b,t);return [A[0]+(B[0]-A[0])*d,A[1]+(B[1]-A[1])*d]}
function ringPattern(p,R){const f=v=>v.toFixed(2);let o='';
  /* how long the band is at a given depth, and how thick it is — so a pattern can be
     spaced by real distance instead of by a guessed count */
  const ringLen=(d,S=72)=>{let L=0,q=ringPt(R,0,d);for(let i=1;i<=S;i++){const w=ringPt(R,i/S,d);L+=Math.hypot(w[0]-q[0],w[1]-q[1]);q=w}return L};
  const thick=()=>{let m=0;for(let i=0;i<8;i++){const a=ringPt(R,i/8,0),b=ringPt(R,i/8,1);m+=Math.hypot(b[0]-a[0],b[1]-a[1])}return m/8};
  if(p==='rays'){const N=R.round?48:56;for(let i=0;i<N;i++){const t=i/N,[x1,y1]=ringPt(R,t,R.tight?.18:.1),[x2,y2]=ringPt(R,t,i%2?.72:1.02);o+=`<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke-width="${i%2?.35:.55}" stroke-linecap="round"/>`}}
  if(p==='waves'){(R.tight?[.2,.34,.48,.62,.76,.9]:[.16,.38,.6,.82,1.02]).forEach((d0,k)=>{let d='';const S=240;for(let i=0;i<=S;i++){const t=i/S,[x,y]=ringPt(R,t,d0+(R.tight?.035:.1)*Math.sin(t*Math.PI*2*(R.round?14:16)+k*1.4));d+=(i?'L':'M')+f(x)+' '+f(y)}o+=`<path d="${d}Z" stroke-width=".4"/>`})}
  if(p==='checks'){const N=R.round?32:36,rows=R.tight?4:3;for(let row=0;row<rows;row++)for(let i=0;i<N;i++){if((i+row)%2)continue;const hh=(R.tight?.8:.96)/rows,d0=(R.tight?.1:.04)+row*hh,d1=d0+hh,t0=i/N,t1=(i+1)/N,S=3;let pts=[];
    for(let k=0;k<=S;k++)pts.push(ringPt(R,t0+(t1-t0)*k/S,d0));for(let k=S;k>=0;k--)pts.push(ringPt(R,t0+(t1-t0)*k/S,d1));
    o+=`<path d="M${pts.map(([x,y])=>f(x)+' '+f(y)).join('L')}Z" fill="currentColor" stroke="none"/>`}}
  if(p==='guilloche'){const n=R.round?(R.tight?9:12):14,S=360;for(let k=0;k<6;k++){let d='';for(let i=0;i<=S;i++){const t=i/S,[x,y]=ringPt(R,t,.52+.46*Math.sin(t*Math.PI*2*n+k*Math.PI/3));d+=(i?'L':'M')+f(x)+' '+f(y)}o+=`<path d="${d}Z" stroke-width=".28"/>`}}
  if(p==='stars'){const rows=R.tight?3:2;
    for(let row=0;row<rows;row++){const h=(R.tight?.84:.92)/rows,d0=(R.tight?.1:.04)+row*h+h*.5;
      const N=Math.max(8,Math.round((R.round?20:22)*(.5+.5*d0)));
      for(let i=0;i<N;i++){const [x,y]=ringPt(R,(i+(row%2?.5:0))/N,d0);o+=star5(x,y,row%2?.62:.82)}}}
  if(p==='crochet'){const rows=R.tight?2:3;
    const bloom=(cx,cy,rad,pw)=>{let b='';
      for(let q=0;q<5;q++){const a=q/5*Math.PI*2-Math.PI/2,px=cx+Math.cos(a)*rad,py=cy+Math.sin(a)*rad;
        b+=`<ellipse cx="${f(px)}" cy="${f(py)}" rx="${(rad*.62).toFixed(2)}" ry="${(rad*.46).toFixed(2)}" transform="rotate(${(a*180/Math.PI+90).toFixed(1)} ${f(px)} ${f(py)})" stroke-width="${pw}"/>`}
      return b+`<circle cx="${f(cx)}" cy="${f(cy)}" r="${(rad*.34).toFixed(2)}" fill="currentColor" stroke="none"/>`};
    for(let row=0;row<rows;row++){const h=(R.tight?.9:.98)/rows,d0=(R.tight?.05:.01)+row*h;
      const n=R.round?(R.tight?6:9):10,S=300,amp=.33;
      let v='';for(let i=0;i<=S;i++){const t=i/S,[x,y]=ringPt(R,t,d0+h*(.5+amp*Math.sin(t*Math.PI*2*n+row*1.9)));v+=(i?'L':'M')+f(x)+' '+f(y)}
      o+=`<path d="${v}Z" stroke-width=".3"/>`;
      for(let k=0;k<n;k++){const t=(k+.25)/n+row*.5/n,[cx,cy]=ringPt(R,t,d0+h*(.5+amp));o+=bloom(cx,cy,.82,.2)}
      for(let k=0;k<n;k++){const t=(k+.75)/n+row*.5/n,[cx,cy]=ringPt(R,t,d0+h*(.5-amp));o+=bloom(cx,cy,.56,.18)}
      for(let k=0;k<n;k++)for(const sg of [-1,1]){const t=(k+.5+sg*.3)/n+row*.5/n,[cx,cy]=ringPt(R,t,d0+h*(.5+sg*amp*.42));o+=bloom(cx,cy,.36,.15)}
      for(let k=0;k<n;k++)for(const sg of [-1,1]){const t=(k+.5)/n+row*.5/n,[lx,ly]=ringPt(R,t,d0+h*.5),[mx,my]=ringPt(R,t+sg*.26/n,d0+h*(.5+sg*amp*.5));
        const bx=(lx+mx)/2,by=(ly+my)/2,nx=-(my-ly)*.5,ny=(mx-lx)*.5;
        o+=`<path d="M${f(lx)} ${f(ly)}Q${f(bx+nx)} ${f(by+ny)} ${f(mx)} ${f(my)}Q${f(bx-nx)} ${f(by-ny)} ${f(lx)} ${f(ly)}Z" stroke-width=".22"/>`}
      for(let k=0;k<n;k++){const t=(k+.06)/n+row*.5/n;let c='';const S2=12;
        for(let j=0;j<=S2;j++){const u=j/S2,[x,y]=ringPt(R,t+u*.24/n,d0+h*(.5+amp*.62)+u*h*.2*Math.sin(u*3.4));c+=(j?'L':'M')+f(x)+' '+f(y)}
        o+=`<path d="${c}" stroke-width=".17" stroke-linecap="round"/>`}
      for(let k=0;k<n;k++)for(const sg of [-1,1]){const t=(k+.5+sg*.16)/n+row*.5/n,[bx2,by2]=ringPt(R,t,d0+h*(.5-amp*.72));
        o+=`<ellipse cx="${f(bx2)}" cy="${f(by2)}" rx=".3" ry=".44" stroke-width=".16"/>`}}}
  if(p==='knurl'){const N=R.round?22:24,sk=R.tight?.09:.055,S=10;
    for(let sgn=-1;sgn<=1;sgn+=2)for(let i=0;i<N;i++){const t=i/N;let d='';
      for(let k=0;k<=S;k++){const dd=(R.tight?.08:.02)+k/S*(R.tight?.88:.97),[x,y]=ringPt(R,t+sgn*dd*sk,dd);d+=(k?'L':'M')+f(x)+' '+f(y)}
      o+=`<path d="${d}" stroke-width=".34"/>`}}
  return o}
function inspStamp(on,size=40,rot=0,st=MYSTAMP){
  const sh=SHAPES[st.shape]||SHAPES.seal, rim=st.rim!==false, id=++RID, Ly=layout(st.shape||'seal');
  const code=(st.code||'').toUpperCase().slice(0,3), sym=st.sym&&MARKS[st.sym]?st.sym:null;
  let o='',txt='',barPat='';
  const top=((st.ring||'').trim()||'WINGMAN').toUpperCase().slice(0,10),bot=MOTTO.toUpperCase();
  let RZ=null;
  if(rim&&Ly.rimOut&&Ly.inner){const O=nrm(Ly.rimOut),I=nrm(Ly.rimIn||Ly.inner);
    const SP=Ly.rimSpan||[72,72];
    const A=rimRun(O,I,Ly.fz[0],top.length,false,SP[0]),B=rimRun(O,I,Ly.fz[1],bot.length,true,SP[1]);
    Ly.top=A.d;Ly.tl=A.L;Ly.bot=B.d;Ly.bl=B.L;RZ=[A.f,B.f];
    if(Ly.stars&&Ly.stars.length)Ly.stars=[[20-A.rr,20],[20+A.rr,20]]}
  const big=1, cy=20, ccx=Ly.cx||20, sq=({seal:.98,window:.66,roundel:1.02,gauge:.86,tag:.64,postage:.76,shield:.96,hex:.96}[st.shape]||1);
  const cinkV=st.cink?inkVal(st.cink):null;
  const T=(extra,solo)=>{let t='';
    if(rim){const raw=(txt,arc,base)=>Math.max(1.9,Math.min(base*1.14,parseFloat(arc)/Math.max(1,txt.length)/1.06));
      let ft=RZ?RZ[0]:raw(top,Ly.tl,Ly.fz[0]),fb=RZ?RZ[1]:raw(bot,Ly.bl,Ly.fz[1]);
      if(ft>fb*1.32)ft=fb*1.32;
      const fit=(_a,_b,_c,v)=>v.toFixed(2);
      /* the line is centred on its corridor and tracked to its own width —
         a three-letter rim must not be stretched across the whole arc */
      const fitLen=(txt,arc,fs)=>Math.min(parseFloat(arc),txt.length*fs*1.06).toFixed(2);
      t+=`<text font-size="${fit(0,0,0,ft)}" font-weight="800" font-family="${FONTS.normal}" dominant-baseline="middle" text-anchor="middle" ${extra}><textPath href="#rt${id}" startOffset="50%" textLength="${fitLen(top,Ly.tl,ft)}" lengthAdjust="spacing">${top}</textPath></text>`;
      t+=`<text font-size="${fit(0,0,0,fb)}" font-weight="800" font-family="${FONTS.normal}" dominant-baseline="middle" text-anchor="middle" ${extra}><textPath href="#rb${id}" startOffset="50%" textLength="${fitLen(bot,Ly.bl,fb)}" lengthAdjust="spacing">${bot}</textPath></text>`;
      t+=Ly.stars.map(([x,y])=>star5(x,y,Ly.star||1.35)).join('')}
    if(!sym&&code){const fs=({1:11,2:9.3,3:7.9}[code.length])*big*sq;t+=`<text x="${ccx}" y="${(cy+fs*.355).toFixed(2)}" font-size="${fs.toFixed(2)}" text-anchor="middle" font-weight="700" letter-spacing="${(.3*big).toFixed(2)}" font-family="${FONTS.normal}" ${extra} ${solo&&cinkV?`fill="${cinkV}"`:''}>${code}</text>`}
    return t};
  if(rim)o+=`<path id="rt${id}" d="${Ly.top}" stroke="none"/><path id="rb${id}" d="${Ly.bot}" stroke="none"/>`;
  const p=st.pattern||'none';
  if(p!=='none'){
    const sco=st.pscope||'both';
    const outer=Ly.band||Ly.clip||Ly.fill, innerB=Ly.inner||circ(3);
    const R=sco==='centre'
      ? {type:'path',a:circ(.9),b:innerB,tight:true,round:true}
      : sco==='rim'
        ? {type:'path',a:innerB,b:outer,tight:false,round:true}
        : {type:'path',a:circ(.9),b:outer,tight:false,round:true};
    const halo=`<g fill="#000" stroke="#000" stroke-width="${rim?1.6:2.2}" stroke-linejoin="round">${T('')}${sym?`<g transform="translate(${ccx} ${cy}) scale(${(.62*big*sq).toFixed(2)}) translate(-20 -20)" stroke-width="3">${MARKS[sym]}</g>`:''}</g><g fill="none" stroke="#000" stroke-width="1.8">${Ly.frame}</g>`;
    const pcol=st.pink?inkVal(st.pink):null;
    const pat=`<mask id="pm${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="40" height="40"><rect width="40" height="40" fill="#fff"/>${halo}</mask><clipPath id="pk${id}"><path d="${Ly.clip||Ly.fill}"/></clipPath><g clip-path="url(#pk${id})" ${pcol?`style="color:${pcol}"`:''}><g mask="url(#pm${id})" opacity="${(p==='checks'?.5:.7)*(rim?.75:1)}">${ringPattern(p,R)}</g></g>`;o+=pat}
  o+=sh.o();
  o+=Ly.frame;
  o+=`<g fill="currentColor" stroke="none">${T('',true)}</g>`;
  if(sym)o+=`<g transform="translate(${ccx} ${cy}) scale(${(.62*big*sq).toFixed(2)}) translate(-20 -20)" fill="currentColor" stroke="currentColor">${MARKS[sym]}</g>`;
  const mods=st.mods|0;
  if(mods>0)o+=endorseArt(mods,Ly);
  const style=on&&st.ink!==undefined?`style="color:${inkVal(st.ink)}"`:'';
  const vb=st.band===false?'0 0 40 40':'-4.6 -4.6 49.2 49.2';
  return `<svg width="${size}" height="${size}" viewBox="${vb}" aria-hidden="true" ${style}><g transform="rotate(${rot} 20 20)" ${on?`filter="url(#${inkFilter(st.seed||1)})"`:''} fill="none" stroke="currentColor" ${on?'':'opacity=".45"'} stroke-linejoin="round">${o}</g></svg>`;
}
/* colour palette */
function colourGrid(sel,attr){return `<div class="pal">${PALETTE.map((p,i)=>`<button class="${sel&&sel.n===p.n?'on':''}" ${attr}="${i}" aria-label="${p.n}"><i style="background:${col(p)}"></i><span>${p.n}</span></button>`).join('')}</div>`}
