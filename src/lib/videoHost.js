// Where video comes from, in one place.
//
// The player takes a src and knows nothing about who is serving it. This is
// the seam that makes moving from an MP4 bucket to Cloudflare Stream or Mux a
// config change rather than a rewrite — which is the only reason it exists
// now, while there is exactly one host.
export const HOSTS = {
  // Direct file. What the seeded content uses.
  mp4: { resolve: (src) => src, kind: "file" },
  // Both of these serve HLS behind a playback id. Neither is wired up; the
  // shape is here so adding one is a line rather than a refactor.
  mux: { resolve: (id) => `https://stream.mux.com/${id}.m3u8`, kind: "hls" },
  cloudflare: { resolve: (id) => `https://videodelivery.net/${id}/manifest/video.m3u8`, kind: "hls" },
};

export function resolveVideo(kind, src) {
  const host = HOSTS[kind] || HOSTS.mp4;
  return { url: host.resolve(src), kind: host.kind };
}
