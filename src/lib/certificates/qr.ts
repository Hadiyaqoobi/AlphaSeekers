import QRCode from "qrcode";

/**
 * The QR code printed on a certificate, as SVG. Server only. A fixed pixel size
 * keeps the downloaded image sharp in browsers that rasterise an SVG at its
 * declared size; on the page CSS stretches it to fit.
 */
export function certificateQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    margin: 1,
    width: 600,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });
}
