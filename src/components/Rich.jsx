/* `**key term**` drawn bold, and nothing else: no HTML is ever interpreted, so
   a card's text cannot inject markup. Used wherever an open-ended card's back
   is shown, so the pad, the pile and the session draw it the same way. */
export default function Rich({ text }) {
  const parts = String(text ?? "").split(/\*\*(.+?)\*\*/g);
  return <>{parts.map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p))}</>;
}
