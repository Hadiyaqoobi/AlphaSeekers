import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AlphaSeekers",
    short_name: "AlphaSeekers",
    description: "Free education platform for Afghan girls",
    start_url: "/fa",
    scope: "/",
    display: "standalone",
    background_color: "#0A1118",
    theme_color: "#00E676",
    lang: "fa",
    dir: "rtl",
    categories: ["education"],
    prefer_related_applications: false,
    icons: [
      {
        src: "/logo/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
