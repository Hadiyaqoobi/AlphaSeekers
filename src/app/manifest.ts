import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AlphaSeekers",
    short_name: "AlphaSeekers",
    description: "Free education platform for Afghan girls",
    start_url: "/fa",
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0369a1",
    lang: "fa",
    dir: "rtl",
    categories: ["education"],
    prefer_related_applications: false,
    icons: [
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
