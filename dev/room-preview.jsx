/* Local harness only — never imported by the app. It mounts the Ready Room on
   fixture data so the screens can be looked at without Clerk, Supabase or a
   signed-in account. */
import React from "react";
import { createRoot } from "react-dom/client";
import ReadyRoom from "../src/components/room/ReadyRoom.jsx";
import "../src/styles/foundations.css";
import "../src/styles/app.css";

const T = {
  "--ground":"oklch(0.1400 0.0178 255.00)","--panel":"oklch(0.2075 0.0263 256.13 / 0.78)",
  "--raised":"oklch(0.2763 0.0442 258.88 / 0.87)","--line":"oklch(0.3452 0.0672 262.18 / 0.94)",
  "--t3":"oklch(0.6250 0.0425 264.39)","--t2":"oklch(0.7475 0.0341 247.31)","--t1":"oklch(0.9500 0.0052 235.00)",
  "--active":"oklch(0.6800 0.1303 253.95)","--active-fill":"oklch(0.6800 0.1303 253.95)",
  "--on-fill":"oklch(0.1400 0.0178 255.00)","--on":"oklch(0.7475 0.1105 247.31)",
  "--ok":"oklch(.660 .155 148)","--bad":"oklch(.620 .180 25)","--caution":"oklch(0.778 0.163 72.6)",
  "--sunk":"oklch(0.178 0.021 249.1)","--edge":"oklch(.720 0.046 262.0 / .26)",
  "--edge-soft":"oklch(.720 0.038 262.0 / .16)","--ease":"cubic-bezier(.3,.7,.3,1)",
  "--font-ui":'"Instrument Sans", ui-sans-serif, system-ui, sans-serif',
  "--font-mono":'"Geist Mono", ui-monospace, monospace', "--tap":"44px",
};
for (const [k,v] of Object.entries(T)) document.documentElement.style.setProperty(k,v);
document.documentElement.setAttribute("data-variant","night");

const iso = (m) => new Date(Date.now()-m*60000).toISOString();
const me = "u_me";
const people = [
  { id:"u_me", callsign:"You" },
  { id:"u_jouri", callsign:"Jouri", code:"JRI", exam_window:"Nov sitting", active_window:"Mornings" },
  { id:"u_saqer", callsign:"Saqer", code:"SQR" },
  { id:"u_abdul", callsign:"Abdulrahman", code:"ABR" },
  { id:"u_bloushi", callsign:"Bloushi", code:"BLS" },
  { id:"u_staff", callsign:"Eng. Mishari", code:"MSH" },
];
const modules = [
  { code:"M3", name:"Electrical Fundamentals" },
  { code:"M4", name:"Electronic Fundamentals" },
  { code:"M8", name:"Basic Aerodynamics" },
  { code:"M13", name:"Aircraft Aero, Structures & Systems" },
];
const squadrons = [
  { id:"sq_b2", name:"B2 Night Shift", code:"B2", moduleCode:"M13", ownerId:"u_jouri",
    members:["u_me","u_jouri","u_saqer","u_abdul","u_bloushi"], muted:false,
    roster:[{user_id:"u_me"},{user_id:"u_jouri"},{user_id:"u_saqer"},{user_id:"u_abdul"},{user_id:"u_bloushi"}],
    lastReadAt: iso(200), inviteToken:"n8k2qv",
    pinned:{ id:"m1", by:"u_jouri", body:"Mock paper Thursday 20:00. ATA 29 + 32 only." },
    last:{ body:"Still 3000. The neo change was the PTU logic.", authorId:"u_abdul", createdAt: iso(41) } },
  { id:"sq_m13", name:"M13 — Nov sitting", code:"13", moduleCode:"M13", ownerId:"u_staff",
    members:["u_me","u_jouri","u_staff"], muted:true, roster:[{user_id:"u_me"},{user_id:"u_staff"}],
    lastReadAt: iso(60*40), inviteToken:"p4r7tm", pinned:null,
    last:{ body:"I will put it in the Library tonight.", authorId:"u_staff", createdAt: iso(480) } },
];
const messages = [
  { id:"m1", squadronId:"sq_b2", authorId:"u_jouri", createdAt: iso(60*26), body:"Mock paper Thursday 20:00. ATA 29 + 32 only.", reactions:{"👍":["u_me","u_saqer"]} },
  { id:"m2", squadronId:"sq_b2", authorId:"u_saqer", createdAt: iso(60*25), body:"Anyone else getting destroyed by the accumulator pre-charge questions", reactions:{} },
  { id:"m3", squadronId:"sq_b2", authorId:"u_me", createdAt: iso(60*25), body:"Every time. I keep mixing up pre-charge and system pressure.", reactions:{} },
  { id:"m4", squadronId:"sq_b2", authorId:"u_abdul", createdAt: iso(300), body:"Pre-charge is nitrogen only, system off. With the system pressurised you are reading the fluid side, not the gas side.", reactions:{"🔥":["u_me","u_jouri"]} },
  { id:"m5", squadronId:"sq_b2", authorId:"u_me", createdAt: iso(298), body:"That is the bit that finally landed. Thank you.", replyTo:"m4", reactions:{} },
  { id:"m6", squadronId:"sq_b2", authorId:"u_bloushi", createdAt: iso(48), body:"Ground service panel — still 3000 psi on the A320 or did that change on the neo?", reactions:{} },
  { id:"m7", squadronId:"sq_b2", authorId:"u_abdul", createdAt: iso(41), body:"Still 3000. The neo change was the PTU logic, not the pressure.", replyTo:"m6", reactions:{} },
];
const threads = [
  { id:"t1", moduleId:"M13", authorId:"u_jouri", createdAt: iso(120), title:"Why does the PTU run on the ground with no hydraulic demand?",
    body:"On the A320 the PTU sometimes cycles on the ground when nobody is operating anything.\n\nIs it just thermal, or am I missing a consumer?", bestReplyId:"a2" },
  { id:"t2", moduleId:"M13", authorId:"u_saqer", createdAt: iso(360), title:"Accumulator pre-charge — system on or off?",
    body:"Half the notes say depressurised, half say it does not matter. Which one does the exam want?", bestReplyId:null },
  { id:"t3", moduleId:"M13", authorId:"u_me", createdAt: iso(1200), title:"Is the RAT a hydraulic source or an electrical one for Part-66?",
    body:"It drives both, and the question bank files it under ATA 24 and ATA 29.", bestReplyId:null },
];
const replies = [
  { id:"a1", threadId:"t1", authorId:"u_abdul", createdAt: iso(118), parentId:null, body:"Leakage. Both systems leak internally back to the reservoir and not at the same rate." },
  { id:"a2", threadId:"t1", authorId:"u_staff", createdAt: iso(60), parentId:null, body:"Abdulrahman has it. Add one thing: on the ground the yellow electric pump may be running for cargo doors, and the PTU sees that as demand." },
  { id:"a3", threadId:"t1", authorId:"u_jouri", createdAt: iso(50), parentId:"a2", body:"That is the phrasing I needed. Thank you." },
  { id:"a4", threadId:"t2", authorId:"u_abdul", createdAt: iso(300), parentId:null, body:"System depressurised, always." },
];
const presence = [
  { user_id:"u_jouri", last_seen: iso(1), module_code:"M13", chapter_id:"Ch 4" },
  { user_id:"u_abdul", last_seen: iso(2), module_code:"M13" },
  { user_id:"u_saqer", last_seen: iso(4) },
];

function Harness(){
  return (
    <div className="deck" style={{height:"100dvh"}}>
      <div className="deck-inner" style={{height:"100%"}}>
        <main className="content content--full" style={{height:"100%",display:"flex"}}>
          <ReadyRoom
            me={me} modules={modules} activeModuleCode="M13" chapters={[]}
            threads={threads} replies={replies} people={people} presence={presence}
            squadrons={squadrons} messages={messages}
            seatCandidates={[{user_id:"u_abdul",last_seen:iso(1),module_code:"M13",chapter_id:"Ch 4"},
                             {user_id:"u_saqer",last_seen:iso(9)}]}
            votes={{a1:{count:3,mine:false},a2:{count:12,mine:true},a4:{count:7,mine:false}}}
            saved={{t2:1}}
            brand={<button type="button" className="brandmark">Wingman</button>}
            profile={<span className="av sm" style={{"--av-h":28}}>H</span>}
            onPost={()=>{}} onReport={()=>{}} onBlock={()=>{}} onVote={()=>{}}
            onBest={()=>{}} onOpenLessonAt={()=>{}} onSave={()=>{}}
            onRefresh={()=>{}} onOpenInvite={()=>{}}
          />
        </main>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<Harness/>);
