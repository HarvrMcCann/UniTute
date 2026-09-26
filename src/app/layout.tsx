import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { BackgroundBlobs } from "@/components/ui/BackgroundBlobs";
import { MotionProvider } from "@/components/ui/MotionProvider";
import { getProfile } from "@/lib/supabase/server";
import { themeBootstrapScript } from "@/lib/theme";
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const profile = await getProfile();

  return (
    <html lang="en" data-theme={profile?.theme ?? "dark"} suppressHydrationWarning className={`${inter.variable} ${fraunces.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript(profile?.theme ?? null) }} />
      </head>
      <body className="min-h-dvh">
        <BackgroundBlobs />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
