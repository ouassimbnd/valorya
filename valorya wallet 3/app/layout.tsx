import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/app-shell";
import "./globals.css";
import "./app.css";
export const metadata: Metadata = { title: { default: "Valorya — La fidélité qui fait revenir", template: "%s | Valorya" }, description: "Une expérience de fidélité simple et sans application à télécharger." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#102D46" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="fr"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/></head><body><AppShell>{children}</AppShell></body></html>; }
