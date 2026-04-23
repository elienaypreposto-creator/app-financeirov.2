import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FinControl",
  description: "Controle Financeiro Inteligente",
  robots: {
    notranslate: true,
  }
};

import { ControlProvider } from "@/contexts/ControlContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      translate="no"
      className="h-full antialiased"
    >
      <body className={`${outfit.className} min-h-full flex flex-col`}>
        <ControlProvider>
          {children}
        </ControlProvider>
      </body>
    </html>
  );
}
