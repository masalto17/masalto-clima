import type { Metadata } from "next";
import "./globals.css";

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
      <body className="antialiased">{children}</body>
    </html>
  );
}
