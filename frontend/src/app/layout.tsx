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
  metadataBase: new URL("https://getcrme.com"),
  applicationName: "CRMe",
  title: {
    default: "CRMe — ClientOS for relationship work",
    template: "%s — CRMe",
  },
  description: "An open-source CRM that finds relationship work in the background, prepares updates, and lets you approve what becomes true.",
  keywords: ["CRM", "client OS", "relationship management", "open source CRM", "AI CRM"],
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "CRMe — ClientOS for relationship work",
    description: "An open-source CRM that does the work, not one that creates it.",
    url: "/",
    siteName: "CRMe",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "CRMe — ClientOS for relationship work",
    description: "An open-source CRM that does the work, not one that creates it.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
