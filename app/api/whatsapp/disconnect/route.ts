import { NextRequest, NextResponse } from "next/server";
import { disconnectWhatsAppForCoach } from "@/lib/whatsapp";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Coach için WhatsApp bağlantısını keser
 * POST /api/whatsapp/disconnect
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

    // WhatsApp bağlantısını kes
    disconnectWhatsAppForCoach(coachId);

    // Firestore'da durumu güncelle
    await updateDoc(coachRef, {
      whatsappDisconnectedAt: serverTimestamp(),
      whatsappDisconnectReason: "user_disconnect",
    });

    return NextResponse.json({
      success: true,
      message: "WhatsApp bağlantısı kesildi",
    });
  } catch (error: any) {
    console.error("WhatsApp disconnect hatası:", error);
    return NextResponse.json(
      {
        error: error.message || "WhatsApp bağlantısı kesilemedi",
      },
      { status: 500 }
    );
  }
}

