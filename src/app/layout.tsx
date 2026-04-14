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
      <body>
        {children}
        {/* Force-refresh service worker to clear stale v3 caches */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if('serviceWorker' in navigator){
                navigator.serviceWorker.getRegistrations().then(function(regs){
                  regs.forEach(function(r){r.unregister()});
                });
                setTimeout(function(){
                  navigator.serviceWorker.register('/sw.js');
                },2000);
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
