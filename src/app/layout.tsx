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
  metadataBase: new URL('https://anagramle.vercel.app'),
  title: "Anagramle - Wordle meets Scrabble | Free Word Puzzle Game",
  description: "Play Anagramle, the ultimate word puzzle game combining Wordle's gameplay with Scrabble scoring. Guess words, earn points with multipliers, and master the daily word challenge. Free to play!",
  keywords: [
    // English keywords
    "anagramle",
    "wordle",
    "scrabble",
    "word game",
    "word puzzle",
    "daily word game",
    "word challenge",
    "free word game",
    "online word game",
    "vocabulary game",
    "brain game",
    "puzzle game",
    "wordle alternative",
    "scrabble online",
    "word guessing game",
    "letter game",
    "spelling game",
    "educational game",
    "wordle scrabble",
    "word score game",
    "NASPA Word List",
    "TWL06",
    "Collins Scrabble Words",
    "SOWPODS",
    "CSW",
    "scrabble dictionary",
    // Spanish keywords
    "juego de palabras",
    "wordle español",
    "scrabble español",
    "juego de palabras gratis",
    "juego de vocabulario",
    "adivinanzas de palabras",
    "juego educativo",
    "juego mental",
    "rompecabezas de palabras",
    "scrabble online gratis",
    "wordle en español",
    "juego de letras",
    "deletreo",
    "pasatiempos",
    "juegos de palabras diarios",
    "DRAE",
    "RAE",
    "diccionario español",
    "FISE",
  ],
  authors: [{ name: "Anagramle" }],
  creator: "Anagramle",
  publisher: "Anagramle",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://anagramle.vercel.app',
    languages: {
      'en-US': 'https://anagramle.vercel.app',
      'en-GB': 'https://anagramle.vercel.app',
      'es-ES': 'https://anagramle.vercel.app',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['es_ES', 'es_MX', 'es_AR'],
    url: 'https://anagramle.vercel.app',
    title: 'Anagramle - Wordle meets Scrabble | Juego de Palabras',
    description: 'Play the ultimate word puzzle game combining Wordle gameplay with Scrabble scoring. ¡Juega el mejor juego de palabras que combina Wordle con puntuación de Scrabble!',
    siteName: 'Anagramle',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'Anagramle - Wordle meets Scrabble',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Anagramle - Wordle meets Scrabble',
    description: 'Play the ultimate word puzzle game combining Wordle gameplay with Scrabble scoring. Free to play!',
    images: ['/og-image.svg'],
    creator: '@anagramle',
  },
  verification: {
    google: 'your-google-verification-code',
  },
  category: 'game',
  applicationName: 'Anagramle',
  appleWebApp: {
    capable: true,
    title: 'Anagramle',
    statusBarStyle: 'black-translucent',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1e1e1e" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
