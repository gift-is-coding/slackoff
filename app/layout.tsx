import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slackoff Command Center",
  description: "Slackoff front-end shell for triage and human approval on top of a local OpenClaw gateway.",
};

import { I18nProvider } from "@/lib/i18n/context";
import { ErrorBoundary } from "@/components/error-boundary";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <I18nProvider>{children}</I18nProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
