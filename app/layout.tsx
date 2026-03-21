import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Slackoff Command Center",
  description: "Slackoff front-end shell for triage and human approval on top of a local OpenClaw gateway.",
};

import { I18nProvider } from "@/lib/i18n/context";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={spaceGrotesk.variable}>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
