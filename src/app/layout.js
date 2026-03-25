import "./globals.css";

export const metadata = {
  title: "MapExplorer — Interactive Maps",
  description: "Explore the world with an interactive map. Search places, get directions, and navigate — all for free.",
  openGraph: {
    title: "MapExplorer — Interactive Maps",
    description: "Explore the world with an interactive map. Search places, get directions, and navigate — all for free.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MapExplorer",
    description: "Explore the world with an interactive map.",
  },
  icons: {
    icon: [
      {
        url: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%234285f4"/><path d="M50 20 C30 20 15 35 15 50 C15 70 50 90 50 90 C50 90 85 70 85 50 C85 35 70 20 50 20 Z" fill="white"/><circle cx="50" cy="45" r="10" fill="%234285f4"/></svg>',
        type: 'image/svg+xml',
      }
    ],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MapExplorer',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning={true}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://nominatim.openstreetmap.org" />
        <link rel="preconnect" href="https://en.wikipedia.org" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  );
}
