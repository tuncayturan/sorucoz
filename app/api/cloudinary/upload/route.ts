import { NextRequest, NextResponse } from "next/server";
import { cloudinary, getCloudinaryCredentials } from "@/lib/cloudinary";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { cloud_name, api_key, api_secret } = getCloudinaryCredentials();
    if (!cloud_name || !api_key || !api_secret) {
      return NextResponse.json(
        {
          error:
            "Cloudinary yapılandırması eksik. Sunucuda NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, NEXT_PUBLIC_CLOUDINARY_API_KEY ve CLOUDINARY_API_SECRET tanımlı olmalı (CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY de kabul edilir).",
        },
        { status: 503 }
      );
    }

    cloudinary.config({ cloud_name, api_key, api_secret });

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Dosya tipi kontrolü - resim, PDF veya ses (bazı mobil tarayıcılarda type boş gelir)
    const lower = file.name.toLowerCase();
    const isPDF = file.type === "application/pdf" || lower.endsWith(".pdf");
    const isAudio =
      file.type.startsWith("audio/") ||
      !!lower.match(/\.(webm|mp4|mp3|ogg|wav|m4a|aac)$/);
    const isImageExt = /\.(jpe?g|png|gif|webp|heic|heif|bmp|svg)$/i.test(file.name);
    const isImage =
      file.type.startsWith("image/") || (isImageExt && !isPDF && !isAudio);

    if (!isImage && !isPDF && !isAudio) {
      return NextResponse.json({ error: "File must be an image, PDF, or audio file" }, { status: 400 });
    }

    // Dosya boyutu kontrolü - ses dosyaları için daha büyük limit
    const maxSize = isAudio ? 25 * 1024 * 1024 : 10 * 1024 * 1024; // Ses: 25MB, Diğer: 10MB
    if (file.size > maxSize) {
      const maxSizeMB = isAudio ? 25 : 10;
      return NextResponse.json({
        error: `File size must be less than ${maxSizeMB}MB`,
      }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // PDF için resource_type: "raw", resim için "image", ses için "video" (Cloudinary audio dosyalarını video olarak saklar)
    const resourceType = isPDF ? "raw" : isAudio ? "video" : "image";

    return new Promise<NextResponse>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: "sorucoz",
            resource_type: resourceType,
            // Signed upload için upload_preset kullanmıyoruz, API secret ile imzalı yükleme yapıyoruz
          },
          (error, result) => {
            if (error) {
              resolve(NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 }));
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
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
