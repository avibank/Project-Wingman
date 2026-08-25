import { useEffect, useState } from "react";
import { SPOOLING } from "../lib/copy.js";

// Nothing at all for the first second. A label that appears and disappears on
// a fast connection reads as a stutter; past a second the wait is real and
// saying so beats a blank frame.
//
// role="status" so it is announced once it arrives, without stealing focus.

const SPOOLING_CSS = `
.spooling { font-size: 13.5px; color: var(--t2); margin: 0; padding: 28px 22px; }
`;

function Spooling({ delay = 1000 }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  if (!show) return null;
  return (
    <>
      <p className="spooling" role="status">{SPOOLING}</p>
      <style>{SPOOLING_CSS}</style>
    </>
  );
}

export default Spooling;
