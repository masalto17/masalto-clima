import type { Metadata } from "next";
import { IBM_Plex_Mono, Nunito_Sans } from "next/font/google";
import "./globals.css";

// Tipografía de soporte de MasAlto: Nunito Sans para la interfaz, IBM Plex Mono para datos.
const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-nunito-sans",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "MasAlto Clima",
  description: "Centro de riesgo climático por evento del ecosistema MasAlto.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR">
      <body className={`${nunitoSans.variable} ${plexMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
