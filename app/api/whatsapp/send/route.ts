import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { getAdminApp } from "@/lib/firebase/admin";
import { getFirestore } from "firebase-admin/firestore";

/**
 * WhatsApp mesajı gönderir (coach'a bildirim)
 * POST /api/whatsapp/send
 * Body: { userId: string (coach ID), message: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, message } = await request.json();

    if (!userId || !message) {
      return NextResponse.json(
        { error: "userId ve message gerekli" },
        { status: 400 }
      );
    }

    // Firebase Admin Firestore instance
    const adminApp = getAdminApp();
    const adminDb = getFirestore(adminApp);

    // Kullanıcının WhatsApp numarasını al
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json(
        { error: "Kullanıcı bulunamadı" },
        { status: 404 }
      );
    }

    const userData = userSnap.data();
    
    // Coach'un WhatsApp numarasını al (kendi numarası - bildirim için)
    const coachPhoneNumber = userData?.whatsappPhoneNumber;
    
    if (!coachPhoneNumber) {
      return NextResponse.json(
        { error: "Coach'un WhatsApp numarası kayıtlı değil. Lütfen WhatsApp Web bağlantısını yeniden kurun." },
        { status: 400 }
      );
    }

    // Mesajı coach'un kendi numarasına gönder (bildirim olarak)
    await sendWhatsAppMessage(userId, coachPhoneNumber, message);

    return NextResponse.json({
      success: true,
      message: "WhatsApp mesajı gönderildi",
    });
  } catch (error: any) {
    console.error("WhatsApp mesaj gönderme hatası:", error);
    return NextResponse.json(
      {
        error: error.message || "WhatsApp mesajı gönderilirken hata oluştu",
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}


