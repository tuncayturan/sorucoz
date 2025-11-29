import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppStatusForCoach } from "@/lib/whatsapp";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Tüm coach'ların WhatsApp durumlarını döndürür
 * GET /api/whatsapp/status-all
 */
export async function GET() {
  try {
    // Tüm coach'ları al
    const coachesQuery = query(
      collection(db, "users"),
      where("role", "==", "coach")
    );
    const coachesSnapshot = await getDocs(coachesQuery);

    const coachesStatus = [];

    for (const coachDoc of coachesSnapshot.docs) {
      const coachId = coachDoc.id;
      const coachData = coachDoc.data();
      const status = await getWhatsAppStatusForCoach(coachId);

      coachesStatus.push({
        id: coachId,
        name: coachData.name || "İsimsiz Coach",
        email: coachData.email || "",
        whatsappConnected: status.isReady,
        whatsappConnecting: status.isInitializing,
        hasQRCode: status.qrCode !== null,
        whatsappPhoneNumber: coachData.whatsappPhoneNumber || null,
        whatsappPushname: coachData.whatsappPushname || null,
        whatsappConnectedAt: coachData.whatsappConnectedAt || null,
        whatsappQRGeneratedAt: coachData.whatsappQRGeneratedAt || null,
        whatsappQRScannedAt: coachData.whatsappQRScannedAt || null,
        whatsappDisconnectedAt: coachData.whatsappDisconnectedAt || null,
        whatsappDisconnectReason: coachData.whatsappDisconnectReason || null,
        whatsappLastSeen: coachData.whatsappLastSeen || null,
      });
    }

    return NextResponse.json({
      success: true,
      coaches: coachesStatus,
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

