import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "AI 사무 자동화 | Office AI Assistant",
  description: "AI를 이용한 로컬 사무 자동화 홈페이지 - 업무보고, 회의록, 보고서, 이메일 작성을 AI로 빠르고 간편하게",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="bg-white border-t border-gray-200 py-4 text-center text-sm text-gray-500">
          © 2024 AI 사무 자동화. Powered by OpenAI.
        </footer>
      </body>
    </html>
  );
}
