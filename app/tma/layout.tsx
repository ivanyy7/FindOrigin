import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "FindOrigin — поиск источников",
  description: "Введите текст или ссылку — найдём возможные источники",
};

export default function TmaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      {children}
    </>
  );
}
