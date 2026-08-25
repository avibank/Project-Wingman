// A silent fallback to the Flight Deck is worse than an honest "nothing here",
// so every unknown path and every route that is registered but not yet built
// lands on this.

const NOT_FOUND_CSS = `
.notfound { max-width: 640px; margin: 0 auto; padding: 28px 22px 80px;
  display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
.notfound-h1 { font-family: var(--font-display); font-size: 32px; font-weight: 700;
  letter-spacing: -.7px; margin: 0; color: var(--t1); }
.notfound-p { font-size: 13.5px; color: var(--t2); line-height: 1.5; margin: 0 0 6px; }
`;

function NotFound({ onGoHome }) {
  return (
    <div className="notfound">
      <h1 className="notfound-h1">Wrong bay.</h1>
      <p className="notfound-p">Nothing parked here. Try the Flight Deck.</p>
      <button className="btn-primary" type="button" onClick={onGoHome}>Flight Deck</button>
      <style>{NOT_FOUND_CSS}</style>
    </div>
  );
}

export default NotFound;
