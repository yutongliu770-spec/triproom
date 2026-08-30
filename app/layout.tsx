import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TripRoom",
  description: "多人旅行探索助手 MVP"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
