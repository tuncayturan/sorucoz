"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const { settings, loading } = useSiteSettings();

  // Use site settings logo, fallback to default
  const logoUrl = settings.logo || "/img/splash.png";

  // Wait for settings to load before showing logo
  useEffect(() => {
    if (!loading) {
      // Settings loaded, now wait for logo to load
      const img = new window.Image();
      img.onload = () => {
        setLogoLoaded(true);
      };
      img.onerror = () => {
        // If logo fails to load, use fallback
        setLogoLoaded(true);
      };
      img.src = logoUrl;
    }
  }, [loading, logoUrl]);

  // Fade-out animation - wait for logo to load first
  useEffect(() => {
    if (logoLoaded && !loading) {
      const t = setTimeout(() => {
        setVisible(false);
      }, 1000); // 1s görünür

      return () => clearTimeout(t);
    }
  }, [logoLoaded, loading]);

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-white transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ zIndex: 9999 }}
    >
      {logoLoaded && !loading ? (
        <Image
          src={logoUrl}
          alt="Splash"
          width={200}
          height={200}
          priority
          className="opacity-100"
        />
      ) : (
        <div className="w-16 h-16 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
      )}
    </div>
  );
}
