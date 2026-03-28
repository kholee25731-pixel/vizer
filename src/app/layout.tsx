import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { SidebarNav } from "../components/SidebarNav";
import { AppProviders } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vizer",
  description: "Vizer - 피드백 복리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AppProviders>
          <div className="flex min-h-screen bg-zinc-50 text-zinc-950">
            <aside className="fixed left-0 top-0 z-30 flex h-screen w-64 flex-col overflow-y-auto border-r border-zinc-200 bg-sky-50">
              <div className="flex h-16 shrink-0 items-center px-6">
                <Link
                  href="/dashboard"
                  className="text-sm font-semibold tracking-wide text-zinc-900"
                >
                  Vizer
                </Link>
              </div>
              <SidebarNav />
              <div className="mt-auto shrink-0 border-t border-sky-100 px-3 py-3">
                <Link
                  href="/trash"
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-zinc-500 hover:bg-sky-100 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4 text-sky-500" />
                  <span>Trash</span>
                </Link>
              </div>
            </aside>
            <main className="ml-64 flex-1 min-h-screen">
              <div className="mx-auto w-full max-w-7xl p-6 md:p-10">
                {children}
              </div>
            </main>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}

