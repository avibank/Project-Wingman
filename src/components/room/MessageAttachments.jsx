import { formatBytes } from "../../lib/attachments.js";
import { FileIcon, PassageIcon } from "./chatIcons.jsx";

/* =============================================================================
   A message's attachments, inside its bubble and above its text.
   -----------------------------------------------------------------------------
   `url` is already resolved by toAttachment: the public object URL once the
   file has landed, or a local object URL on the optimistic copy, so a photo is
   on screen the moment it is sent rather than after the upload finishes.

   An image reserves its aspect ratio from the stored width and height before it
   loads, so the transcript does not jump as photos arrive.
   ========================================================================= */
export default function MessageAttachments({
  attachments = [], onOpenPassage = () => {}, onOpenImage = () => {},
}) {
  if (!attachments.length) return null;
  return (
    <>
      {attachments.map((a, i) => {
        const key = a.id || `${a.kind}-${i}`;
        if (a.kind === "image") return <ImageAttachment key={key} att={a} onOpen={onOpenImage} />;
        if (a.kind === "passage") return <PassageAttachment key={key} att={a} onOpen={onOpenPassage} />;
        return <FileAttachment key={key} att={a} />;
      })}
    </>
  );
}

function ImageAttachment({ att, onOpen }) {
  const ratio = att.width && att.height ? `${att.width} / ${att.height}` : "4 / 3";
  return (
    <button className="att-shot" type="button" style={{ aspectRatio: ratio }}
            onClick={() => att.url && onOpen(att.url, att)}
            aria-label={att.fileName ? `Open ${att.fileName}` : "Open photo"}>
      {att.url
        ? <img src={att.url} alt={att.fileName || ""} loading="lazy" />
        : <span className="att-shot-wait" />}
    </button>
  );
}

function FileAttachment({ att }) {
  const kind = (att.mimeType || "").split("/").pop()?.toUpperCase().slice(0, 4) || "FILE";
  return (
    <a className="att-file" href={att.url || undefined} target="_blank" rel="noreferrer"
       download={att.fileName || undefined}>
      <span className="ico"><FileIcon size={17} /></span>
      <span className="meta">
        <span className="nm">{att.fileName}</span>
        <span className="sz">{formatBytes(att.byteSize)} · {kind}</span>
      </span>
    </a>
  );
}

function PassageAttachment({ att, onOpen }) {
  return (
    <button className="att-pass" type="button" onClick={() => onOpen(att)}>
      <span className="src">
        <PassageIcon size={12} />
        {att.paperTitle || "Paper"}{att.page ? ` · p.${att.page}` : ""}
      </span>
      <span className="quote">“{att.quote}”</span>
      <span className="go">Open in the reader</span>
    </button>
  );
}
