"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

type Layout = { scale: number; boxW: number; boxH: number };

/**
 * Cadre ratio A4 (210∶297), sans scroll : le CV est réduit pour tenir dans la « feuille ».
 */
export function CvA4PreviewShell({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout>({ scale: 1, boxW: 794, boxH: 400 });

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;

    const update = () => {
      const fw = frame.clientWidth;
      const fh = frame.clientHeight;
      const cw = content.scrollWidth;
      const ch = content.scrollHeight;
      if (cw < 1 || ch < 1) return;
      const s = Math.min(1, fw / cw, fh / ch);
      setLayout({ scale: s, boxW: cw * s, boxH: ch * s });
    };

    update();
    requestAnimationFrame(() => requestAnimationFrame(update));
    const ro = new ResizeObserver(update);
    ro.observe(frame);
    ro.observe(content);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div
      ref={frameRef}
      className="mx-auto flex items-center justify-center overflow-hidden"
      style={{
        width: "min(794px, 100%)",
        aspectRatio: "210 / 297",
        maxHeight: "min(85vh, 1123px)",
        background: "#ffffff",
        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.14)",
        borderRadius: 6,
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
