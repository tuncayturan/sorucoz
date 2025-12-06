import { NextRequest, NextResponse } from "next/server";
import { sendPushNotification, getAdminApp } from "@/lib/firebase/admin";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// Tüm öğrencilere push notification gönderme
export async function POST(request: NextRequest) {
  try {
    const { title, body, data } = await request.json();

    if (!title || !body) {
      return NextResponse.json(
        { error: "title ve body gerekli" },
        { status: 400 }
      );
    }

    // Firebase Admin Firestore instance
    const adminApp = getAdminApp();
    const adminDb = getFirestore(adminApp);

    // Site ayarlarından logo ve ses URL'sini al
    let logoUrl: string | undefined;
    let soundUrl: string | undefined;
    try {
      const settingsRef = adminDb.collection("siteSettings").doc("main");
      const settingsSnap = await settingsRef.get();
      if (settingsSnap.exists) {
        const settingsData = settingsSnap.data();
        logoUrl = settingsData?.logo || settingsData?.icon;
        soundUrl = settingsData?.notificationSound;
      }
    } catch (error) {
      console.warn("[Send Notification to Students] Ayarlar alınamadı:", error);
    }

    // Tüm öğrenci kullanıcıları bul
    const usersRef = adminDb.collection("users");
    const studentSnapshot = await usersRef.where("role", "==", "student").get();

    const timestamp = Math.floor(Date.now() / 5000) * 5000; // 5 saniyelik aralıklar - tüm bildirimlerde aynı
    const notificationType = data?.type || 'general';

    console.log(`[Send Notification to Students] Found ${studentSnapshot.docs.length} student(s)`);

    // Her öğrenciye ayrı bildirim gönder (her öğrenci için unique messageId)
    const sendPromises: Promise<void>[] = [];
    let totalTokensSent = 0;
    let notifiedUsers = 0;

    for (const studentDoc of studentSnapshot.docs) {
      const studentData = studentDoc.data();
      const studentId = studentDoc.id;
      const fcmTokens: string[] = (studentData?.fcmTokens as string[]) || [];

      if (fcmTokens.length === 0) continue;

      console.log(
        `[Send Notification to Students] Student: ${studentId}, FCM Tokens: ${fcmTokens.length}`
      );

      // Firestore'a bildirim kaydet (Admin SDK)
      const bildirimlerRef = adminDb.collection("users").doc(studentId).collection("bildirimler");
      bildirimlerRef.add({
        title,
        body,
        data: data || {},
        read: false,
        createdAt: Timestamp.now(),
        type: notificationType,
      }).catch(err => console.error(`[Send Notification to Students] Error saving notification for ${studentId}:`, err));

      // Her öğrenci için unique messageId - service worker deduplication için
      const fcmData: Record<string, string> = {};
      if (data) {
        Object.keys(data).forEach((key) => {
          fcmData[key] = String(data[key]);
        });
      }
      
      // CRITICAL: Her öğrenci için unique messageId (userId dahil)
      // Bu sayede her kullanıcının cihazları arasında deduplication çalışır
      fcmData.messageId = `broadcast-${studentId}-${notificationType}-${timestamp}`;

      // Token deduplication
      const uniqueTokens = [...new Set(fcmTokens)];
      
      // Her öğrenciye ayrı bildirim gönder (paralel)
      const sendPromise = sendPushNotification(uniqueTokens, title, body, fcmData, logoUrl, soundUrl)
        .then(() => {
          totalTokensSent += uniqueTokens.length;
          notifiedUsers++;
        })
        .catch(err => {
          console.error(`[Send Notification to Students] Error sending to ${studentId}:`, err);
        });
      
      sendPromises.push(sendPromise);
    }

    // Tüm bildirimleri paralel gönder
    if (sendPromises.length > 0) {
      console.log(`[Send Notification to Students] Sending ${sendPromises.length} notification(s) in parallel...`);
      await Promise.all(sendPromises);
      console.log(`[Send Notification to Students] ✅ All notifications sent`);

    } else {
      console.warn(
        `[Send Notification to Students] No FCM tokens found for any student`
      );
    }

    return NextResponse.json({
      success: true,
      message: "Bildirim gönderildi",
      notifiedUsers,
      tokensSent: totalTokensSent,
    });
  } catch (error: any) {
    console.error("Student notification send error:", error);
    return NextResponse.json(
      { error: error.message || "Bildirim gönderilirken hata oluştu" },
      { status: 500 }
    );
  }
}


