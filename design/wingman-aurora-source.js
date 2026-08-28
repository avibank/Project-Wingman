/* ══════════════════════════════════════════════════════════════════════
   Wingman — the Aurora finish, as it stands.

   This SUPERSEDES the aurora section of `wingman-finishes-brief.md`.
   Three things changed after that brief shipped:

     1  the display was pulled up and shrunk, so it sits across the header
        and washes down over the top of the hero card instead of filling
        the deck and putting ribbons behind the module cards
     2  the skies went nearly black — five at L .086 to .092 — except Sky,
        which keeps a navy at .170, because a blue aurora on a black sky
        stops reading as blue
     3  the starfield split in two, and twinkles

   Copy every value verbatim. They were arrived at against reference
   photography over many rounds. Do not re-derive, round or tidy them.
   ══════════════════════════════════════════════════════════════════════ */


/* ── 1 · the six displays ──────────────────────────────────────────────
   gnd / pan / rai / lin — EACH AURORA OWNS ITS SKY. Do not reuse one
   shared ground; that is what made Sky and Runway collapse into each
   other the first time.

   h[] — [hue, weight, chromaMul]. Weight drives prominence, alpha and the
   white-hot core. chromaMul is saturation, kept separate so a livery can
   lead with a near-neutral hue (Tarmac) and still carry a vivid accent.

   Only the first 9 hues are drawn. The arrays alternate lead and
   companion, so the head of each list keeps the colour mixing while the
   display stays small enough to sit over the hero card.

   y 13.5 and ht [21,37] are the containment. They were y 18–19 and
   ht [32,60], which reached two thirds of the way down the deck. */

const AUR = {
 sky:{sub:'a blue night, green ribbons through it', soft:'52px', rays:10,
   gnd:'.1700 .0850 264', pan:'.2240 .0608 264/.80', rai:'.2726 .0665 262/.88', lin:'.3338 .0779 260/.94',
   h:[[164,1],[150,1],[178,.94],[286,.72],[158,1],[196,.70],[144,1],[300,.66],
      [170,1],[210,.62],[154,1],[188,.78]], c:.215,ct:.170,
   w:[4,10], ht:[21,37], x0:5,dx:8.2, y:13.5, a0:.46,
   fr:[292,160,300], frc:.17, frY:24, fill:{h:158,c:.205,a:.50}, stars:360, grain:.05},

 beacon:{sub:'crimson leading, green only at the base', soft:'50px', rays:10,
   gnd:'.0900 .0220 16', pan:'.1332 .0294 14/.86', rai:'.1780 .0364 16/.92', lin:'.2292 .0490 18/.96',
   h:[[18,1],[8,1],[28,1],[350,.92],[14,1],[38,.86],[24,1],[340,.80],
      [10,1],[46,.74],[20,1],[146,.56]], c:.240,ct:.190,
   w:[4,10], ht:[21,37], x0:5,dx:8.2, y:13.5, a0:.48,
   fr:[148,138,158], frc:.15, frY:22, fill:{h:26,c:.200,a:.50}, stars:320, grain:.06},

 amber:{sub:'gold and orange, lime and rose in it', soft:'52px', rays:11,
   gnd:'.0880 .0143 68', pan:'.1344 .0210 66/.82', rai:'.1824 .0294 68/.88', lin:'.2368 .0434 72/.94',
   h:[[104,1],[62,1],[116,1],[48,.92],[94,1],[128,.76],[70,1],[36,.84],
      [110,1],[352,.62],[56,.94],[86,1]], c:.205,ct:.164,
   w:[4,10], ht:[21,37], x0:5,dx:8.2, y:13.5, a0:.44,
   fr:[42,352,30], frc:.17, frY:22, fill:{h:88,c:.212,a:.54}, stars:520, grain:.05},

 skydrol:{sub:'violet leading, teal and rose in it', soft:'52px', rays:10,
   gnd:'.0920 .0286 292', pan:'.1400 .0336 292/.82', rai:'.1864 .0378 290/.88', lin:'.2392 .0476 292/.94',
   h:[[310,1],[188,.70],[318,1],[296,1],[204,.64],[332,.86],[286,.94],[178,.60],
      [324,1],[346,.72],[302,1],[264,.74]], c:.208,ct:.170,
   w:[4,10], ht:[21,37], x0:5,dx:8.2, y:13.5, a0:.46,
   fr:[190,336,204], frc:.16, frY:28, fill:{h:306,c:.180,a:.48}, stars:360, grain:.05},

 runway:{sub:'a green sky, cyan and blue accents', soft:'50px', rays:11,
   gnd:'.0900 .0264 168', pan:'.1380 .0280 166/.82', rai:'.1828 .0322 168/.88', lin:'.2340 .0420 170/.94',
   h:[[148,1],[140,1],[158,1],[196,.72],[144,1],[210,.64],[152,1],[184,.78],
      [136,1],[224,.58],[162,1],[330,.54]], c:.230,ct:.182,
   w:[4,10], ht:[21,37], x0:5,dx:8.2, y:13.5, a0:.46,
   fr:[200,214,330], frc:.16, frY:29, fill:{h:150,c:.220,a:.56}, stars:300, grain:.05},

 tarmac:{sub:'cold grey, a little copper in it', soft:'60px', rays:8,
   gnd:'.0860 .0066 250', pan:'.1340 .0084 250/.82', rai:'.1788 .0098 250/.88', lin:'.2316 .0126 252/.94',
   h:[[250,1,.30],[240,1,.34],[258,1,.28],[52,.66,2.5],[246,1,.32],[226,.92,.40],
      [44,.58,2.6],[262,1,.26],[236,.96,.34],[60,.52,2.4],[214,.88,.42],[254,1,.30]],
   c:.088,ct:.070,
   w:[4,10], ht:[21,36], x0:5,dx:8.2, y:13.5, a0:.34,
   fr:[248,258,50], frc:.05, frY:29, fill:{h:238,c:.070,a:.34},
   cloud:'radial-gradient(44% 17% at 20% 32%, oklch(.28 .012 252/.60) 0%, transparent 76%), radial-gradient(36% 12% at 62% 20%, oklch(.30 .012 250/.52) 0%, transparent 74%), radial-gradient(48% 14% at 80% 44%, oklch(.26 .012 254/.50) 0%, transparent 78%)',
   cloudOp:.40, stars:300, grain:.14}
};

/* ── 2 · shared night text over an aurora ──────────────────────────────
   t3 was '.5725 .0273 247.30', which measures 4.04:1 against Sky's navy
   panel — the lightest surface any aurora has. At .6150 all six clear
   4.5:1: Sky at 4.82, the rest at 5.46 to 5.51. */

const AURN={g:'.1900 .0119 258',p:'.2537 .0187 257.06/.78',rz:'.3188 .0302 254.73/.87',l:'.3838 .0441 251.87/.94',t3:'.6150 .0260 247.30',t2:'.7637 .0245 235.24',t1:'.9550 .0040 226'};

/* ── 3 · the generators ────────────────────────────────────────────────
   No Math.random anywhere. rnd(s) is the fractional part of
   sin(s) * 10000. The fields must be identical between renders or the
   sky crawls every time anything re-paints. */

const rnd = s => { let x = Math.sin(s) * 10000; return x - Math.floor(x); };

function curtains(sp){
  const out=[];
  /* [hue, weight, chromaMul]. Weight is prominence — it drives alpha, size
     and the white-hot core. chromaMul is saturation, so a livery can lead
     with a near-neutral hue and still carry a vivid accent. */
  /* Only the first `bands` hues are drawn. The arrays alternate lead and
     companion, so the head of the list keeps the colour mixing while the
     display stays small enough to sit over the hero card. */
  sp.h.slice(0, sp.bands||9).forEach((hw,i)=>{
    const h=hw[0], k=hw[1], cm=(hw[2]===undefined?1:hw[2]);
    const sc=.88+k*.26;
    const w =((sp.w[0]+rnd(i+1)*(sp.w[1]-sp.w[0]))*sc).toFixed(1);
    const ht=((sp.ht[0]+rnd(i+9)*(sp.ht[1]-sp.ht[0]))*sc).toFixed(1);
    const x =(sp.x0+i*sp.dx+rnd(i+21)*5).toFixed(1);
    const y =(sp.y+rnd(i+33)*4.6).toFixed(1);
    const a = sp.a0*k*(.78+rnd(i+41)*.44);
    const C =(sp.c*(.80+k*.25)*cm).toFixed(3), CT=(sp.ct*(.80+k*.25)*cm).toFixed(3);
    const hot = k>=.88
      ? `oklch(0.995 ${(C*.26).toFixed(3)} ${h}.0 / ${(a*1.10).toFixed(3)}) 0%, `+
        `oklch(0.955 ${(C*.62).toFixed(3)} ${h}.0 / ${(a*1.02).toFixed(3)}) 11%, ` : '';
    out.push(`radial-gradient(${w}% ${ht}% at ${x}% ${y}%, `+ hot +
      `oklch(${(0.88+k*.05).toFixed(3)} ${CT} ${h}.0 / ${a.toFixed(3)}) ${k>=.88?'24%':'0%'}, `+
      `oklch(0.80 ${C} ${h}.0 / ${(a*.58).toFixed(3)}) 40%, `+
      `oklch(0.76 ${C} ${h}.0 / ${(a*.22).toFixed(3)}) 62%, `+
      `oklch(0.74 ${C} ${h}.0 / 0) 84%)`);
  });
  /* fine rays — the detail that keeps it from reading as one soft bloom */
  const lead = sp.h.filter(x=>x[1]>=.9);
  for(let j=0;j<sp.rays;j++){
    const hw = lead[j%lead.length], h=hw[0], cm=(hw[2]===undefined?1:hw[2]);
    const w =(1.6+rnd(j+101)*2.6).toFixed(2);
    const ht=(sp.ht[0]*0.58+rnd(j+113)*13).toFixed(1);
    const x =(4+rnd(j+127)*92).toFixed(1);
    const y =(sp.y-2+rnd(j+139)*7).toFixed(1);
    const a =(sp.a0*(.34+rnd(j+151)*.40)).toFixed(3);
    const C =(sp.c*1.05*cm).toFixed(3);
    out.push(`radial-gradient(${w}% ${ht}% at ${x}% ${y}%, `+
      `oklch(0.97 ${(C*.5).toFixed(3)} ${h}.0 / ${a}) 0%, `+
      `oklch(0.84 ${C} ${h}.0 / ${(a*.5).toFixed(3)}) 34%, `+
      `oklch(0.78 ${C} ${h}.0 / 0) 76%)`);
  }
  (sp.fr||[]).forEach((h,i)=>{
    const x=(18+i*24+rnd(i+51)*10).toFixed(1), fy=((sp.frY||28)+rnd(i+61)*4).toFixed(1);
    out.push(`radial-gradient(${(15+i*4)}% 11% at ${x}% ${fy}%, `+
      `oklch(0.90 ${sp.frc} ${h}.0 / .26) 0%, oklch(0.78 ${sp.frc} ${h}.0 / .12) 42%, oklch(0.76 ${sp.frc} ${h}.0 / 0) 80%)`);
  });
  return out.join(', ');
}

const horizon=g=>`radial-gradient(142% 36% at 50% 103%, `+
  `oklch(0.94 ${g.c} ${g.h}.0 / ${g.a}) 0%, `+
  `oklch(0.86 ${g.c} ${g.h}.0 / ${(g.a*.58).toFixed(3)}) 28%, `+
  `oklch(0.78 ${g.c} ${g.h}.0 / ${(g.a*.22).toFixed(3)}) 54%, `+
  `oklch(0.76 ${g.c} ${g.h}.0 / 0) 82%)`;

/* ── 4 · two starfields, so individual stars blink ─────────────────────
   One field twinkling as a whole looks fake — the sky appears to breathe.
   Split the count between two layers, offset the phase, and individual
   stars come and go instead. */

function starfield(n,o){
  const p=[]; o=o||0;
  for(let i=o;i<n+o;i++){
    const x=(rnd(i*3+1)*100).toFixed(2), y=(rnd(i*7+2)*100).toFixed(2);
    const s=(0.7+rnd(i*11+3)*1.1).toFixed(2), a=(0.30+rnd(i*13+4)*0.65).toFixed(2);
    p.push(`radial-gradient(${s}px ${s}px at ${x}% ${y}%, rgba(255,255,255,${a}), rgba(255,255,255,0))`);
  }
  return p.join(', ');
}

/* ── 5 · what to set when Aurora is on at night ────────────────────────

   --ground    spec.gnd          each aurora's own sky
   --panel     spec.pan
   --raised    spec.rai
   --line      spec.lin
   --t1/t2/t3  AURN              t3 = .6150, see section 2

   --key-img   curtains(spec)
   --fill-img  horizon(spec.fill)
   --key-int   0.98
   --fill-int  0.56              was .80; the glow at the foot was pulling
                                 the eye down and fighting the display
   --soft      spec.soft         50 to 60px, NOT the standard 82px. An 82px
                                 blur destroys the structure and makes all
                                 six auroras look identical.
   --grain     spec.grain
   --stars     1
   --star-img   starfield(n1)              where n1 = round(spec.stars * 0.55)
   --star-img2  starfield(spec.stars - n1, 4000)

   The deck carries data-aur="1", which applies the higher saturation and
   brightness in the CSS below. That is the glow, and it is required.

   active / on / lit stay the LIVERY's night accent values, unchanged. The
   livery supplies the accent; the finish supplies the sky.

   DAY: a livery with the Aurora finish renders exactly as it does with no
   finish. There is no daylight aurora. But the gate for the base-Day
   treatment is

        isDay && finish !== 'manual'

   NOT "no finish" — so Aurora in Day inherits deep ground, stock tint,
   tooth, cast and sheen like everything else. Getting that gate wrong is
   how Aurora-in-Day silently diverges from plain Day.                  */


/* ── 6 · the CSS this needs ────────────────────────────────────────────  */

.stars{position:absolute;inset:-3%;z-index:1;pointer-events:none;
  opacity:var(--stars);background-image:var(--star-img)}
.stars.s2{background-image:var(--star-img2)}

.deck[data-aur="1"] .stars   {animation:twk 7.4s ease-in-out infinite}
.deck[data-aur="1"] .stars.s2{animation:twk 11.1s ease-in-out infinite -3.2s}
@keyframes twk{
  0%,100%{opacity:var(--stars)}
  28%{opacity:calc(var(--stars)*.55)}
  52%{opacity:calc(var(--stars)*1)}
  74%{opacity:calc(var(--stars)*.72)}}

.deck[data-aur="1"] .lite::before{filter:blur(var(--soft)) saturate(1.70) brightness(1.30)}
.deck[data-aur="1"] .lite::after {filter:blur(calc(var(--soft)*1.15)) saturate(1.62) brightness(1.34)}

@media (prefers-reduced-motion:reduce){ .stars{animation:none} }


/* ── 7 · one thing that was measured, so it is not re-introduced ───────
   Do NOT add a second animation to .lite::before — not a filter, not an
   opacity. That element is 210% square, blurred and screen-blended, so it
   cannot composite on its own. Animating anything on it re-rasterises
   every frame and measured roughly 15x slower than the entire rest of the
   deck combined. The drift transform is free, because the blurred result
   is cached as a texture and only moved.

   If the display needs to breathe, it has to be on its own small,
   unblended layer. This was built, measured, and removed.             */
