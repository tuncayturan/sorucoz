import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Turbopack config - whatsapp-web.js ve puppeteer sadece server-side'da çalışır
  serverExternalPackages: ["whatsapp-web.js", "qrcode-terminal", "puppeteer", "puppeteer-core"],
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
