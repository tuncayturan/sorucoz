import "./globals.css";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { Metadata } from "next";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SoruÇöz",
  description: "AI soru çözme",
  icons: {
    icon: [
      { url: "/api/site-assets/favicon", type: "image/x-icon" },
      { url: "/api/site-assets/icon", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/api/site-assets/icon", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
