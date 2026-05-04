import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "article-caster",
  description: "Personal podcast feeder for articles",
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
