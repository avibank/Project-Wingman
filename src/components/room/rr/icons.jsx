/* The Ready Room's icons, drawn exactly as the signed-off demo draws them.
   Every one is decorative: the control around it carries the accessible name. */
const A = { "aria-hidden": "true", focusable: "false" };
const LINE = { fill: "none", stroke: "currentColor" };

export const Up = () => (<svg {...A} width="15" height="15" viewBox="0 0 24 24" {...LINE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5m0 0-6 6m6-6 6 6" /></svg>);
export const Down = () => (<svg {...A} width="15" height="15" viewBox="0 0 24 24" {...LINE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14m0 0 6-6m-6 6-6-6" /></svg>);
export const Reply = () => (<svg {...A} width="14" height="14" viewBox="0 0 24 24" {...LINE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /></svg>);
export const Save = () => (<svg {...A} width="14" height="14" viewBox="0 0 24 24" {...LINE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h12v17l-6-4-6 4z" /></svg>);
export const Share = () => (<svg {...A} width="14" height="14" viewBox="0 0 24 24" {...LINE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.3 10.8 7.4-4.3m0 11-7.4-4.3" /></svg>);
export const Plus = () => (<svg {...A} width="15" height="15" viewBox="0 0 24 24" {...LINE} strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>);
export const Search = () => (<svg {...A} width="17" height="17" viewBox="0 0 24 24" {...LINE} strokeWidth="1.9"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" /></svg>);
export const RailSearch = () => (<svg {...A} width="15" height="15" viewBox="0 0 24 24" {...LINE} strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
export const Info = () => (<svg {...A} width="17" height="17" viewBox="0 0 24 24" {...LINE} strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8.2v.2" strokeLinecap="round" /></svg>);
export const Back = () => (<svg {...A} width="19" height="19" viewBox="0 0 24 24" {...LINE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m14 6-6 6 6 6" /></svg>);
export const Lesson = () => (<svg {...A} width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>);
export const Paper = () => (<svg {...A} width="10" height="10" viewBox="0 0 24 24" {...LINE} strokeWidth="2"><path d="M6 3h8l4 4v14H6z" /><path d="M9 12h6M9 16h4" /></svg>);
export const Plane = () => (<svg {...A} width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M2.7 11.1 20.5 3.2c.8-.35 1.65.5 1.3 1.3l-7.9 17.8c-.35.78-1.5.68-1.72-.13l-1.6-6.05a1 1 0 0 0-.72-.72l-6.05-1.6c-.81-.22-.9-1.37-.13-1.72Z" /></svg>);
export const ArrowDown = () => (<svg {...A} width="14" height="14" viewBox="0 0 24 24" {...LINE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14m0 0 6-6m-6 6-6-6" /></svg>);
export const Photo = () => (<svg {...A} width="18" height="18" viewBox="0 0 24 24" {...LINE} strokeWidth="1.7"><rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="8.5" cy="10" r="1.6" /><path d="m4 17 5-4 4 3 3-2 4 3" /></svg>);
export const File = () => (<svg {...A} width="18" height="18" viewBox="0 0 24 24" {...LINE} strokeWidth="1.7"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></svg>);
export const Passage = () => (<svg {...A} width="18" height="18" viewBox="0 0 24 24" {...LINE} strokeWidth="1.7"><path d="M5 4h11l3 3v13H5z" /><path d="M8 11h8M8 15h5" /><path d="M8 11h8" strokeWidth="3.4" opacity=".45" /></svg>);
export const Expand = () => (<svg {...A} width="15" height="15" viewBox="0 0 24 24" {...LINE} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4H5a1 1 0 0 0-1 1v4" /><path d="M15 4h4a1 1 0 0 1 1 1v4" /><path d="M9 20H5a1 1 0 0 1-1-1v-4" /><path d="M15 20h4a1 1 0 0 0 1-1v-4" /></svg>);
export const Shrink = () => (<svg {...A} width="15" height="15" viewBox="0 0 24 24" {...LINE} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h4a1 1 0 0 0 1-1V4" /><path d="M20 9h-4a1 1 0 0 1-1-1V4" /><path d="M4 15h4a1 1 0 0 1 1 1v4" /><path d="M20 15h-4a1 1 0 0 0-1 1v4" /></svg>);
export const Prev = () => (<svg {...A} width="16" height="16" viewBox="0 0 24 24" {...LINE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m14 6-6 6 6 6" /></svg>);
export const Next = () => (<svg {...A} width="16" height="16" viewBox="0 0 24 24" {...LINE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10 6 6 6-6 6" /></svg>);
export const Seat = () => (<svg {...A} width="15" height="15" viewBox="0 0 24 24" {...LINE} strokeWidth="1.8"><circle cx="12" cy="12" r="2" /><path d="M12 5a7 7 0 0 1 7 7M12 5a7 7 0 0 0-7 7" strokeLinecap="round" /><path d="M12 1.5a10.5 10.5 0 0 1 10.5 10.5M12 1.5A10.5 10.5 0 0 0 1.5 12" strokeLinecap="round" opacity=".5" /></svg>);
export const Tick1 = () => (<svg {...A} width="14" height="14" viewBox="0 0 24 24" {...LINE} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m4 13 5 5 11-12" /></svg>);
export const Tick2 = () => (<svg {...A} width="17" height="13" viewBox="0 0 26 24" {...LINE} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m1 13 4.5 4.5L14 8" /><path d="m10.5 13 3 3L23 6" /></svg>);
