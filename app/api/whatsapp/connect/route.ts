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

    // Firestore'dan bağlantı durumunu kontrol et
    const wasConnectedBefore = coachData.whatsappConnected && coachData.whatsappConnectedAt;
    
    // Mevcut durumu kontrol et
    let status = await getWhatsAppStatusForCoach(coachId);
    
    console.log(`📊 Mevcut durum (Coach: ${coachId}):`, {
      isReady: status.isReady,
      isInitializing: status.isInitializing,
      hasQRCode: !!status.qrCode,
      wasConnectedBefore: wasConnectedBefore,
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
      
      // Eğer 30 saniyeden fazla süredir QR kod gelmemişse, session'ı temizle
      if (!status.qrCode) {
        // Firestore'dan başlatma zamanını kontrol et
        const connectingStartTime = coachData.whatsappConnectingStartTime;
        
        if (connectingStartTime) {
          const startTime = connectingStartTime.toMillis ? connectingStartTime.toMillis() : connectingStartTime;
          const elapsed = Date.now() - startTime;
          const thirtySeconds = 30 * 1000;
          
          if (elapsed > thirtySeconds) {
            console.warn(`⚠️ Coach ${coachId} için 30 saniyeden fazla süredir QR kod bekleniyor. Session temizleniyor...`);
            
            // Session'ı temizle ve yeniden başlat
            try {
              const { clearWhatsAppSessionForCoach } = await import("@/lib/whatsapp");
              await clearWhatsAppSessionForCoach(coachId);
              
              // Firestore'u güncelle
              const { updateDoc } = await import("firebase/firestore");
              await updateDoc(coachRef, {
                whatsappConnecting: false,
                whatsappConnectingStartTime: null,
              });
              
              console.log(`✅ Coach ${coachId} için session temizlendi, yeniden başlatılabilir`);
              
              return NextResponse.json({
                success: true,
                isReady: false,
                isInitializing: false,
                qrCode: null,
                warning: "Session temizlendi, lütfen tekrar deneyin",
              });
            } catch (error) {
              console.error(`❌ Session temizleme hatası:`, error);
            }
          }
        }
      }
      
      return NextResponse.json({
        success: true,
        isReady: status.isReady,
        isInitializing: status.isInitializing,
        qrCode: status.qrCode,
      });
    }
    
    // Eğer daha önce bağlanmışsa otomatik bağlanmayı dene
    // Ama eğer Firestore'da bağlantı bilgileri yoksa, direkt QR kod göster
    if (wasConnectedBefore && !status.isReady && !status.isInitializing) {
      console.log(`🔄 Daha önce bağlanmış (Coach: ${coachId}), otomatik bağlanma deneniyor...`);
    } else if (!wasConnectedBefore) {
      console.log(`📱 Firestore'da bağlantı bilgileri yok (Coach: ${coachId}), QR kod gösterilecek...`);
    }

    // WhatsApp'ı başlat (async - hemen dön, QR kod sonra gelecek)
    console.log(`🚀 WhatsApp başlatılıyor (Coach: ${coachId})...`);
    
    // Serverless ortam kontrolü (Vercel, AWS Lambda, vb.)
    // Railway ve Render gibi ortamlar serverless değildir, bu yüzden çalışır
    const isServerless = (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.FUNCTION_TARGET) 
      && !process.env.RAILWAY_ENVIRONMENT 
      && !process.env.RENDER;
    
    if (isServerless) {
      console.warn(`⚠️ Serverless ortam tespit edildi (Coach: ${coachId}), WhatsApp bağlantısı desteklenmemektedir`);
      return NextResponse.json(
        {
          error: "WhatsApp bağlantısı serverless ortamda (Vercel) çalışmamaktadır. Bu özellik için ayrı bir sunucu (VPS, Railway, Render) gereklidir. WhatsApp Web.js Puppeteer gerektirir ve serverless ortamlarda çalışmaz.",
          isServerless: true,
        },
        { status: 503 }
      );
    }
    
    // Railway ortamı kontrolü
    if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) {
      console.log(`🚂 Railway ortamı tespit edildi (Coach: ${coachId}), WhatsApp bağlantısı desteklenmektedir`);
    }
    
    try {
      console.log(`🚀 initializeWhatsAppForCoach çağrılıyor (Coach: ${coachId})...`);
      
      // initializeWhatsAppForCoach'ı await etmeden çağır (async işlem)
      const initPromise = initializeWhatsAppForCoach(coachId);
      
      initPromise
        .then((result) => {
          console.log(`✅ WhatsApp başlatıldı (Coach: ${coachId}), QR kod: ${result.qrCode ? 'Var (' + result.qrCode.length + ' karakter)' : 'Yok'}`);
          if (result.qrCode) {
            console.log(`✅ QR kod preview: ${result.qrCode.substring(0, 50)}...`);
          }
        })
        .catch(async (error) => {
          console.error(`❌ WhatsApp başlatma hatası (Coach: ${coachId}):`, error);
          console.error(`❌ Hata detayı:`, error?.stack || error?.message || error);
          console.error(`❌ Hata name:`, error?.name);
          console.error(`❌ Hata code:`, error?.code);
          
          // Puppeteer hatası kontrolü
          const errorMessage = error?.message || String(error);
          if (errorMessage.includes("Puppeteer") || errorMessage.includes("browser") || errorMessage.includes("headless")) {
            console.error(`❌ Puppeteer hatası tespit edildi - Railway ortamında Puppeteer çalışmıyor olabilir`);
          }
          
          // Hata durumunda durumu güncelle
          const errorStatus = await getWhatsAppStatusForCoach(coachId);
          console.log(`📊 Hata sonrası durum (Coach: ${coachId}):`, errorStatus);
        });
      
      // Başlatma işlemi başladı, durumu tekrar kontrol et
      // Biraz bekle ki QR kod event'i gelebilsin
      console.log(`⏳ 2 saniye bekleniyor ki QR kod event'i gelebilsin...`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 saniye bekle (daha uzun)
      status = await getWhatsAppStatusForCoach(coachId);
      console.log(`📊 Başlatma sonrası durum (Coach: ${coachId}):`, {
        isReady: status.isReady,
        isInitializing: status.isInitializing,
        hasQRCode: !!status.qrCode,
        qrCodeLength: status.qrCode ? status.qrCode.length : 0,
      });
      
      // Eğer hala QR kod yoksa, daha fazla bekle
      if (!status.qrCode && status.isInitializing) {
        console.log(`⏳ QR kod henüz gelmedi, 3 saniye daha bekleniyor...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        status = await getWhatsAppStatusForCoach(coachId);
        console.log(`📊 3 saniye sonra durum (Coach: ${coachId}):`, {
          isReady: status.isReady,
          isInitializing: status.isInitializing,
          hasQRCode: !!status.qrCode,
          qrCodeLength: status.qrCode ? status.qrCode.length : 0,
        });
      }
    } catch (error: any) {
      console.error(`❌ initializeWhatsAppForCoach çağrı hatası (Coach: ${coachId}):`, error);
      console.error(`❌ Hata detayı:`, error?.stack || error?.message || error);
      console.error(`❌ Hata name:`, error?.name);
      console.error(`❌ Hata code:`, error?.code);
      
      // Puppeteer veya serverless ile ilgili hata kontrolü
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes("Puppeteer") || errorMessage.includes("serverless") || errorMessage.includes("timeout") || errorMessage.includes("browser")) {
        console.error(`❌ Puppeteer/serverless hatası tespit edildi`);
        return NextResponse.json(
          {
            error: "WhatsApp bağlantısı serverless ortamda çalışmamaktadır. Bu özellik için ayrı bir sunucu gereklidir.",
            isServerless: true,
          },
          { status: 503 }
        );
      }
      
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

