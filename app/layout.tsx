import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Color Dash — Think fast. Tap the match.",
  description:
    "A fast, colorful browser game made for one-thumb play. Match the color before time runs out.",
  icons: {
    icon: "./favicon.svg",
    shortcut: "./favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a1b2e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
