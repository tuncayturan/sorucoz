import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppStatusForCoach } from "@/lib/whatsapp";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Helper function: Firestore Timestamp'i Date'e çevir
function convertTimestamp(timestamp: any): Date | null {
  if (!timestamp) return null;
  
  // Eğer zaten bir Date ise
  if (timestamp instanceof Date) {
    return timestamp;
  }
  
  // Eğer Firestore Timestamp ise
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  
  // Eğer Timestamp objesi ise (server-side'da serialize edilmiş)
  if (timestamp && timestamp.seconds) {
    return new Date(timestamp.seconds * 1000);
  }
  
  // Eğer string ise
  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }
  
  // Eğer number ise (milliseconds)
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }
  
  return null;
}

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

      // Timestamp'leri Date'e çevir
      const connectedAt = convertTimestamp(coachData.whatsappConnectedAt);
      const qrGeneratedAt = convertTimestamp(coachData.whatsappQRGeneratedAt);
      const qrScannedAt = convertTimestamp(coachData.whatsappQRScannedAt);
      const disconnectedAt = convertTimestamp(coachData.whatsappDisconnectedAt);
      const lastSeen = convertTimestamp(coachData.whatsappLastSeen);

      coachesStatus.push({
        id: coachId,
        name: coachData.name || "İsimsiz Coach",
        email: coachData.email || "",
        whatsappConnected: status.isReady,
        whatsappConnecting: status.isInitializing,
        hasQRCode: status.qrCode !== null,
        whatsappPhoneNumber: coachData.whatsappPhoneNumber || null,
        whatsappPushname: coachData.whatsappPushname || null,
        whatsappConnectedAt: connectedAt ? connectedAt.toISOString() : null,
        whatsappQRGeneratedAt: qrGeneratedAt ? qrGeneratedAt.toISOString() : null,
        whatsappQRScannedAt: qrScannedAt ? qrScannedAt.toISOString() : null,
        whatsappDisconnectedAt: disconnectedAt ? disconnectedAt.toISOString() : null,
        whatsappDisconnectReason: coachData.whatsappDisconnectReason || null,
        whatsappLastSeen: lastSeen ? lastSeen.toISOString() : null,
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

