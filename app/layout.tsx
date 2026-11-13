import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const montserrat = localFont({
  src: "./fonts/Montserrat.ttf",
  weight: "100 900",
  variable: "--font-montserrat",
});
const roboto = localFont({
  src: "./fonts/Roboto.ttf",
  weight: "100 900",
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "MasAlto Clima",
  description: "El clima del lugar, ahora y los próximos días.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Clima", statusBarStyle: "black-translucent" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR">
      <body className={`${montserrat.variable} ${roboto.variable} antialiased`}>{children}</body>
    </html>
  );
}
