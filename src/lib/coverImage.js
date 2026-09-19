/* =============================================================================
   AN UPLOADED COVER — §5: "Image upload needs size and type limits, storage,
   and a crop that fills 640x128."
   -----------------------------------------------------------------------------
   All three, in that order, and every one of them for a reason a student can
   feel:

   · LIMITS, because the browser decodes whatever it is handed and a 60-megapixel
     phone photo will take a phone's whole memory doing it. The type list is
     what a canvas can reliably draw; HEIC is not on it, and a HEIC handed to
     <img> resolves to nothing at all on every engine but Safari's, so it is
     refused with words rather than failing silently.
   · A CROP THAT FILLS 640x128, because that is the shape of the cover and
     nothing else. Letterboxing a portrait photo into a 5:1 band gives a
     picture with two grey ends; the crop takes a 5:1 window OUT of it.
   · STORAGE, because a data: URL of a photo is a megabyte of base64 in a
     database column that everybody who opens the card downloads.

   WHAT IS UPLOADED IS THE CROP, NOT THE PHOTO. The canvas is exactly 640x128,
   so what leaves the browser is about 40KB and carries no EXIF — no camera,
   no timestamp, and no GPS coordinates, which a holiday photo usually has.
   That is a privacy property and it is the reason this is done here rather
   than by uploading the original and cropping with a URL parameter.
   ========================================================================= */

export const COVER_BUCKET = 'covers';
export const COVER_W = 640;
export const COVER_H = 128;

/* What a canvas can draw, everywhere. PNG, JPEG, WEBP and GIF; not HEIC, not
   AVIF (Safari 15 and under), not SVG — an SVG cover is a script somebody
   else's browser runs. */
export const COVER_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
/* Before decoding, not after: this is the file, and it is generous for a
   photo and mean for a screenshot of a PDF. */
export const COVER_MAX_BYTES = 8 * 1024 * 1024;

export function checkFile(file) {
  if (!file) return 'Pick an image to use.';
  if (!COVER_TYPES.includes(file.type)) {
    return 'That has to be a PNG, JPEG, WEBP or GIF. A photo straight off an iPhone is usually HEIC — share it once and it becomes a JPEG.';
  }
  if (file.size > COVER_MAX_BYTES) return 'That image is over 8MB. A smaller one will look the same at this size.';
  return null;
}

/* The window the crop takes, as fractions: `z` is how much bigger than the
   window the image is drawn, `x` and `y` slide it, both clamped so no edge
   of the window is ever empty. Kept as numbers rather than pixels so the
   preview and the export agree at any preview size. */
export const clampPan = (v, z) => {
  const limit = Math.max(0, (z - 1) / 2);
  return Math.max(-limit, Math.min(limit, v));
};

/* The one that does the work: draw the image into a 640x128 canvas under the
   same transform the preview showed, and hand back a blob. `cover` scaling
   first — the image always fills the window before z is applied — so z of 1
   is "as large as it needs to be", never "smaller than the window". */
export function renderCover(img, { z = 1, x = 0, y = 0 } = {}) {
  const c = document.createElement('canvas');
  c.width = COVER_W; c.height = COVER_H;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  const fit = Math.max(COVER_W / img.naturalWidth, COVER_H / img.naturalHeight);
  const w = img.naturalWidth * fit * z;
  const h = img.naturalHeight * fit * z;
  ctx.drawImage(img, (COVER_W - w) / 2 + x * COVER_W, (COVER_H - h) / 2 + y * COVER_H, w, h);
  return new Promise((done) => c.toBlob((b) => done(b), 'image/webp', 0.86));
}

/* One path per pilot, overwritten. A second cover does not leave the first
   one lying in the bucket for ever, and there is nothing to tidy up later.
   The cache-buster is on the URL rather than the path for the same reason:
   the object is one object, and only its contents change. */
/* STORAGE IS IMPORTED WHERE IT IS USED, not at the top. storage.remote.js
   reads import.meta.env the moment it is loaded, which a check running in
   node cannot give it — so a static import here would make every pure rule in
   this file untestable outside a browser. It also keeps the upload path out
   of any chunk that only ever crops. */
export async function uploadCover(userId, blob) {
  /* NO ID, NO UPLOAD. Without this the path is the string "undefined" and the
     object lands at `undefined/cover.webp` — one shared slot, overwritten by
     whoever is signed out next, and stored against nobody. It happened on the
     live site within a minute of the feature existing: the page rendered for
     a signed-out visitor and every control on it did nothing except this one,
     which did something worse. */
  if (!userId) return { ok: false, message: 'Sign in to put a picture on your licence.' };
  if (!blob || !blob.size) return { ok: false, message: 'That did not come out as an image. Try again.' };
  const { upload, publicUrl, isMissingBucket, storageConfigured } =
    await import('./storage.remote.js');
  if (!storageConfigured) return { ok: false, message: 'Uploads are off in this build.' };
  const path = `${userId}/cover.webp`;
  const r = await upload(COVER_BUCKET, path, blob, { contentType: 'image/webp' });
  if (!r.ok) {
    return {
      ok: false,
      message: isMissingBucket(r.message)
        ? 'Covers are not set up on this project yet.'
        : 'That did not upload. Try again in a moment.',
    };
  }
  return { ok: true, url: `${publicUrl(COVER_BUCKET, path)}?v=${Date.now()}` };
}
