import { PhotoIcon, FileIcon, PassageIcon, CloseIcon, SpinnerIcon } from "./chatIcons.jsx";

const ICON = { image: PhotoIcon, file: FileIcon, passage: PassageIcon };

/* What is waiting to go with the next message, between the transcript and the
   composer. Each chip's × takes it back out. */
export default function AttachmentTray({ items = [], onRemove = () => {} }) {
  if (!items.length) return null;
  return (
    <div className="att-tray">
      {items.map((item, i) => {
        const Icon = ICON[item.kind] || FileIcon;
        const label = item.kind === "passage"
          ? `${item.paperTitle || "Paper"}${item.page ? ` · p.${item.page}` : ""}`
          : item.file?.name || "Attachment";
        return (
          <div key={item.id ?? i}
               className={`att-chip${item.kind === "passage" ? " is-passage" : ""}${item.uploading ? " is-busy" : ""}`}>
            <span className="ci">{item.uploading ? <SpinnerIcon /> : <Icon size={15} />}</span>
            <span className="ct" title={label}>{label}</span>
            <button className="cx is-inline" type="button" onClick={() => onRemove(i)}
                    aria-label={`Remove ${label}`}>
              <CloseIcon />
            </button>
          </div>
        );
      })}
    </div>
  );
}
