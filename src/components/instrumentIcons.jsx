// Custom instrument-style icons for the main nav tabs, replacing the generic
// clipboard/chat-bubble/document set with a compass rose, attitude indicator,
// and altimeter dial. Each uses currentColor so it inherits the tab's active/
// inactive text color automatically, same as the Lucide icons they replace.

export function CompassRoseIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21" />
      <path d="M12 7.5 14 12l-2 4.5L10 12z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function AttitudeIndicatorIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" opacity="0.5" />
      <path d="M8 8.5 3 12l5 3.5M16 8.5l5 3.5-5 3.5" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function AltimeterIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v1.6M21 12h-1.6M12 21v-1.6M3 12h1.6M18.4 5.6l-1.1 1.1M18.4 18.4l-1.1-1.1M5.6 18.4l1.1-1.1M5.6 5.6l1.1 1.1" opacity="0.5" />
      <path d="M12 12 15 8" />
      <path d="M12 12 9.5 15.5" strokeWidth="1.2" opacity="0.7" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
