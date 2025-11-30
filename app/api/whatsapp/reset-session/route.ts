import { NextRequest, NextResponse } from "next/server";
import { clearWhatsAppSessionForCoach } from "@/lib/whatsapp";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Coach için WhatsApp session'ını sıfırlar (tamamen temizler)
 * POST /api/whatsapp/reset-session
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

    // Session'ı temizle
    await clearWhatsAppSessionForCoach(coachId);

    // Firestore'da durumu güncelle
    await updateDoc(coachRef, {
      whatsappConnected: false,
      whatsappConnecting: false,
      whatsappQRCode: null,
      whatsappDisconnectedAt: serverTimestamp(),
      whatsappDisconnectReason: "session_reset",
      whatsappPhoneNumber: null,
      whatsappPushname: null,
      whatsappConnectedAt: null,
      whatsappQRGeneratedAt: null,
      whatsappQRScannedAt: null,
      whatsappLastSeen: null,
    });

    return NextResponse.json({
      success: true,
      message: "WhatsApp session'ı sıfırlandı. Yeni bağlantı kurabilirsiniz.",
    });
  } catch (error: any) {
    console.error("WhatsApp session reset hatası:", error);
    return NextResponse.json(
      {
        error: error.message || "Session sıfırlanamadı",
      },
      { status: 500 }
    );
  }
}

