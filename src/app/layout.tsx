import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";

// Body copy. andrewcyuan.com (the style reference) sets its text in ABC
// Social, a paid typeface, so this is the closest free grotesque; it's a
// variable font, so the light 350 weight used below is real, not rounded.
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stanley Wan — Portfolio",
  description: "Product design & content strategy portfolio.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${hanken.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
