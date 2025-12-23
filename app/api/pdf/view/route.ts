import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
    }

    // Cloudinary URL'ini doğrula
    if (!url.includes("cloudinary.com")) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // PDF dosyasını Cloudinary'den al
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch PDF" }, { status: 500 });
    }

    const pdfBuffer = await response.arrayBuffer();

    // PDF'i Content-Type: application/pdf ile döndür
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=document.pdf",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: any) {    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

