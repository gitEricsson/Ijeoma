import type { Metadata, Viewport } from "next";
import { Anybody, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

// "Rally livery": Anybody set wide, heavy and italic, like rally-car decals,
// with Schibsted Grotesk for everything you read.
// Only the italic cut: nothing sets Anybody upright, so the roman file was dead weight.
const display = Anybody({ variable: "--font-anybody", subsets: ["latin"], style: ["italic"], axes: ["wdth"] });
const body = Schibsted_Grotesk({ variable: "--font-schibsted", subsets: ["latin"] });

export const metadata: Metadata = {
  // Netlify sets URL to the site's primary address at build time.
  metadataBase: new URL(process.env.URL ?? "http://localhost:3000"),
  title: "Spydey Tracker",
  description:
    "Follow Michael Spyder and IJEOMA, his orange Mercedes ML350, on a drive through all 54 African countries to raise $1,000,000 for cancer awareness.",
  openGraph: {
    title: "Spydey Tracker",
    description: "Michael Spyder is driving IJEOMA through every African country to raise $1,000,000 for cancer awareness.",
    images: ["/spyder.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#151311",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
