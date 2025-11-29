import { NextRequest, NextResponse } from "next/server";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Favicon'u dinamik olarak serve eder
 * GET /api/site-assets/favicon
 */
export async function GET(request: NextRequest) {
  try {
    const settingsRef = doc(db, "siteSettings", "main");
    const snapshot = await getDoc(settingsRef);
    
    if (snapshot.exists()) {
      const settings = snapshot.data();
      const faviconUrl = settings.favicon;
      
      if (faviconUrl) {
        // Cloudinary'den favicon'u fetch et ve proxy'le
        const response = await fetch(faviconUrl);
        if (response.ok) {
          const imageBuffer = await response.arrayBuffer();
          return new NextResponse(imageBuffer, {
            headers: {
              "Content-Type": response.headers.get("Content-Type") || "image/x-icon",
              "Cache-Control": "public, max-age=3600, s-maxage=3600",
            },
          });
        }
      }
    }
    
    // Fallback: varsayılan favicon
    return NextResponse.redirect(new URL("/favicon.ico", request.url));
  } catch (error) {
    console.error("Favicon serve hatası:", error);
    return NextResponse.redirect(new URL("/favicon.ico", request.url));
  }
}

