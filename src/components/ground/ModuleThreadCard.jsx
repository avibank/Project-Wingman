import { Motif } from "./motifs.jsx";

/* The module's questions. One thread when it is quiet, a short list when it is not. */
export function ModuleThreadCard({
  moduleName,
  threads,        // [{ id, title, meta, mine, answers, answeredBy, when, excerpt }]
  limit = 2,
  showExcerpt,
  onOpenThread,
  onAsk,
}) {
  if (!threads || threads.length === 0) {
    return (
      <div className="bog-card">
        <div className="bog-ch"><span className="bog-lbl">{moduleName}</span></div>
        <div className="bog-body">
          <div className="bog-invite">
            <Motif kind="thread" />
            <p className="bog-lead">A question fills this card.</p>
            <p className="bog-why">Ask one and everyone on {moduleName} sees it.</p>
            <button className="bog-btn is-inline" type="button" data-primary="" onClick={onAsk}>
              Ask the first one
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (threads.length === 1) {
    const t = threads[0];
    return (
      <div className="bog-card">
        <div className="bog-ch">
          <span className="bog-lbl">Last thread · {moduleName}</span>
          <span className="bog-aside">{t.when}</span>
        </div>
        <button className="bog-thr bog-body" type="button" onClick={() => onOpenThread?.(t)}>
          <span className="bog-title">{t.title}</span>
          {showExcerpt && t.excerpt && <span className="bog-ex">{t.excerpt}</span>}
          <span className="bog-pills">
            {t.mine && <span className="bog-pill" data-on="">Yours</span>}
            <span className="bog-pill">
              {t.answers ? `${t.answers} ${t.answers === 1 ? "answer" : "answers"}` : "Needs an answer"}
            </span>
            {t.answeredBy && <span className="bog-pill">{t.answeredBy} answered</span>}
          </span>
        </button>
      </div>
    );
  }

  const rows = threads.slice(0, limit);
  const rest = threads.length - rows.length;

  return (
    <div className="bog-card">
      <div className="bog-ch">
        <span className="bog-lbl">Threads · {moduleName}</span>
        <span className="bog-aside">{threads.length} open</span>
      </div>
      <div className="bog-body" style={{ gap: 0 }}>
        {rows.map((t) => (
          <button className="bog-trow" type="button" key={t.id} onClick={() => onOpenThread?.(t)}>
            <span className="bog-t">{t.title}</span>
            <span className="bog-m">{t.meta}</span>
          </button>
        ))}
      </div>
      <div className="bog-foot">
        {rest > 0 ? `${rest} more in the Ready Room` : "All of them are in the Ready Room"}
      </div>
    </div>
  );
}
