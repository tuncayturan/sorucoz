"use client";

import { useSiteSettings } from "@/hooks/useSiteSettings";

export default function StudentFooter() {
  const currentYear = new Date().getFullYear();
  const { settings } = useSiteSettings();

  // Footer metinlerini ayarlardan al, yoksa varsayılanları kullan
  const copyrightText = settings.footerCopyright || `© ${currentYear} SoruÇöz. Tüm hakları saklıdır.`;
  const descriptionText = settings.footerDescription || "AI destekli soru çözme platformu";

  return (
    <footer className="w-full bg-white border-t border-gray-200/60 py-8 px-4 mt-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center space-y-1">
          <p className="text-xs text-gray-500 text-center font-light tracking-wide">
            {copyrightText}
          </p>
          <p className="text-xs text-gray-400 text-center font-light">
            {descriptionText}
          </p>
        </div>
      </div>
    </footer>
  );
}

