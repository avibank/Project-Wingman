import { useState } from "react";
import { FileText, Search } from "lucide-react";
import { PDFS } from "../data.js";

function PdfPanel() {
  const [query, setQuery] = useState("");
  const filtered = PDFS.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="pdf-wrap">
      <div className="pdf-search">
        <Search size={15} />
        <input placeholder="Search the library…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="pdf-list">
        {filtered.map((p) => (
          <div key={p.id} className="pdf-row">
            <div className="pdf-icon"><FileText size={18} color="var(--accent)" /></div>
            <div className="pdf-meta">
              <div className="pdf-title">{p.title}</div>
              <div className="pdf-sub">{p.pages} pages · {p.size}</div>
            </div>
            <button className="pdf-open">Open</button>
          </div>
        ))}
        {filtered.length === 0 && <p className="pdf-empty">No files match "{query}".</p>}
      </div>
      <style>{`
        .pdf-wrap { display: flex; flex-direction: column; gap: 16px; }
        .pdf-search { display: flex; align-items: center; gap: 8px; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; color: var(--muted2); }
        .pdf-search input { flex: 1; background: transparent; border: none; color: var(--text); font-size: 13.5px; }
        .pdf-search input:focus { outline: none; }
        .pdf-list { display: flex; flex-direction: column; gap: 10px; }
        .pdf-empty { color: var(--muted); font-size: 13.5px; text-align: center; padding: 20px 0; }
        .pdf-row { display: flex; align-items: center; gap: 14px; padding: 14px; border: 1px solid var(--border); border-radius: 14px; background: var(--panel); }
        .pdf-icon { width: 36px; height: 36px; border-radius: 12px; background: var(--accent-soft); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .pdf-title { font-size: 14px; color: var(--text); }
        .pdf-sub { font-size: 11.5px; color: var(--muted2); margin-top: 2px; }
        .pdf-meta { flex: 1; }
        .pdf-open { background: transparent; border: 1px solid var(--border-hover); color: var(--text); border-radius: 10px; padding: 7px 14px; font-size: 12.5px; cursor: pointer; }
        .pdf-open:hover { border-color: var(--accent); color: var(--accent); }
      `}</style>
    </div>
  );
}

export default PdfPanel;
