import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
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
      <body className="flex h-screen bg-hz-bg text-hz-text">
        <ThemeProvider>
          <Sidebar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
