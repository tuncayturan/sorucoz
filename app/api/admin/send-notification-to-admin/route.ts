import { NextRequest, NextResponse } from "next/server";
import { collection, query, where, getDocs, doc, getDoc, addDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { sendPushNotification } from "@/lib/firebase/admin";

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

    // Tüm admin ve coach kullanıcıları bul
    const usersRef = collection(db, "users");
    const adminQuery = query(usersRef, where("role", "==", "admin"));
    const coachQuery = query(usersRef, where("role", "==", "coach"));
    
    const [adminSnapshot, coachSnapshot] = await Promise.all([
      getDocs(adminQuery),
      getDocs(coachQuery)
    ]);

    const allTokens: string[] = [];
    let notifiedUsers = 0;

    console.log(`[Send Notification to Admin/Coach] Found ${adminSnapshot.docs.length} admin(s) and ${coachSnapshot.docs.length} coach(es)`);

    // Process admins
    for (const adminDoc of adminSnapshot.docs) {
      const adminData = adminDoc.data();
      const adminId = adminDoc.id;
      const fcmTokens = adminData.fcmTokens || [];

      console.log(`[Send Notification to Admin/Coach] Admin: ${adminId}, FCM Tokens: ${fcmTokens.length}`);

      // Firestore'a bildirim kaydet
      const bildirimlerRef = collection(db, "users", adminId, "bildirimler");
      await addDoc(bildirimlerRef, {
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
      const fcmTokens = coachData.fcmTokens || [];

      console.log(`[Send Notification to Admin/Coach] Coach: ${coachId}, FCM Tokens: ${fcmTokens.length}`);

      // Firestore'a bildirim kaydet
      const bildirimlerRef = collection(db, "users", coachId, "bildirimler");
      await addDoc(bildirimlerRef, {
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

      // Send push notification to all admin tokens
      try {
        await sendPushNotification(allTokens, title, body, fcmData);
        console.log(`[Send Notification to Admin] Push notification sent successfully`);
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

