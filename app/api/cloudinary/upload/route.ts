import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Dosya boyutu kontrolü (10MB - PDF'ler için daha fazla alan)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File size must be less than 10MB" }, { status: 400 });
    }

    // Dosya tipi kontrolü - resim veya PDF
    const isImage = file.type.startsWith("image/");
    const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    
    if (!isImage && !isPDF) {
      return NextResponse.json({ error: "File must be an image or PDF" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // PDF için resource_type: "raw", resim için "image"
    const resourceType = isPDF ? "raw" : "image";

    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: "sorucoz",
            resource_type: resourceType,
            // Signed upload için upload_preset kullanmıyoruz, API secret ile imzalı yükleme yapıyoruz
          },
          (error, result) => {
            if (error) {
              console.error("Cloudinary upload error:", error);
              reject(NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 }));
            } else {
              resolve(
                NextResponse.json({
                  url: result?.secure_url,
                  publicId: result?.public_id,
                })
              );
            }
          }
        )
        .end(buffer);
    });
  } catch (error: any) {
    console.error("Upload route error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

