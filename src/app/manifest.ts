import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sobra",
    short_name: "Sobra",
    description: "Quanto entra, quanto sai e quanto sobra no mês.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7f6",
    theme_color: "#0b7a5e",
    lang: "pt-BR",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
