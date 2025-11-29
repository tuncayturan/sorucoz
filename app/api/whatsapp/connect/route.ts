import { NextRequest, NextResponse } from "next/server";
import { initializeWhatsAppForCoach, getWhatsAppStatusForCoach } from "@/lib/whatsapp";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Coach için WhatsApp bağlantısını başlatır
 * GET /api/whatsapp/connect?coachId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const coachId = searchParams.get("coachId");

    if (!coachId) {
      return NextResponse.json(
        { error: "coachId gerekli" },
        { status: 400 }
      );
    }

    // Coach'un var olduğunu kontrol et
    const coachRef = doc(db, "users", coachId);
    const coachSnap = await getDoc(coachRef);

    if (!coachSnap.exists()) {
      return NextResponse.json(
        { error: "Coach bulunamadı" },
        { status: 404 }
      );
    }

    const coachData = coachSnap.data();
    if (coachData.role !== "coach") {
      return NextResponse.json(
        { error: "Bu kullanıcı coach değil" },
        { status: 403 }
      );
    }

    // Mevcut durumu kontrol et
    let status = await getWhatsAppStatusForCoach(coachId);
    
    console.log(`📊 Mevcut durum (Coach: ${coachId}):`, {
      isReady: status.isReady,
      isInitializing: status.isInitializing,
      hasQRCode: !!status.qrCode,
    });
    
    // Eğer zaten başlatılmışsa ve hazırsa, mevcut durumu döndür
    if (status.isReady) {
      console.log(`✅ Zaten bağlı (Coach: ${coachId})`);
      return NextResponse.json({
        success: true,
        isReady: status.isReady,
        isInitializing: status.isInitializing,
        qrCode: status.qrCode,
      });
    }

    // Eğer başlatılıyorsa, mevcut durumu döndür
    if (status.isInitializing) {
      console.log(`⏳ Zaten başlatılıyor (Coach: ${coachId})`);
      return NextResponse.json({
        success: true,
        isReady: status.isReady,
        isInitializing: status.isInitializing,
        qrCode: status.qrCode,
      });
    }

    // WhatsApp'ı başlat (async - hemen dön, QR kod sonra gelecek)
    console.log(`🚀 WhatsApp başlatılıyor (Coach: ${coachId})...`);
    
    try {
      // initializeWhatsAppForCoach'ı await etmeden çağır (async işlem)
      const initPromise = initializeWhatsAppForCoach(coachId);
      
      initPromise
        .then((result) => {
          console.log(`✅ WhatsApp başlatıldı (Coach: ${coachId}), QR kod: ${result.qrCode ? 'Var' : 'Yok'}`);
        })
        .catch(async (error) => {
          console.error(`❌ WhatsApp başlatma hatası (Coach: ${coachId}):`, error);
          console.error(`❌ Hata detayı:`, error?.stack || error?.message || error);
          // Hata durumunda durumu güncelle
          const errorStatus = await getWhatsAppStatusForCoach(coachId);
          console.log(`📊 Hata sonrası durum (Coach: ${coachId}):`, errorStatus);
        });
      
      // Başlatma işlemi başladı, durumu tekrar kontrol et
      status = await getWhatsAppStatusForCoach(coachId);
      console.log(`📊 Başlatma sonrası durum (Coach: ${coachId}):`, {
        isReady: status.isReady,
        isInitializing: status.isInitializing,
        hasQRCode: !!status.qrCode,
      });
    } catch (error: any) {
      console.error(`❌ initializeWhatsAppForCoach çağrı hatası (Coach: ${coachId}):`, error);
      console.error(`❌ Hata detayı:`, error?.stack || error?.message || error);
      // Hata durumunda durumu kontrol et
      status = await getWhatsAppStatusForCoach(coachId);
    }

    return NextResponse.json({
      success: true,
      isReady: status.isReady,
      isInitializing: status.isInitializing,
      qrCode: status.qrCode,
    });
  } catch (error: any) {
    console.error("WhatsApp bağlantı hatası:", error);
    return NextResponse.json(
      {
        error: error.message || "WhatsApp bağlantısı kurulamadı",
      },
      { status: 500 }
    );
  }
}

/**
 * Coach için WhatsApp durumunu kontrol eder
 * GET /api/whatsapp/connect?coachId=xxx&status=true
 */
export async function POST(request: NextRequest) {
  try {
    const { coachId } = await request.json();

    if (!coachId) {
      return NextResponse.json(
        { error: "coachId gerekli" },
        { status: 400 }
      );
    }

    const status = await getWhatsAppStatusForCoach(coachId);

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error: any) {
    console.error("WhatsApp durum kontrolü hatası:", error);
    return NextResponse.json(
      {
        error: error.message || "Durum kontrol edilemedi",
      },
      { status: 500 }
    );
  }
}

