import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Dock } from "@/components/dock";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ThemeProvider } from "@/components/theme-provider";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sky Hub",
  description: "Airline Operations Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geist.className} suppressHydrationWarning>
      <body className="flex flex-col h-screen bg-hz-bg text-hz-text">
        <ThemeProvider>
          <Breadcrumbs />
          <main className="flex-1 overflow-y-auto pb-20">{children}</main>
          <Dock />
        </ThemeProvider>
      </body>
    </html>
  );
}
