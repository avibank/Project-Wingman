/* The two icons §3 puts in the player bar, path for path from
   docs/launch/reference/01-module-lesson-crew.html. They are not in lucide and
   they are not interchangeable with anything that is: the rectangle is the
   rubber stamp that appears on the progress bar a second later, and the
   diamond is the question mark that appears there in violet. An icon that did
   not match the mark it leaves would make the bar unreadable.
   currentColor, not the demo's #fff — the control bar owns its own colour. */

export const StampIcon = (props) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.7" aria-hidden="true" {...props}>
    <rect x="3" y="6" width="18" height="12" rx="1.5" />
    <rect x="5.8" y="8.8" width="12.4" height="6.4" rx=".5" strokeWidth="1" />
  </svg>
);

export const AskIcon = (props) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M12 2.5 21.5 12 12 21.5 2.5 12z" />
    <path d="M10 10a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6.9v.4M12 15.6v.1" strokeLinecap="round" />
  </svg>
);
