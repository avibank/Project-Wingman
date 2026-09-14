/* =============================================================================
   The squadron chat's own icons.
   -----------------------------------------------------------------------------
   The send button is an aircraft planform, not a paper dart. It carries the
   app's aviation identity, and the stylesheet turns it 45° so the nose points
   up and to the right. The rest are drawn to sit beside it at the same weight,
   which is why they are not lucide's.
   ========================================================================= */

const stroke = {
  fill: "none", stroke: "currentColor", strokeWidth: 1.9,
  strokeLinecap: "round", strokeLinejoin: "round",
};

export function SendPlane({ size = 21 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M12 1.6c1.3 1.7 2 3.8 2.1 6.2V10l7.9 5v2.5l-7.9-2.7v4.4l3 2.4V23l-5.1-1.5L6.9 23v-1.4l3-2.4v-4.4L2 17.5V15l7.9-5V7.8C10 5.4 10.7 3.3 12 1.6Z" />
    </svg>
  );
}

export function PlusIcon({ size = 21 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...stroke} strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function PhotoIcon({ size = 19 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...stroke}>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <circle cx="8.8" cy="9" r="1.6" />
      <path d="m4 17 5-5 4.5 4.5L17 13l3 3" />
    </svg>
  );
}

export function FileIcon({ size = 19 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...stroke}>
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
    </svg>
  );
}

export function PassageIcon({ size = 19 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...stroke}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M9 7h7" /><path d="M9 11h5" />
    </svg>
  );
}

export function CloseIcon({ size = 13 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...stroke} strokeWidth="2.2">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function BackIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...stroke} strokeWidth="2">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function SpinnerIcon({ size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...stroke} strokeWidth="2.4" className="spin">
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}
