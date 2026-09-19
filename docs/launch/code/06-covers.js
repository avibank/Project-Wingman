/* Lifted verbatim from reference/02-licence-stamp-creator.html (script lines 672-706).
   LIVERIES and the cover artwork SETS. Every cover is drawn on a 0 0 640 128 viewBox. */

const LIVERIES={sky:{n:'Sky blue',h:254,c:.13,d:'The forty minutes between the climb and the descent.'},amber:{n:'Gauge amber',h:75,c:.13,d:'The glow of a panel at night.'},tarmac:{n:'Tarmac grey',h:255,c:.02,d:'Quiet, like the ramp at first light.'},beacon:{n:'Beacon red',h:25,c:.15,d:'The rotating light on the belly.'},runway:{n:'Runway green',h:150,c:.12,d:'Centreline lights on a wet night.'},skydrol:{n:'Skydrol violet',h:300,c:.13,d:'The colour of hydraulic fluid, and nothing else.'}};
const lc=(L,l,cm=1,a=1)=>`oklch(${l} ${(L.c*cm).toFixed(3)} ${L.h}${a<1?' / '+a:''})`;
const SETS={
 contour:{n:'Contours',svg:()=>{let o='';for(let i=0;i<10;i++){let d='';for(let x=0;x<=640;x+=16){const y=4+i*13+Math.sin(x/62+i*.7)*9+Math.cos(x/31+i)*3;d+=(x?'L':'M')+x+' '+y.toFixed(1)}o+=`<path d="${d}" stroke="oklch(1 0 0 / ${i%3?.15:.32})"/>`}return o}},
 panels:{n:'Panels',svg:()=>{let o='';[0,110,250,390,520,640].forEach(x=>{o+=`<path d="M${x} 0V128" stroke="oklch(1 0 0 / .22)"/>`;for(let y=8;y<128;y+=11)o+=`<circle cx="${x+5}" cy="${y}" r="1.3" fill="#fff" fill-opacity=".38"/>`});o+='<path d="M0 66H640" stroke="oklch(1 0 0 / .18)"/>';for(let x=14;x<640;x+=13)o+=`<circle cx="${x}" cy="71" r="1.2" fill="#fff" fill-opacity=".3"/>`;return o+'<rect x="286" y="20" width="70" height="30" rx="4" stroke="oklch(1 0 0 / .3)"/>'}},
 runway:{n:'Runway',svg:()=>{let o='';
   for(let y=12;y<=116;y+=10){if(Math.abs(y-64)<14)continue;o+=`<path d="M22 ${y}H104" stroke="oklch(1 0 0 / .4)" stroke-width="5"/>`}
   o+='<text x="142" y="64" font-family="Geist Mono,monospace" font-size="28" font-weight="600" letter-spacing="4" fill="oklch(1 0 0 / .5)" transform="rotate(90 142 64)" text-anchor="middle" dominant-baseline="middle">26</text>';
   for(let x=190;x<640;x+=46)o+=`<path d="M${x} 64H${x+26}" stroke="oklch(1 0 0 / .45)" stroke-width="2"/>`;
   o+='<path d="M300 30H372M300 98H372" stroke="oklch(1 0 0 / .36)" stroke-width="9"/>';
   [[214,3],[430,2],[540,1]].forEach(([x,n])=>{for(let k=0;k<n;k++)o+=`<path d="M${x} ${42-k*8}H${x+32}M${x} ${86+k*8}H${x+32}" stroke="oklch(1 0 0 / .26)" stroke-width="4"/>`});
   o+='<path d="M0 1.5H640M0 126.5H640" stroke="oklch(1 0 0 / .5)" stroke-width="3"/>';
   for(let x=10;x<640;x+=24)o+=`<circle cx="${x}" cy="6" r="1.8" fill="#fff" fill-opacity=".7"/><circle cx="${x}" cy="122" r="1.8" fill="#fff" fill-opacity=".7"/>`;
   return o}},
 flight:{n:'Flight path',svg:()=>{const G=112,C=34;
   const d=`M0 ${G}H70C120 ${G} 150 ${C} 230 ${C}H430C500 ${C} 530 ${G} 580 ${G}H640`;
   let o=`<path d="M0 ${G+4}H640" stroke="oklch(1 0 0 / .14)"/><path d="${d}" stroke="oklch(1 0 0 / .22)" stroke-width="1.6" stroke-dasharray="4 6"/>`;
   o+=`<path d="M0 ${G}H70C120 ${G} 150 ${C} 230 ${C}H330" stroke="oklch(1 0 0 / .7)" stroke-width="2"/>`;
   [[70,G],[150,72],[230,C],[330,C],[430,C],[505,72],[580,G]].forEach(([x,y],i)=>o+=i===4?'':`<circle cx="${x}" cy="${y}" r="${i===3?6:4}" fill="${i<3?'#fff':i===3?'#fff':'none'}" fill-opacity="${i<3?.7:1}" stroke="#fff" stroke-opacity=".7" stroke-width="1.4"/>`);
   o+=`<circle cx="430" cy="${C}" r="4" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.4"/>`;
   return o+`<circle cx="330" cy="${C}" r="12" stroke="#fff" stroke-opacity=".25"/>`}},
 chart:{n:'Chart',svg:()=>{const M='Geist Mono,monospace';let o='';
   for(let x=0;x<=640;x+=80)o+=`<path d="M${x} 0V128" stroke="oklch(1 0 0 / .07)"/>`;for(let y=0;y<=128;y+=42)o+=`<path d="M0 ${y}H640" stroke="oklch(1 0 0 / .07)"/>`;
   o+=`<text x="6" y="38" font-family="${M}" font-size="7.5" fill="oklch(1 0 0 / .3)">N29°30'</text><text x="84" y="124" font-family="${M}" font-size="7.5" fill="oklch(1 0 0 / .3)">E047°</text>`;
   let cl='';for(let x=0;x<=640;x+=10){const y=118-Math.sin(x/70)*10-Math.cos(x/23)*4-(x>420?(x-420)*.12:0);cl+=(x?'L':'M')+x+' '+y.toFixed(1)}o+=`<path d="${cl}" stroke="oklch(1 0 0 / .22)" stroke-width="1.2"/>`;
   const W={TOKOS:[40,92],ALVAN:[140,36],DESNA:[230,96],KUWAIT:[360,56],RAGAS:[470,98],BUNDU:[610,76],SIDAD:[470,16],LOVEN:[250,10]};
   const air=[['TOKOS','ALVAN','UL602'],['ALVAN','KUWAIT','UL602'],['KUWAIT','BUNDU','UL602'],['DESNA','KUWAIT','M677'],['KUWAIT','RAGAS','M677'],['LOVEN','KUWAIT','G663'],['KUWAIT','SIDAD','T12'],['TOKOS','DESNA','W4']];
   air.forEach(([p,q,n])=>{const [x1,y1]=W[p],[x2,y2]=W[q];o+=`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="oklch(1 0 0 / .38)" stroke-width="1.2" stroke-dasharray="${n==='UL602'?'':'5 4'}"/>`;
     if(n==='T12')return;const mx=(x1+x2)/2,my=(y1+y2)/2;o+=`<rect x="${mx-15}" y="${my-6}" width="30" height="11" rx="2" fill="oklch(.2 .03 255 / .55)"/><text x="${mx}" y="${my+2.5}" text-anchor="middle" font-family="${M}" font-size="7.5" fill="oklch(1 0 0 / .55)">${n}</text>`});
   const [vx,vy]=W.KUWAIT;
   o+=`<path d="M${vx-5} ${vy-3}L${vx} ${vy-6}L${vx+5} ${vy-3}V${vy+3}L${vx} ${vy+6}L${vx-5} ${vy+3}Z" stroke="#fff" stroke-opacity=".7" fill="oklch(1 0 0 / .15)"/>`;
   Object.entries(W).forEach(([n,[x,y]])=>{if(n==='KUWAIT'){o+=`<text x="${x+30}" y="${y-18}" font-family="${M}" font-size="8.5" letter-spacing="1" fill="oklch(1 0 0 / .6)">KUWAIT 115.9</text>`;return}
     o+=`<path d="M${x} ${y-4.5}L${x+4.5} ${y+3.5}H${x-4.5}Z" stroke="oklch(1 0 0 / .65)" fill="oklch(1 0 0 / .12)"/><text x="${x+(x>600?-7:7)}" text-anchor="${x>600?'end':'start'}" y="${y+(y<30?12:-6)}" font-family="${M}" font-size="7.5" letter-spacing="1" fill="oklch(1 0 0 / .5)">${n}</text>`});
   return o}},
};
