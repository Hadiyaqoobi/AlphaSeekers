import type { Metadata } from "next";

import "@fontsource-variable/inter";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "@fontsource/outfit/800.css";
import "@fontsource-variable/plus-jakarta-sans";

import "./globals.css";

export const metadata: Metadata = {
  title: "AlphaSeekers",
  description: "Free education platform for Afghan girls",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if('caches'in self)caches.keys().then(function(k){k.forEach(function(n){caches.delete(n)})});if('serviceWorker'in navigator)navigator.serviceWorker.getRegistrations().then(function(r){r.forEach(function(w){w.unregister()})})})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
