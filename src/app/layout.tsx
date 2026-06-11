import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Z.Design - AI-Powered Visual Design Platform",
  description: "Create stunning designs, prototypes, and websites through conversation with AI. Powered by Z.ai.",
  keywords: ["Z.Design", "AI design", "visual design", "prototyping", "Next.js", "TypeScript"],
  authors: [{ name: "Z.ai Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Z.Design - AI-Powered Visual Design Platform",
    description: "Create stunning designs through conversation with AI",
    url: "https://chat.z.ai",
    siteName: "Z.Design",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Z.Design - AI-Powered Visual Design Platform",
    description: "Create stunning designs through conversation with AI",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
