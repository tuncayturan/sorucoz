import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import AddToHomeScreenPrompt from "@/components/AddToHomeScreenPrompt";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import type { Metadata, Viewport } from "next";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

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
      <body>
        <ServiceWorkerRegistration />
        <AuthProvider>
          {children}
          {/* <FCMTokenManager /> Mobil bildirim popup'ı kaldırıldı */}
          <AddToHomeScreenPrompt />
          <PWAInstallPrompt />
        </AuthProvider>
      </body>
    </html>
  );
}
