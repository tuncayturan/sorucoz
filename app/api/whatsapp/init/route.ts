import { NextResponse } from "next/server";
import { initializeWhatsApp, getWhatsAppStatus } from "@/lib/whatsapp";

/**
 * WhatsApp client'ı başlatır ve QR kod gösterir
 * GET /api/whatsapp/init
 */
export async function GET() {
  try {
    const status = getWhatsAppStatus();
    
    // Eğer zaten hazırsa, durumu döndür
    if (status.isReady) {
      return NextResponse.json({
        success: true,
        message: "WhatsApp zaten bağlı",
        isReady: true,
      });
    }

    // Eğer başlatılıyorsa, bekle
    if (status.isInitializing) {
      return NextResponse.json({
        success: true,
        message: "WhatsApp bağlantısı kuruluyor...",
        isInitializing: true,
      });
    }

    // Başlat
    await initializeWhatsApp();

    return NextResponse.json({
      success: true,
      message: "WhatsApp başlatıldı. Terminal'de QR kodu görebilirsiniz.",
      isInitializing: true,
    });
  } catch (error: any) {
    console.error("WhatsApp başlatma hatası:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "WhatsApp başlatılamadı",
      },
      { status: 500 }
    );
  }
}

