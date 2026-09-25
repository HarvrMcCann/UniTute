import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { BackgroundBlobs } from "@/components/ui/BackgroundBlobs";
import { MotionProvider } from "@/components/ui/MotionProvider";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["SOFT", "opsz"] });

export const metadata: Metadata = {
  title: "UniTute",
  description: "Turn your lecture slides into an interactive course with knowledge checks and an AI tutor.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e1320" },
    { media: "(prefers-color-scheme: light)", color: "#f6f4ef" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${inter.variable} ${fraunces.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <BackgroundBlobs />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
