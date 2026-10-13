"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ProductGallery({ title, photos, primary }: { title: string; photos: string[]; primary: string }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<number | null>(null);
  const move = (amount: number) => setIndex((current) => (current + amount + photos.length) % photos.length);
  useEffect(() => {
    if (!open) return;
    const node = dialog.current!;
    const focused = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    node.showModal();
    document.body.style.overflow = "hidden";
    return () => { node.close(); document.body.style.overflow = overflow; focused?.focus(); };
  }, [open]);
  return <>
    <button type="button" className="product-photo-trigger" aria-label={`View photos of ${title}`} onClick={() => { setIndex(Math.max(0, photos.indexOf(primary))); setOpen(true); }}>
      <Image src={primary} alt={title} fill sizes="(max-width: 600px) 90vw, (max-width: 1000px) 45vw, 25vw" />
    </button>
    {open && <dialog ref={dialog} className="photo-dialog" aria-label={`${title} photos`} onCancel={() => setOpen(false)} onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); } }}>
      <div className="photo-viewer" onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }} onTouchEnd={(event) => { if (touchStart.current !== null) { const delta = event.changedTouches[0].clientX - touchStart.current; if (Math.abs(delta) > 50) move(delta > 0 ? -1 : 1); } touchStart.current = null; }}>
        <div className="photo-frame">
        <button type="button" className="photo-close" aria-label="Close photos" onClick={() => setOpen(false)}><X /></button>
        {photos.length > 1 && <button type="button" className="photo-arrow photo-left" aria-label="Previous photo" onClick={() => move(-1)}><ChevronLeft /></button>}
        {/* Intrinsic dimensions fit the photo directly to the viewport without a padded card. */}
        <img key={photos[index]} src={photos[index]} alt={`${title}, photo ${index + 1} of ${photos.length}`} />
        {photos.length > 1 && <button type="button" className="photo-arrow photo-right" aria-label="Next photo" onClick={() => move(1)}><ChevronRight /></button>}
        </div>
      </div>
    </dialog>}
  </>;
}
