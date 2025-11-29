import { NextRequest, NextResponse } from "next/server";
import { doc, getDoc, collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { sendPushNotification } from "@/lib/firebase/admin";

// FCM Admin SDK kullanarak bildirim gönderme
export async function POST(request: NextRequest) {
  try {
    const { userId, title, body, data } = await request.json();

    if (!userId || !title || !body) {
      return NextResponse.json(
        { error: "userId, title ve body gerekli" },
        { status: 400 }
      );
    }

    // Kullanıcının FCM token'larını al
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    const userData = userSnap.data();
    const fcmTokens = userData.fcmTokens || [];

    console.log(`[Send Notification] User: ${userId}, FCM Tokens: ${fcmTokens.length}`);

    // Firestore'a bildirim kaydet
    const bildirimlerRef = collection(db, "users", userId, "bildirimler");
    await addDoc(bildirimlerRef, {
      title,
      body,
      data: data || {},
      read: false,
      createdAt: Timestamp.now(),
      type: data?.type || "general",
    });

    // FCM push bildirimi gönder (token varsa)
    if (fcmTokens.length > 0) {
      console.log(`[Send Notification] Sending push notification to ${fcmTokens.length} token(s)`);
      
      // Convert data object to string format (FCM requires string values)
      const fcmData: Record<string, string> = {};
      if (data) {
        Object.keys(data).forEach((key) => {
          fcmData[key] = String(data[key]);
        });
      }

      // Send push notification using Firebase Admin SDK
      try {
        console.log(`[Send Notification] Calling sendPushNotification with ${fcmTokens.length} token(s)`);
        console.log(`[Send Notification] Title: ${title}, Body: ${body}`);
        await sendPushNotification(fcmTokens, title, body, fcmData);
        console.log(`[Send Notification] Push notification sent successfully`);
      } catch (pushError) {
        console.error(`[Send Notification] Error sending push notification:`, pushError);
        console.error(`[Send Notification] Error details:`, JSON.stringify(pushError, null, 2));
      }
    } else {
      console.warn(`[Send Notification] No FCM tokens found for user ${userId}`);
    }

    return NextResponse.json({
      success: true,
      message: "Bildirim gönderildi",
      tokensSent: fcmTokens.length,
    });
  } catch (error: any) {
    console.error("Notification send error:", error);
    return NextResponse.json(
      { error: error.message || "Bildirim gönderilirken hata oluştu" },
      { status: 500 }
    );
  }
}

