import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RankForge — Compete Together",
  description: "Your game. Your squad. Your stage. Discover free-entry Free Fire MAX, BGMI and COD Mobile tournaments, build your team, and earn your place in India's independent esports community.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
