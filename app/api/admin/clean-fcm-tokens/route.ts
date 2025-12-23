import { NextRequest, NextResponse } from "next/server";
import { getAdminApp } from "@/lib/firebase/admin";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

/**
 * TÜM kullanıcıların FCM token'larını agresif temizle
 * Her kullanıcı için sadece EN SON 1 token bırak
 * GET /api/admin/clean-fcm-tokens
 */
export async function GET() {
  try {    const adminApp = getAdminApp();
    const adminDb = getFirestore(adminApp);

    // Tüm kullanıcıları al
    const usersSnapshot = await adminDb.collection("users").get();    let totalCleaned = 0;
    let usersWithMultipleTokens = 0;

    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();
        const fcmTokens = userData.fcmTokens || [];

        if (!Array.isArray(fcmTokens) || fcmTokens.length === 0) {
          continue;
        }

        // Eğer birden fazla token varsa, sadece son token'ı tut
        if (fcmTokens.length > 1) {
          const lastToken = fcmTokens[fcmTokens.length - 1];          await userDoc.ref.update({
            fcmTokens: [lastToken], // Sadece son token
            lastTokenCleanup: new Date(),
          });

          totalCleaned += (fcmTokens.length - 1);
          usersWithMultipleTokens++;
        }
      } catch (error) {      }
    }

    const summary = {
      success: true,
      message: "AGGRESSIVE cleanup completed",
      usersChecked: usersSnapshot.size,
      usersWithMultipleTokens,
      totalTokensCleaned: totalCleaned,
    };    console.log(JSON.stringify(summary, null, 2));

    return NextResponse.json(summary);
  } catch (error: any) {    return NextResponse.json(
      { error: error.message || "Cleanup failed" },
      { status: 500 }
    );
  }
}

/**
 * Tek kullanıcının geçersiz FCM token'larını temizler
 * POST /api/admin/clean-fcm-tokens
 * Body: { userId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId gerekli" },
        { status: 400 }
      );
    }

    const adminApp = getAdminApp();
    const adminDb = getFirestore(adminApp);
    const messaging = getMessaging(adminApp);

    // Kullanıcının token'larını al
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    const userData = userSnap.data();
    const fcmTokens: string[] = (userData?.fcmTokens as string[]) || [];    if (fcmTokens.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Token bulunamadı",
        cleaned: 0,
        remaining: 0,
      });
    }

    // Her token'ı test et
    const validTokens: string[] = [];
    const invalidTokens: string[] = [];

    for (const token of fcmTokens) {
      try {
        // Dummy message ile token'ı test et (gerçekte gönderme, sadece validate et)
        await messaging.send({
          token: token,
          data: { test: "validation" },
        }, true); // dryRun = true
        
        validTokens.push(token);
        console.log(`[Clean FCM Tokens] ✅ Valid token: ${token.substring(0, 20)}...`);
      } catch (error: any) {
        invalidTokens.push(token);
        console.log(`[Clean FCM Tokens] ❌ Invalid token: ${token.substring(0, 20)}...`, error.code);
      }
    }

    // Sadece geçerli token'ları Firestore'da tut
    if (invalidTokens.length > 0) {
      await userRef.update({
        fcmTokens: validTokens,
      });
      console.log(`[Clean FCM Tokens] ✅ Cleaned ${invalidTokens.length} invalid token(s)`);
    }

    return NextResponse.json({
      success: true,
      message: `${invalidTokens.length} geçersiz token temizlendi`,
      cleaned: invalidTokens.length,
      remaining: validTokens.length,
    });
  } catch (error: any) {    return NextResponse.json(
      { error: error.message || "Token temizleme başarısız" },
      { status: 500 }
    );
  }
}

