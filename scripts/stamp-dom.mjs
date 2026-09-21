/* =============================================================================
   JUST ENOUGH OF A PAGE FOR THE STAMP ENGINE TO RUN IN NODE.
   -----------------------------------------------------------------------------
   src/lib/stamp-engine.js is the reference's engine byte for byte, and it
   assumes a page: it finds `svg defs` to hang its ink filters on, and it
   measures every outline it samples by appending a <path> to that <svg> and
   asking for getTotalLength / getPointAtLength. A check that must not need a
   browser (`npm run check`) supplies exactly those, and nothing else:

     · one <svg><defs>, found by document.querySelector('svg defs');
     · elements that keep their attributes, children and innerHTML;
     · path measurement from svg-path-properties, which reads the same path
       grammar the engine writes (absolute and relative arcs included).

   Install it BEFORE importing the engine — it looks for its <svg> as soon as
   it is evaluated. Anything the engine asks for that is not here throws,
   which is the point: a shim that answered everything would hide a change.
   ========================================================================= */
import { svgPathProperties } from "svg-path-properties";

export function installStampDom() {
  const byId = new Map();
  const make = (tag) => {
    const el = {
      tagName: tag, attrs: {}, children: [], parentNode: null, _html: "",
      setAttribute(k, v) { this.attrs[k] = String(v); if (k === "id") byId.set(String(v), this); },
      getAttribute(k) { return this.attrs[k] ?? null; },
      get id() { return this.attrs.id || ""; },
      set id(v) { this.setAttribute("id", v); },
      set innerHTML(v) { this._html = String(v); },
      get innerHTML() { return this._html; },
      appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
      remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((x) => x !== this); this.parentNode = null; },
      getTotalLength() { return new svgPathProperties(this.attrs.d).getTotalLength(); },
      getPointAtLength(L) { return new svgPathProperties(this.attrs.d).getPointAtLength(L); },
    };
    return el;
  };
  const svg = make("svg");
  const defs = make("defs");
  svg.appendChild(defs);
  svg.setAttribute("id", "pw-stamp-defs");
  globalThis.document = {
    body: {},
    querySelector(sel) {
      if (sel === "svg defs") return defs;
      throw new Error(`stamp-dom: the engine asked for "${sel}", which this shim does not supply`);
    },
    getElementById: (id) => byId.get(id) || null,
    createElementNS: (_ns, tag) => make(tag),
  };
  return { svg, defs };
}
