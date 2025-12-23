import { NextRequest, NextResponse } from "next/server";
import { sendPushNotification } from "@/lib/firebase/admin";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAdminApp } from "@/lib/firebase/admin";

// Request deduplication - prevent duplicate API calls within short time
const recentRequests = new Map<string, number>();
const REQUEST_TIMEOUT = 30000; // 30 saniye içinde aynı request'i tekrar işleme (ULTRA AGGRESSIVE)

// FCM Admin SDK kullanarak bildirim gönderme
export async function POST(request: NextRequest) {  try {
    const { userId, title, body, data } = await request.json();    if (!userId || !title || !body) {
      return NextResponse.json(
        { error: "userId, title ve body gerekli" },
        { status: 400 }
      );
    }

    // Request deduplication - aynı request kısa sürede tekrar gelirse engelle
    // CRITICAL: 60 saniyelik window içinde aynı mesaj için duplicate engelle (artırıldı)
    // ULTRA AGGRESSIVE: receiverRole, conversationId ve body'yi de key'e ekle
    const timestamp = Math.floor(Date.now() / 60000) * 60000; // 60 saniyelik window (artırıldı)
    const receiverRole = data?.receiverRole || '';
    const conversationId = data?.conversationId || data?.supportId || 'none';
    const bodyHash = body.substring(0, 100); // İlk 100 karakter (daha fazla karakter)
    // CRITICAL: receiverRole, conversationId ve body'yi key'e ekle - aynı mesaj için aynı key
    const requestKey = `${userId}-${receiverRole}-${conversationId}-${bodyHash}-${timestamp}`;
    const lastRequestTime = recentRequests.get(requestKey);
    const now = Date.now();    if (lastRequestTime && (now - lastRequestTime) < REQUEST_TIMEOUT) {
      console.log(`[Send Notification] 🛑 DUPLICATE REQUEST PREVENTED (${now - lastRequestTime}ms ago)`);      return NextResponse.json({
        success: false,
        message: "Duplicate request prevented",
        tokensSent: 0,
        duplicate: true,
      });
    }
    
    // Mark this request as processed
    recentRequests.set(requestKey, now);    // Clean up old entries after timeout
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
    } catch (error) {    }

    // Kullanıcının FCM token'larını al
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    const userData = userSnap.data();
    let fcmTokens: string[] = (userData?.fcmTokens as string[]) || [];    // Firestore'a bildirim kaydet (Admin SDK)
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
    // CRITICAL FIX: Token deduplication - remove duplicate tokens
    const uniqueFcmTokens = [...new Set(fcmTokens)];
    let tokensSent = 0;
    
    if (uniqueFcmTokens.length !== fcmTokens.length) {
      console.log(`[Send Notification] ⚠️ Removed ${fcmTokens.length - uniqueFcmTokens.length} duplicate token(s) for user ${userId}`);
    }
    
    if (uniqueFcmTokens.length > 0) {
      // Tüm unique token'lara gönder - Service worker'daki duplicate prevention mekanizması
      // çoklu bildirim sorununu çözecektir (4 katmanlı koruma: handler debouncing, 
      // processing lock, in-memory cache, IndexedDB)
      const tokensToSend = uniqueFcmTokens;
      
      if (uniqueFcmTokens.length > 1) {
        console.log(`[Send Notification] ✅ Multiple tokens detected: ${uniqueFcmTokens.length} token(s) found for user ${userId}`);      } else {
        console.log(`[Send Notification] ✅ Single token found, sending to: ${tokensToSend[0].substring(0, 40)}...`);
      }
      
      console.log(`[Send Notification] Sending push notification to ${tokensToSend.length} token(s)`);
      
      // Convert data object to string format (FCM requires string values)
      const fcmData: Record<string, string> = {};
      if (data) {
        Object.keys(data).forEach((key) => {
          fcmData[key] = String(data[key]);
        });
      }
      
      // Add message ID for duplicate prevention
      // Round timestamp to 10-second intervals to allow duplicate prevention to work
      // while still allowing new notifications for new messages
      const notificationType = data?.type || 'general';
      const receiverRole = data?.receiverRole || ''; // Coach'tan student'a mesaj için role kontrolü
      const timestamp = Math.floor(Date.now() / 10000) * 10000; // 10 saniyelik aralıklar (artırıldı)
      
      // Generate stable message ID for duplicate prevention - userId, receiverRole ve timestamp ekle
      // CRITICAL: receiverRole eklenmeli ki aynı kullanıcı hem coach hem student ise duplicate önlensin
      // Body'nin hash'ini de ekle ki aynı mesaj içeriği için aynı ID olsun
      const bodyHash = body.substring(0, 50).replace(/[^a-zA-Z0-9]/g, ''); // İlk 50 karakter, özel karakterleri temizle
      if (data?.conversationId) {
        const rolePart = receiverRole ? `-${receiverRole}` : '';
        fcmData.messageId = `${userId}${rolePart}-${notificationType}-${data.conversationId}-${bodyHash}-${timestamp}`;
        fcmData.conversationId = data.conversationId; // Ensure conversationId is in data
      } else if (data?.supportId) {
        const rolePart = receiverRole ? `-${receiverRole}` : '';
        fcmData.messageId = `${userId}${rolePart}-${notificationType}-${data.supportId}-${bodyHash}-${timestamp}`;
        fcmData.supportId = data.supportId;
      } else {
        const rolePart = receiverRole ? `-${receiverRole}` : '';
        fcmData.messageId = `${userId}${rolePart}-${notificationType}-${bodyHash}-${timestamp}`;
      }
      
      // receiverRole'ü fcmData'ya ekle ki service worker'da kullanılabilsin
      if (receiverRole) {
        fcmData.receiverRole = receiverRole;
      }

      // Send push notification using Firebase Admin SDK with logo and sound
      // Now supports both FCM (web) and Expo Push (mobile) tokens
      try {
        console.log(`[Send Notification] Calling sendPushNotification with ${tokensToSend.length} token(s)`);        const pushResults = await sendPushNotification(tokensToSend, title, body, fcmData, logoUrl, soundUrl);
        tokensSent = pushResults.fcmSent + pushResults.expoSent;      } catch (pushError) {        console.error(`[Send Notification] Error details:`, JSON.stringify(pushError, null, 2));
      }
    } else {    }

    return NextResponse.json({
      success: true,
      message: "Bildirim gönderildi",
      tokensSent: tokensSent,
    });
  } catch (error: any) {    return NextResponse.json(
      { 
        error: error.message || "Bildirim gönderilirken hata oluştu",
        details: error?.toString(),
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}

