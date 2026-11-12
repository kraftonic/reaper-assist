import { useEffect } from "react";
import { Icon } from "../Icon";

/** A full-size view of an attached image. Click anywhere or press Esc to close. */
export function Lightbox({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  return (
    <div className="lightbox" role="dialog" aria-label={alt} onClick={onClose}>
      <img src={url} alt={alt} />
      <button className="icon-btn lightbox-close" onClick={onClose} title="Close (Esc)">
        <Icon name="x" />
      </button>
    </div>
  );
}
