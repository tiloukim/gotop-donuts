import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartHydration from "@/components/CartHydration";
import {
  STORE_NAME,
  STORE_ADDRESS,
  STORE_PHONE,
  STORE_LAT,
  STORE_LNG,
  STORE_HOURS,
} from "@/lib/constants";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.gotopdonuts.com"),
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
  title: "GoTop Donuts — Fresh Donuts & Breakfast in Tyler, TX",
  description:
    "Order fresh donuts, breakfast sandwiches, and drinks online for pickup or delivery from GoTop Donuts in Tyler, Texas.",
  keywords: ["donuts", "breakfast", "Tyler TX", "online ordering", "delivery"],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: STORE_NAME,
    title: "GoTop Donuts — Fresh Donuts & Breakfast in Tyler, TX",
    description:
      "Order fresh donuts, breakfast sandwiches, and drinks online for pickup or delivery from GoTop Donuts in Tyler, Texas.",
    images: [{ url: "/logo-header.png", alt: "GoTop Donuts logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "GoTop Donuts — Fresh Donuts & Breakfast in Tyler, TX",
    description:
      "Order fresh donuts, breakfast sandwiches, and drinks online for pickup or delivery from GoTop Donuts in Tyler, Texas.",
    images: ["/logo-header.png"],
  },
  alternates: {
    canonical: "/",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Bakery",
  name: STORE_NAME,
  url: "https://www.gotopdonuts.com",
  image: "https://www.gotopdonuts.com/logo-header.png",
  telephone: STORE_PHONE,
  address: {
    "@type": "PostalAddress",
    streetAddress: "7205 S Broadway Ave. #400",
    addressLocality: "Tyler",
    addressRegion: "TX",
    postalCode: "75703",
    addressCountry: "US",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: STORE_LAT,
    longitude: STORE_LNG,
  },
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ],
    opens: "04:30",
    closes: "12:30",
  },
  priceRange: "$",
  servesCuisine: ["Donuts", "Breakfast"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <CartHydration />
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
