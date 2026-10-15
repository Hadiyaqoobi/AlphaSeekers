"use client";

import { useState } from "react";

import { FONT_STACKS, certificateLayout, type CertificateContent } from "@/lib/certificates/layout";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });
}

/**
 * Draw the certificate at full template resolution, in the browser. Nothing is
 * generated or stored on the server, so this costs the platform nothing.
 */
async function renderPng(content: CertificateContent, qrSvg: string): Promise<Blob> {
  const layout = certificateLayout(content);
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  await Promise.all(
    layout.lines.map((line) =>
      document.fonts.load(`${line.weight} ${line.size}px ${FONT_STACKS[line.family]}`).catch(() => undefined),
    ),
  );

  ctx.drawImage(await loadImage(layout.background), 0, 0, layout.width, layout.height);

  for (const line of layout.lines) {
    ctx.font = `${line.weight} ${line.size}px ${FONT_STACKS[line.family]}`;
    ctx.fillStyle = line.color;
    ctx.textAlign = line.align;
    ctx.textBaseline = "middle";
    // Not in every browser yet; without it the line is simply a little tighter.
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = line.tracking
      ? `${line.tracking * line.size}px`
      : "0px";
    ctx.fillText(line.text, line.x, line.y);
  }

  const qr = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`);
  ctx.drawImage(qr, layout.qr.x, layout.qr.y, layout.qr.size, layout.qr.size);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create the image"))), "image/png"),
  );
}

export function CertificateActions({ content, qrSvg }: { content: CertificateContent; qrSvg: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const landscape = content.kind === "STUDENT_COMPLETION";

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const blob = await renderPng(content, qrSvg);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `AlphaSeekers-certificate-${content.code}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setError("The image could not be created on this device. Try “Print or save as PDF” instead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="certificate-actions flex flex-wrap items-center gap-3">
      {/* Print only the certificate, edge to edge, on one A4 page. */}
      <style>{`
        @media print {
          @page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 0; }
          html, body { background: #fff !important; }
          body * { visibility: hidden !important; }
          .certificate-print-area, .certificate-print-area * { visibility: visible !important; }
          .certificate-print-area { position: fixed; inset: 0; margin: 0; padding: 0; }
          .certificate-print-area .certificate-sheet { box-shadow: none; width: 100%; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <button
        className="btn-primary disabled:opacity-60"
        disabled={busy}
        onClick={download}
        type="button"
      >
        {busy ? "Preparing…" : "Download image"}
      </button>
      <button
        className="btn-secondary"
        onClick={() => window.print()}
        type="button"
      >
        Print or save as PDF
      </button>
      {error ? <p className="w-full text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
