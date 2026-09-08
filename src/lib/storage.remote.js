/* =============================================================================
   SUPABASE STORAGE, OVER ITS REST API.
   -----------------------------------------------------------------------------
   `supabase` in this app is a bare PostgrestClient — see the header of
   supabaseClient.js for why: createClient() drags auth-js, storage-js,
   realtime-js and phoenix into the entry chunk for features with no call site.

   So there is no `supabase.storage`, and the first version of the upload path
   called it anyway. It threw "Cannot read properties of undefined (reading
   'from')" on a real 44MB manual, and a too-broad catch reported that as "that
   file would not open as a PDF" — a storage bug wearing a parser's clothes.

   Storage's REST API is four endpoints and needs no library. XHR rather than
   fetch for the upload, because fetch cannot report upload progress and a 44MB
   transfer with no progress bar is indistinguishable from a hang.
   ========================================================================= */

const URL_BASE = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const storageConfigured = Boolean(URL_BASE && KEY);

const headers = () => ({ apikey: KEY, Authorization: `Bearer ${KEY}` });

export const publicUrl = (bucket, path) =>
  `${URL_BASE}/storage/v1/object/public/${bucket}/${encodeURI(path)}`;

/* A missing bucket is a SETUP state, not a failure. They read differently and
   they need different words. */
export const isMissingBucket = (message = "") =>
  /bucket not found|not_found|does not exist/i.test(String(message));

export function upload(bucket, path, body, { contentType, onProgress, signal } = {}) {
  return new Promise((resolve) => {
    if (!storageConfigured) {
      resolve({ ok: false, status: 0, message: "Storage is not configured in this build." });
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${URL_BASE}/storage/v1/object/${bucket}/${encodeURI(path)}`, true);
    for (const [k, v] of Object.entries(headers())) xhr.setRequestHeader(k, v);
    if (contentType) xhr.setRequestHeader("Content-Type", contentType);
    /* Overwrite rather than fail on a second attempt: an upload that died
       halfway must be retryable without inventing a new path. */
    xhr.setRequestHeader("x-upsert", "true");

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded, e.total);
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { resolve({ ok: true, status: xhr.status }); return; }
      let message = xhr.responseText || `HTTP ${xhr.status}`;
      try { message = JSON.parse(xhr.responseText)?.message || message; } catch { /* not json */ }
      resolve({ ok: false, status: xhr.status, message });
    };
    xhr.onerror = () => resolve({
      ok: false, status: 0,
      message: "The connection dropped while uploading. Nothing was lost — try again.",
    });
    xhr.onabort = () => resolve({ ok: false, status: 0, aborted: true, message: "Cancelled." });
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

export async function remove(bucket, paths) {
  if (!storageConfigured || !paths.length) return { ok: true };
  const res = await fetch(`${URL_BASE}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
  });
  return { ok: res.ok, status: res.status };
}

/* Does the bucket exist and can we write to it? Asked before a 44MB upload
   starts, so a missing bucket costs a round trip rather than four minutes. */
export async function canWrite(bucket) {
  if (!storageConfigured) return { ok: false, message: "Storage is not configured in this build." };
  const probe = `.probe/${Date.now()}.txt`;
  const res = await upload(bucket, probe, new Blob(["ok"], { type: "text/plain" }),
    { contentType: "text/plain" });
  if (res.ok) { remove(bucket, [probe]); return { ok: true }; }
  return { ok: false, status: res.status, message: res.message, missing: isMissingBucket(res.message) };
}
