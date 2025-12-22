import { NextRequest, NextResponse } from "next/server";
import { sendPushNotification, getAdminApp } from "@/lib/firebase/admin";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// Request deduplication - prevent duplicate API calls within short time
const recentRequests = new Map<string, number>();
const REQUEST_TIMEOUT = 2000; // 2 saniye içinde aynı request'i tekrar işleme

// Admin'lere push notification gönderme
export async function POST(request: NextRequest) {
  try {
    const { title, body, data } = await request.json();

    if (!title || !body) {
      return NextResponse.json(
        { error: "title ve body gerekli" },
        { status: 400 }
      );
    }

    // Request deduplication - aynı request kısa sürede tekrar gelirse engelle
    const requestKey = `${title}-${body}-${JSON.stringify(data)}`;
    const lastRequestTime = recentRequests.get(requestKey);
    const now = Date.now();
    
    if (lastRequestTime && (now - lastRequestTime) < REQUEST_TIMEOUT) {
      console.log('[Send Notification to Admin] ⚠️ Duplicate request prevented:', requestKey);
      return NextResponse.json({
        success: true,
        message: "Duplicate request prevented",
        notifiedUsers: 0,
        tokensSent: 0,
      });
    }
    
    // Mark this request as processed
    recentRequests.set(requestKey, now);
    
    // Clean up old entries after timeout
    setTimeout(() => {
      recentRequests.delete(requestKey);
    }, REQUEST_TIMEOUT);

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
      console.warn("[Send Notification to Admin] Ayarlar alınamadı:", error);
    }

    // Tüm admin ve coach kullanıcıları bul
    const usersRef = adminDb.collection("users");
    const [adminSnapshot, coachSnapshot] = await Promise.all([
      usersRef.where("role", "==", "admin").get(),
      usersRef.where("role", "==", "coach").get(),
    ]);

    // Duplicate önleme: Kullanıcı ID'lerini Set ile takip et
    const processedUserIds = new Set<string>();
    const allTokens: string[] = [];
    let notifiedUsers = 0;

    console.log(`[Send Notification to Admin/Coach] Found ${adminSnapshot.docs.length} admin(s) and ${coachSnapshot.docs.length} coach(es)`);

    // Process admins
    for (const adminDoc of adminSnapshot.docs) {
      const adminData = adminDoc.data();
      const adminId = adminDoc.id;
      
      // Bu kullanıcı zaten işlendiyse atla (duplicate önleme)
      if (processedUserIds.has(adminId)) {
        console.log(`[Send Notification to Admin/Coach] ⚠️ Duplicate user skipped: ${adminId}`);
        continue;
      }
      
      processedUserIds.add(adminId);
      const fcmTokens: string[] = (adminData?.fcmTokens as string[]) || [];

      console.log(`[Send Notification to Admin/Coach] Admin: ${adminId}, FCM Tokens: ${fcmTokens.length}`);

      // Firestore'a bildirim kaydet (Admin SDK)
      const bildirimlerRef = adminDb.collection("users").doc(adminId).collection("bildirimler");
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

    // Process coaches
    for (const coachDoc of coachSnapshot.docs) {
      const coachData = coachDoc.data();
      const coachId = coachDoc.id;
      
      // Bu kullanıcı zaten işlendiyse atla (duplicate önleme)
      if (processedUserIds.has(coachId)) {
        console.log(`[Send Notification to Admin/Coach] ⚠️ Duplicate user skipped: ${coachId}`);
        continue;
      }
      
      processedUserIds.add(coachId);
      const fcmTokens: string[] = (coachData?.fcmTokens as string[]) || [];

      console.log(`[Send Notification to Admin/Coach] Coach: ${coachId}, FCM Tokens: ${fcmTokens.length}`);

      // Firestore'a bildirim kaydet (Admin SDK)
      const bildirimlerRef = adminDb.collection("users").doc(coachId).collection("bildirimler");
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

    // Firebase Admin SDK ile bildirim gönder
    if (allTokens.length > 0) {
      console.log(`[Send Notification to Admin] Sending push notification to ${allTokens.length} token(s)`);
      
      // Convert data object to string format (FCM requires string values)
      const fcmData: Record<string, string> = {};
      if (data) {
        Object.keys(data).forEach((key) => {
          fcmData[key] = String(data[key]);
        });
      }

      // Add message ID for duplicate prevention
      // Round timestamp to 5-second intervals
      const notificationType = data?.type || 'general';
      const timestamp = Math.floor(Date.now() / 5000) * 5000; // 5 saniyelik aralıklar
      
      // Generate stable message ID for duplicate prevention
      if (data?.supportId) {
        fcmData.messageId = `${notificationType}-${data.supportId}-${timestamp}`;
        fcmData.supportId = data.supportId;
        if (data?.userId) {
          fcmData.userId = data.userId;
        }
      } else if (data?.conversationId) {
        fcmData.messageId = `${notificationType}-${data.conversationId}-${timestamp}`;
        fcmData.conversationId = data.conversationId;
      } else {
        fcmData.messageId = `${notificationType}-${timestamp}`;
      }

      // Send push notification to all admin tokens with logo and sound
      // Now supports both FCM (web) and Expo Push (mobile) tokens
      try {
        const pushResults = await sendPushNotification(allTokens, title, body, fcmData, logoUrl, soundUrl);
        console.log(`[Send Notification to Admin] ✅ Push notification sent: FCM ${pushResults.fcmSent}, Expo ${pushResults.expoSent}`);
        console.log(`[Send Notification to Admin] ⚠️ Failed: FCM ${pushResults.fcmFailed}, Expo ${pushResults.expoFailed}`);
      } catch (pushError) {
        console.error(`[Send Notification to Admin] Error sending push notification:`, pushError);
      }
    } else {
      console.warn(`[Send Notification to Admin] No FCM tokens found for any admin`);
    }

    return NextResponse.json({
      success: true,
      message: "Bildirim gönderildi",
      notifiedUsers,
      tokensSent: allTokens.length,
    });
  } catch (error: any) {
    console.error("Admin notification send error:", error);
    return NextResponse.json(
      { error: error.message || "Bildirim gönderilirken hata oluştu" },
      { status: 500 }
    );
  }
}

