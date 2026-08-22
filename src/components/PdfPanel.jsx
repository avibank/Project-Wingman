import { useState } from "react";
import { FileText, Search, SearchX } from "lucide-react";
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
        {filtered.length === 0 && (
          <div className="pdf-empty">
            <SearchX size={28} className="pdf-empty-icon" />
            <p>No files match "{query}" — nothing on the manifest.</p>
          </div>
        )}
      </div>
      <style>{`
        .pdf-wrap { display: flex; flex-direction: column; gap: 16px; max-width: 900px; margin: 0 auto; }
        .pdf-search { display: flex; align-items: center; gap: 8px; background: var(--well); border: 1px solid var(--border); box-shadow: var(--shadow-inset); border-radius: var(--r-md); padding: 10px 14px; color: var(--muted2); transition: border-color 0.2s ease, box-shadow 0.2s ease; }
        .pdf-search:focus-within { border-color: var(--accent-soft); box-shadow: 0 0 12px 1px var(--accent-soft); }
        .pdf-search input { flex: 1; background: transparent; border: none; color: var(--text); font-size: 13.5px; }
        .pdf-search input::placeholder { color: var(--muted); }
        .pdf-search input:focus { outline: none; }
        .pdf-list { display: flex; flex-direction: column; gap: 10px; }
        .pdf-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--muted); font-size: 13.5px; text-align: center; padding: 20px 0; }
        .pdf-empty-icon { color: var(--muted2); opacity: 0.6; }
        .pdf-empty p { margin: 0; max-width: 300px; }
        .pdf-row { display: flex; align-items: center; gap: 14px; padding: 14px; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--panel); box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
        .pdf-icon { width: 36px; height: 36px; border-radius: var(--r-md); background: var(--accent-soft); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .pdf-title { font-size: 13.5px; color: var(--text); }
        .pdf-sub { font-size: 11.5px; color: var(--muted2); margin-top: 2px; }
        .pdf-meta { flex: 1; }
        .pdf-open { background: transparent; border: 1px solid var(--border-hover); color: var(--text); border-radius: var(--r-md); padding: 7px 14px; font-size: 12.5px; cursor: pointer; }
        .pdf-open:hover { border-color: var(--accent); color: var(--accent); }
      `}</style>
    </div>
  );
}


export default PdfPanel;
