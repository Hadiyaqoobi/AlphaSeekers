import "@fontsource/great-vibes/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/noto-serif/400.css";

import { FONT_STACKS, certificateLayout, type CertificateContent } from "@/lib/certificates/layout";

/**
 * One certificate, drawn over the approved template. Sizes are in container
 * units, so the page, a phone and the printed A4 sheet all scale the same way.
 *
 * `qrSvg` is produced on the server by the `qrcode` package from the
 * certificate's own verify URL; it is never built from anything a visitor typed.
 */
export function CertificateSheet({ content, qrSvg }: { content: CertificateContent; qrSvg: string }) {
  const layout = certificateLayout(content);
  const pct = (value: number, of: number) => `${(value / of) * 100}%`;

  return (
    <div
      className="certificate-sheet relative w-full overflow-hidden bg-white shadow-lg"
      style={{ aspectRatio: `${layout.width} / ${layout.height}`, containerType: "inline-size" }}
    >
      {/* Plain <img>: Render's image optimiser times out on large images. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" className="absolute inset-0 h-full w-full" src={layout.background} />
      {layout.lines.map((line, index) => (
        <span
          className="absolute whitespace-nowrap leading-none"
          dir="auto"
          key={index}
          style={{
            left: pct(line.x, layout.width),
            top: pct(line.y, layout.height),
            transform: line.align === "center" ? "translate(-50%, -50%)" : "translateY(-50%)",
            fontFamily: FONT_STACKS[line.family],
            fontWeight: line.weight,
            fontSize: `${(line.size / layout.width) * 100}cqw`,
            letterSpacing: line.tracking ? `${line.tracking}em` : undefined,
            color: line.color,
          }}
        >
          {line.text}
        </span>
      ))}
      <div
        aria-label={`QR code that opens the verification page for certificate ${content.code}`}
        className="absolute [&>svg]:h-full [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
        role="img"
        style={{
          left: pct(layout.qr.x, layout.width),
          top: pct(layout.qr.y, layout.height),
          width: pct(layout.qr.size, layout.width),
          height: pct(layout.qr.size, layout.height),
        }}
      />
    </div>
  );
}
