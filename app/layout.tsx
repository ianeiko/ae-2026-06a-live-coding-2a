import Link from "next/link";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Voice",
  description: "Two voice agents built with the Vercel AI SDK",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="mx-auto flex w-full max-w-2xl gap-4 px-6 pt-4 text-muted-foreground text-sm">
          <Link className="hover:text-foreground" href="/">
            Realtime
          </Link>
          <Link className="hover:text-foreground" href="/turn-based">
            Turn-based
          </Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
