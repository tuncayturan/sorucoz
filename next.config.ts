import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // React Compiler geçici olarak devre dışı - Railway build sorununu çözmek için
  reactCompiler: false,
  // Server-side packages - whatsapp-web.js, puppeteer ve iyzipay sadece server-side'da çalışır
  serverExternalPackages: ["whatsapp-web.js", "qrcode-terminal", "puppeteer", "puppeteer-core", "iyzipay"],
  // Eski browser uyumluluğu için - Chrome 83+ desteği
  // SWC compiler eski syntax'ı transpile etsin
  swcMinify: true,
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
