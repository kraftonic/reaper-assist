import { useEffect, useState } from "react";
import type { ImageRef } from "@shared/types";
import { formatBytes } from "@shared/images";
import { cachedImage, loadImage } from "./images";
import { Icon } from "../Icon";

/** A stored image's thumbnail; click to see it full size. */
export function Thumb({ convId, image, onOpen }: { convId: string; image: ImageRef; onOpen: (url: string, alt: string) => void }) {
  const [url, setUrl] = useState<string | null>(() => cachedImage(convId, image.id));
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (url) return;
    let live = true;
    void loadImage(convId, image.id).then((u) => {
      if (!live) return;
      if (u) setUrl(u);
      else setMissing(true);
    });
    return () => {
      live = false;
    };
  }, [convId, image.id, url]);
  const alt = image.name ?? "Attached image";
  const title = `${alt} · ${image.width}×${image.height} · ${formatBytes(image.bytes)}`;
  if (missing) {
    return (
      <span className="thumb missing" title="This image is no longer available">
        <Icon name="image" size={16} />
      </span>
    );
  }
  return (
    <button type="button" className="thumb" title={title} onClick={() => url && onOpen(url, alt)} disabled={!url}>
      {url ? <img src={url} alt={alt} /> : <Icon name="image" size={16} />}
    </button>
  );
}
