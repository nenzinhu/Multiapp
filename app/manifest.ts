import type { MetadataRoute } from "next";

/** Installable icon for the phone home screen, using the brand palette. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Multiapp — seus apps em qualquer aparelho",
    short_name: "Multiapp",
    description:
      "Guarde links de webapps, organize por categoria e abra a mesma biblioteca em qualquer aparelho.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    lang: "pt-BR",
    background_color: "#16181c",
    theme_color: "#16181c",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
