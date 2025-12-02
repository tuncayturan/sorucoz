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

    const allTokens: string[] = [];
    let notifiedUsers = 0;

    console.log(`[Send Notification to Students] Found ${studentSnapshot.docs.length} student(s)`);

    for (const studentDoc of studentSnapshot.docs) {
      const studentData = studentDoc.data();
      const studentId = studentDoc.id;
      const fcmTokens = studentData?.fcmTokens || [];

      console.log(
        `[Send Notification to Students] Student: ${studentId}, FCM Tokens: ${fcmTokens.length}`
      );

      // Firestore'a bildirim kaydet (Admin SDK)
      const bildirimlerRef = adminDb.collection("users").doc(studentId).collection("bildirimler");
      await bildirimlerRef.add({
        title,
        body,
        data: data || {},
        read: false,
        createdAt: Timestamp.now(),
        type: data?.type || "general",
      });

      // FCM push bildirimi için token'ları topla
      if (fcmTokens.length > 0) {
        allTokens.push(...fcmTokens);
        notifiedUsers++;
      }
    }

    // Firebase Admin SDK ile push bildirimi gönder
    if (allTokens.length > 0) {
      console.log(
        `[Send Notification to Students] Sending push notification to ${allTokens.length} token(s)`
      );

      // FCM data değerleri string olmalı
      const fcmData: Record<string, string> = {};
      if (data) {
        Object.keys(data).forEach((key) => {
          fcmData[key] = String(data[key]);
        });
      }
      
      // Add unique message ID to prevent duplicates (broadcast notification)
      const notificationType = data?.type || 'general';
      fcmData.messageId = `broadcast-${notificationType}-${Date.now()}`;

      try {
        await sendPushNotification(allTokens, title, body, fcmData, logoUrl, soundUrl);
        console.log(`[Send Notification to Students] Push notification sent successfully with logo: ${logoUrl || 'default'}, sound: ${soundUrl || 'default'}`);
      } catch (pushError) {
        console.error(
          `[Send Notification to Students] Error sending push notification:`,
          pushError
        );
      }
    } else {
      console.warn(
        `[Send Notification to Students] No FCM tokens found for any student`
      );
    }

    return NextResponse.json({
      success: true,
      message: "Bildirim gönderildi",
      notifiedUsers,
      tokensSent: allTokens.length,
    });
  } catch (error: any) {
    console.error("Student notification send error:", error);
    return NextResponse.json(
      { error: error.message || "Bildirim gönderilirken hata oluştu" },
      { status: 500 }
    );
  }
}


