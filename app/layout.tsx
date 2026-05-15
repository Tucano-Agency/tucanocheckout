import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tucano Checkout",
  description: "Checkout transparente premium para infoprodutores",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
