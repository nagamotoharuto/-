import type { Metadata } from "next";
import "./globals.css";
import ChatWidget from "@/components/features/ChatWidget";

export const metadata: Metadata = {
  title: "University Bakery | 事前予約",
  description: "大学内パン屋の事前予約アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
