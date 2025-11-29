import { NextRequest, NextResponse } from "next/server";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * App icon'u dinamik olarak serve eder
 * GET /api/site-assets/icon
 */
export async function GET(request: NextRequest) {
  try {
    const settingsRef = doc(db, "siteSettings", "main");
    const snapshot = await getDoc(settingsRef);
    
    if (snapshot.exists()) {
      const settings = snapshot.data();
      const iconUrl = settings.icon;
      
      if (iconUrl) {
        // Cloudinary'den icon'u fetch et ve proxy'le
        const response = await fetch(iconUrl);
        if (response.ok) {
          const imageBuffer = await response.arrayBuffer();
          return new NextResponse(imageBuffer, {
            headers: {
              "Content-Type": response.headers.get("Content-Type") || "image/png",
              "Cache-Control": "public, max-age=3600, s-maxage=3600",
            },
          });
        }
      }
    }
    
    // Fallback: varsayılan icon
    return NextResponse.redirect(new URL("/img/logo.png", request.url));
  } catch (error) {
    console.error("Icon serve hatası:", error);
    return NextResponse.redirect(new URL("/img/logo.png", request.url));
  }
}

