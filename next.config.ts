import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // React Compiler geçici olarak devre dışı - Railway build sorununu çözmek için
  reactCompiler: false,
  // Server-side packages - whatsapp-web.js, puppeteer ve iyzipay sadece server-side'da çalışır
  serverExternalPackages: ["whatsapp-web.js", "qrcode-terminal", "puppeteer", "puppeteer-core", "iyzipay"],
  // Eski WebView uyumluluğu için - Chrome 80+ desteği
  // browserslist ile otomatik transpile edilir
  compiler: {
    // Modern JavaScript syntax'ını eski syntax'a çevir
    removeConsole: false,
  },
  // SWC compiler ayarları - eski browser desteği için
  // Next.js 16'da SWC zaten browserslist'i okuyor
  // Ancak daha agresif transpilation için experimental ayarlar
  // Eski WebView'ler için dependency'leri transpile et
  transpilePackages: ['firebase', '@capacitor/core', '@capacitor/android', 'react', 'react-dom'],
  experimental: {
    // optimizePackageImports yerine transpilePackages kullanıyoruz
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh4.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh5.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh6.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
