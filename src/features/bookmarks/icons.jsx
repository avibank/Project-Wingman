// Stroke icons used across Bookmarks. Same drawings as the approved demo.
const P = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };

export const IconBookmark = ({ on = false }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
    <path d="M6.5 3.5h11v17l-5.5-4-5.5 4z" />
  </svg>
);
export const IconLeft = () => (<svg viewBox="0 0 24 24" aria-hidden="true" {...P} strokeWidth="2"><path d="M15 5l-7 7 7 7" /></svg>);
export const IconRight = () => (<svg viewBox="0 0 24 24" aria-hidden="true" {...P} strokeWidth="2"><path d="M9 5l7 7-7 7" /></svg>);
export const IconDown = () => (<svg viewBox="0 0 24 24" aria-hidden="true" {...P} strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>);
export const IconPlay = () => (<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z" /></svg>);
export const IconX = () => (<svg viewBox="0 0 24 24" aria-hidden="true" {...P} strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const IconCheck = () => (<svg viewBox="0 0 24 24" aria-hidden="true" {...P} strokeWidth="2.4"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>);
export const IconFlip = () => (<svg viewBox="0 0 24 24" aria-hidden="true" {...P} strokeWidth="1.8"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" /><path d="M18 3v4h-4M6 21v-4h4" /></svg>);
export const IconShuffle = () => (<svg viewBox="0 0 24 24" aria-hidden="true" {...P} strokeWidth="1.8"><path d="M16 4h4v4M20 4l-6.5 6.5M4 20l6-6M16 20h4v-4M20 20l-5-5M4 4l5 5" /></svg>);
export const IconQuestion = () => (<svg viewBox="0 0 24 24" aria-hidden="true" {...P} strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4" /><circle cx="12" cy="17" r=".6" fill="currentColor" /></svg>);
export const IconCards = () => (<svg viewBox="0 0 24 24" aria-hidden="true" {...P} strokeWidth="1.7"><rect x="3.5" y="7" width="13" height="13" rx="2.5" /><path d="M7.5 4h10a3 3 0 0 1 3 3v10" /></svg>);
export const IconVideo = () => (<svg viewBox="0 0 24 24" aria-hidden="true" {...P} strokeWidth="1.7"><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M10 9.5v5l4.3-2.5z" fill="currentColor" /></svg>);
export const IconPage = () => (<svg viewBox="0 0 24 24" aria-hidden="true" {...P} strokeWidth="1.7"><path d="M6 3.5h8l4 4v13H6z" /><path d="M14 3.5v4h4M9 12h6M9 15.5h6" /></svg>);
export const IconQuiz = () => (<svg viewBox="0 0 24 24" aria-hidden="true" {...P} strokeWidth="1.7"><rect x="4.5" y="3.5" width="15" height="17" rx="2.5" /><path d="M8 8.5l1.3 1.3L12 7.2M8 14.5l1.3 1.3 2.7-2.6M14.5 8.5H16M14.5 14.5H16" /></svg>);
