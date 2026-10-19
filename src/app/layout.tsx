import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Sobra",
  description: "Controle simples do seu dinheiro: quanto entra, quanto sai e quanto sobra.",
  applicationName: "Sobra",
  appleWebApp: { capable: true, title: "Sobra", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#0b7a5e", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
