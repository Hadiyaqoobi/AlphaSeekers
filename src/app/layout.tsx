import type { Metadata } from "next";

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
      <body>{children}</body>
    </html>
  );
}
