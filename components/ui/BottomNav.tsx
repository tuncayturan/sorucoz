"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();

  const nav = [
    { href: "/home", label: "Home" },
    { href: "/soru", label: "Soru Sor" },
    { href: "/coach/chat", label: "Koç" },
    { href: "/ayarlar", label: "Ayarlar" },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 flex justify-around py-3 shadow-sm">
      {nav.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={`text-sm ${
            pathname === i.href ? "font-bold" : "text-gray-500"
          }`}
        >
          {i.label}
        </Link>
      ))}
    </div>
  );
}
