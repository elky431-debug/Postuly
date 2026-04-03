"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

type Layout = { scale: number; boxW: number; boxH: number };

/**
 * Cadre ratio A4 (210∶297), sans scroll interne : le CV est mis à l’échelle pour tenir dans la feuille.
 * maxHeight ≈ A4 réel (1123px) ou 78dvh : le navigateur réduit la largeur pour garder le ratio si besoin.
 */
export function CvA4PreviewShell({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout>({ scale: 1, boxW: 794, boxH: 400 });

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;

    const measureContent = () => {
      const inner = content.firstElementChild as HTMLElement | null;
      const cw = inner?.scrollWidth ?? content.scrollWidth;
      const ch = inner?.scrollHeight ?? content.scrollHeight;
      return { cw, ch };
    };

    const update = () => {
      const fw = frame.clientWidth;
      const fh = frame.clientHeight;
      const { cw, ch } = measureContent();
      if (cw < 1 || ch < 1) return;
      const s = Math.min(1, fw / cw, fh / ch);
      setLayout({ scale: s, boxW: cw * s, boxH: ch * s });
    };

    update();
    requestAnimationFrame(() => requestAnimationFrame(update));

    const imgs = content.querySelectorAll("img");
    const onImg = () => update();
    imgs.forEach((img) => {
      if (!img.complete) img.addEventListener("load", onImg);
    });

    const ro = new ResizeObserver(update);
    ro.observe(frame);
    ro.observe(content);
    return () => {
      ro.disconnect();
      imgs.forEach((img) => img.removeEventListener("load", onImg));
    };
  }, [children]);

  return (
    <div
      ref={frameRef}
      className="mx-auto flex shrink-0 items-center justify-center overflow-hidden"
      style={{
        boxSizing: "border-box",
        width: "min(794px, 100%)",
        aspectRatio: "210 / 297",
        maxHeight: "min(1123px, 78dvh)",
        background: "#ffffff",
        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.14)",
        borderRadius: 4,
        contain: "layout style",
      }}
    >
      <div
        style={{
          width: layout.boxW,
          height: layout.boxH,
          overflow: "hidden",
        }}
      >
        <div
          ref={contentRef}
          style={{
            transform: `scale(${layout.scale})`,
            transformOrigin: "top left",
            width: "max-content",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
