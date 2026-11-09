import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Multiapp — seus apps, no lugar certo",
  description:
    "Guarde links de webapps, organize por categoria e tenha seus favoritos sempre à mão.",
  icons: {
    icon: "/multiapp.svg",
    shortcut: "/multiapp.svg",
  },
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
