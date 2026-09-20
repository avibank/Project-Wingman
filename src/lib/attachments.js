/* =============================================================================
   Attachments in squadron chat — a photo, a file, or a passage from a paper.
   -----------------------------------------------------------------------------
   Adapted from the design drop, and the adaptations are the point, so they are
   listed rather than left to be rediscovered:

   * UPLOADS GO STRAIGHT TO THE STORAGE REST ENDPOINT, not through storage-js.
     supabaseClient.js is a bare PostgrestClient on purpose — createClient()
     put auth-js, storage-js and realtime-js in the entry chunk for features
     with no call site. One fetch is all an upload needs, so that stays true.

   * THE BUCKET IS PUBLIC AND UNLISTABLE, not private with signed URLs. Signed
     URLs need a server-side key and this project has no server. See the
     storage section of migration 0026 for the whole argument; in short, the
     only private design that works here would let anyone holding the public
     key list every attachment in every squadron.

   * WRITES GO THROUGH add_message_attachments, which checks the message is
     yours, you are in its squadron, and every file row points inside that
     squadron's folder under your id. The drop inserted into the table
     directly, under policies that read a JWT this client does not send.

   * The message itself is still sent by postSquadronMessage in roomData.js, so
     the room's optimistic send, reply-to and read state all keep working.
   ========================================================================= */

import { supabase, configured } from "./supabaseClient.js";
import { papersOn } from "./flags.js";

export const BUCKET = "chat-attachments";
export const MAX_BYTES = 25 * 1024 * 1024;
export const MAX_PER_MESSAGE = 10;

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];
export const FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
];

const URL_BASE = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

const fail = (e, f) => { if (e) console.error(e); return f; };

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* The bucket refuses these too. Checking first means the student is told in
   words before a 20 MB upload is spent finding out. */
export function validateFile(file, kind) {
  const allowed = kind === "image" ? IMAGE_TYPES : [...IMAGE_TYPES, ...FILE_TYPES];
  if (!allowed.includes(file.type)) return `${file.name} isn't a type the chat accepts.`;
  if (file.size > MAX_BYTES) {
    return `${file.name} is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_BYTES)}.`;
  }
  return null;
}

/* An image's pixel size, read locally before upload, so the bubble can reserve
   exactly its space and the transcript does not jump when the image lands. */
export function readImageSize(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({ width: null, height: null }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

const encodePath = (p) => p.split("/").map(encodeURIComponent).join("/");

/* `{squadron}/{member}/{uuid}.{ext}` — the shape the storage policy in 0026
   checks, and the shape add_message_attachments checks a file row against.
   The two have to stay in step with this. */
function storagePath(squadronId, me, file) {
  const ext = ((file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "")) || "bin";
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${squadronId}/${me}/${id}.${ext}`;
}

export function publicUrl(path) {
  if (!path || !URL_BASE) return null;
  return `${URL_BASE}/storage/v1/object/public/${BUCKET}/${encodePath(path)}`;
}

export async function uploadAttachment(file, { squadronId, me }) {
  if (!configured) throw new Error("Attachments need the database to be configured.");
  if (!squadronId || !me) throw new Error("That can't be sent from here.");
  const path = storagePath(squadronId, me, file);
  const res = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${encodePath(path)}`, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      "content-type": file.type || "application/octet-stream",
      "cache-control": "3600",
      "x-upsert": "false",
    },
    body: file,
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json())?.message || ""; } catch { /* not json */ }
    throw new Error(/payload too large|exceeded/i.test(detail)
      ? `${file.name} is too big to send.`
      : `${file.name} didn't upload. Try again.`);
  }
  return path;
}

/* Upload the files in `pending`, then attach everything to the message.
   Passages need no upload; they ride along as they are. Returns the attachment
   rows the database made, or [] if none landed. */
export async function attachToMessage({ me, squadronId, messageId, pending = [] }) {
  if (!pending.length || !messageId) return [];
  const rows = [];
  for (const item of pending) {
    if (item.kind === "passage") {
      rows.push({
        kind: "passage", paper_id: item.paperId, paper_title: item.paperTitle || null,
        page: item.page ?? null, quote: item.quote, anchor: item.anchor ?? null,
      });
      continue;
    }
    const path = await uploadAttachment(item.file, { squadronId, me });
    rows.push({
      kind: item.kind, storage_path: path, file_name: item.file.name,
      mime_type: item.file.type || null, byte_size: item.file.size ?? null,
      width: item.width ?? null, height: item.height ?? null,
    });
  }
  const { data, error } = await supabase.rpc("add_message_attachments", {
    p_me: me, p_message: messageId, p_rows: rows,
  });
  if (error) return fail(error, []);
  return data || [];
}

/* The student's own marks in a module, shaped for the passage picker. */
const TONE = { unsure: "v", question: "v", critical: "a" };
export async function fetchMyMarks(me, moduleCode) {
  /* Papers are paused, so there is nothing to pick from and the picker is not
     shown. The query is not made rather than made and thrown away. */
  if (!papersOn) return [];
  if (!me || !moduleCode) return [];
  const { data, error } = await supabase.rpc("my_marks_in_module", {
    uid: me, p_module: moduleCode, p_limit: 60,
  });
  if (error) return fail(error, []);
  return (data || []).map((m) => ({
    id: m.id,
    paperId: m.paper_id,
    paperTitle: m.paper_title,
    page: null,
    quote: m.quote,
    anchor: m.anchor || null,
    tone: TONE[m.kind] || TONE[m.colour] || "b",
  }));
}

/* Rows as the bubble reads them. The optimistic copy carries `localUrl`, an
   object URL for the file still on this device, so a photo shows the moment it
   is sent rather than after it uploads. */
export const toAttachment = (a) => ({
  id: a.id,
  kind: a.kind,
  storagePath: a.storage_path || null,
  url: a.localUrl || publicUrl(a.storage_path),
  fileName: a.file_name || null,
  mimeType: a.mime_type || null,
  byteSize: a.byte_size ?? null,
  width: a.width ?? null,
  height: a.height ?? null,
  paperId: a.paper_id || null,
  paperTitle: a.paper_title || null,
  page: a.page ?? null,
  quote: a.quote || null,
  anchor: a.anchor || null,
});

/* WHAT A BUBBLE IS ALLOWED TO DRAW. A passage is a quote from a paper — the
   paper's title, its page and the words — so with papers paused it is reader
   work showing up somewhere else, and it goes. The ROW is untouched: it stays
   in comms_attachments, and turning papers back on draws it again. This is the
   one read path for stored attachments (roomData.js), so filtering here covers
   the transcript, the reply preview and the pinned copy at once. */
export const visibleAttachments = (rows) =>
  (rows || []).filter((a) => papersOn || a.kind !== "passage").map(toAttachment);
