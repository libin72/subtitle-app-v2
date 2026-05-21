import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KidNuz Studio",
  description: "KidNuz Creator Studio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-gray-50">
        {children}
      </body>
    </html>
  );
}