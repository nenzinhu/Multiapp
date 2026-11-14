import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Multiapp — seus apps, no lugar certo",
  description:
    "Guarde links de webapps, organize por categoria e abra a mesma biblioteca em qualquer aparelho.",
  applicationName: "Multiapp",
  manifest: "/manifest.webmanifest",
  other: {
    // Marca lida pela extensão do Chrome: só uma página do Multiapp entrega o
    // envelope selado do cofre, e o script de conteúdo confere esta meta.
    "multiapp-vault": "1",
  },
  appleWebApp: {
    capable: true,
    title: "Multiapp",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#16181c",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
