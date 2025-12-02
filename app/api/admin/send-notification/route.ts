import { NextRequest, NextResponse } from "next/server";
import { sendPushNotification } from "@/lib/firebase/admin";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAdminApp } from "@/lib/firebase/admin";

// Request deduplication - prevent duplicate API calls within short time
const recentRequests = new Map<string, number>();
const REQUEST_TIMEOUT = 2000; // 2 saniye içinde aynı request'i tekrar işleme

// FCM Admin SDK kullanarak bildirim gönderme
export async function POST(request: NextRequest) {
  console.log(`[Send Notification API] ========== NEW REQUEST ==========`);
  try {
    const { userId, title, body, data } = await request.json();
    console.log(`[Send Notification API] Parsed request:`, { userId, title, body, data });

    if (!userId || !title || !body) {
      return NextResponse.json(
        { error: "userId, title ve body gerekli" },
        { status: 400 }
      );
    }

    // Request deduplication - aynı request kısa sürede tekrar gelirse engelle
    const requestKey = `${userId}-${title}-${JSON.stringify(data?.conversationId || data?.supportId || 'none')}`;
    const lastRequestTime = recentRequests.get(requestKey);
    const now = Date.now();
    
    console.log(`[Send Notification] Request key: ${requestKey}`);
    console.log(`[Send Notification] Last request: ${lastRequestTime ? `${now - lastRequestTime}ms ago` : 'never'}`);
    
    if (lastRequestTime && (now - lastRequestTime) < REQUEST_TIMEOUT) {
      console.log(`[Send Notification] 🛑 DUPLICATE REQUEST PREVENTED (${now - lastRequestTime}ms ago)`);
      return NextResponse.json({
        success: false,
        message: "Duplicate request prevented",
        tokensSent: 0,
        duplicate: true,
      });
    }
    
    // Mark this request as processed
    recentRequests.set(requestKey, now);
    console.log(`[Send Notification] ✅ Request marked as processed`);
    
    // Clean up old entries after timeout
    setTimeout(() => {
      recentRequests.delete(requestKey);
      console.log(`[Send Notification] 🗑️ Request key cleaned up: ${requestKey}`);
    }, REQUEST_TIMEOUT);

    // Firebase Admin Firestore instance
    console.log(`[Send Notification API] Getting Admin App...`);
    const adminApp = getAdminApp();
    console.log(`[Send Notification API] Getting Firestore...`);
    const adminDb = getFirestore(adminApp);
    console.log(`[Send Notification API] ✅ Admin Firestore ready`);

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
      console.warn("[Send Notification] Ayarlar alınamadı:", error);
    }

    // Kullanıcının FCM token'larını al
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    const userData = userSnap.data();
    const fcmTokens = userData?.fcmTokens || [];

    console.log(`[Send Notification] ========== START ==========`);
    console.log(`[Send Notification] User: ${userId}, FCM Tokens: ${fcmTokens.length}`);
    console.log(`[Send Notification] Title: "${title}"`);
    console.log(`[Send Notification] Body: "${body}"`);
    console.log(`[Send Notification] Data:`, data);

    // Firestore'a bildirim kaydet (Admin SDK)
    const bildirimlerRef = adminDb.collection("users").doc(userId).collection("bildirimler");
    await bildirimlerRef.add({
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
      
      // Add unique message ID for each notification
      // Use timestamp to ensure each message creates a new notification
      const notificationType = data?.type || 'general';
      const timestamp = Date.now();
      
      // Generate unique but trackable message ID
      if (data?.conversationId) {
        fcmData.messageId = `${notificationType}-${data.conversationId}-${timestamp}`;
        fcmData.conversationId = data.conversationId; // Ensure conversationId is in data
      } else if (data?.supportId) {
        fcmData.messageId = `${notificationType}-${data.supportId}-${timestamp}`;
        fcmData.supportId = data.supportId;
      } else {
        fcmData.messageId = `${notificationType}-${userId}-${timestamp}`;
      }

      // Token deduplication at API level
      const uniqueFcmTokens = [...new Set(fcmTokens)];
      
      if (uniqueFcmTokens.length !== fcmTokens.length) {
        console.log(`[Send Notification] ⚠️ Removed ${fcmTokens.length - uniqueFcmTokens.length} duplicate token(s) for user ${userId}`);
      }

      // Send push notification using Firebase Admin SDK with logo and sound
      try {
        console.log(`[Send Notification] Calling sendPushNotification with ${uniqueFcmTokens.length} unique token(s)`);
        console.log(`[Send Notification] FCM Data:`, fcmData);
        await sendPushNotification(uniqueFcmTokens, title, body, fcmData, logoUrl, soundUrl);
        console.log(`[Send Notification] ✅ Push notification sent successfully`);
        console.log(`[Send Notification] ========== END ==========`);
      } catch (pushError) {
        console.error(`[Send Notification] ❌ Error sending push notification:`, pushError);
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
    console.error("========== NOTIFICATION SEND ERROR ==========");
    console.error("Error:", error);
    console.error("Error message:", error?.message);
    console.error("Error stack:", error?.stack);
    console.error("===========================================");
    return NextResponse.json(
      { 
        error: error.message || "Bildirim gönderilirken hata oluştu",
        details: error?.toString(),
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}

