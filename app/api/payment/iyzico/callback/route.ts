import { NextRequest, NextResponse } from "next/server";
import { doc, updateDoc, getDoc, Timestamp, increment, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, conversationId } = body;

    if (!token || !conversationId) {
      return NextResponse.json(
        { error: "Eksik parametreler" },
        { status: 400 }
      );
    }

    // Admin ayarlarından iyzico bilgilerini al
    const settingsRef = doc(db, "adminSettings", "paymentMethods");
    const settingsSnap = await getDoc(settingsRef);
    const paymentMethods = settingsSnap.exists() ? settingsSnap.data().methods : [];
    const iyzicoSettings = paymentMethods.find((m: any) => m.id === "iyzico");

    if (!iyzicoSettings) {
      return NextResponse.json(
        { error: "iyzico ayarları bulunamadı" },
        { status: 400 }
      );
    }

    // iyzico client oluştur (runtime'da yükle - build time'da analiz edilmesin)
    // Use Function constructor to avoid build-time analysis
    const loadIyzipay = new Function('return require("iyzipay")');
    // @ts-ignore
    const Iyzipay = loadIyzipay();
    const iyzico = new Iyzipay({
      apiKey: iyzicoSettings.apiKey,
      secretKey: iyzicoSettings.secretKey,
      uri: iyzicoSettings.testMode
        ? "https://sandbox-api.iyzipay.com"
        : "https://api.iyzipay.com",
    });

    // Ödeme durumunu kontrol et
    const paymentStatus = await new Promise((resolve, reject) => {
      iyzico.threedsPayment.create(
        {
          locale: "tr",
          conversationId,
          paymentId: token,
        },
        (err: any, result: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        }
      );
    });

    const statusResult = paymentStatus as any;

    // Ödeme kaydını bul
    const paymentsRef = collection(db, "payments");
    const { query, where, getDocs } = await import("firebase/firestore");
    const paymentsQuery = query(paymentsRef, where("conversationId", "==", conversationId));
    const paymentsSnapshot = await getDocs(paymentsQuery);

    if (paymentsSnapshot.empty) {
      return NextResponse.json(
        { error: "Ödeme kaydı bulunamadı" },
        { status: 404 }
      );
    }

    const paymentDoc = paymentsSnapshot.docs[0];
    const paymentData = paymentDoc.data();

    // Ödeme durumunu güncelle
    const paymentStatusValue =
      statusResult.status === "success" && statusResult.paymentStatus === "SUCCESS"
        ? "completed"
        : "failed";

    await updateDoc(paymentDoc.ref, {
      status: paymentStatusValue,
      transactionId: statusResult.paymentId,
      iyzicoResponse: statusResult,
      updatedAt: Timestamp.now(),
    });

    // Ödeme başarılıysa kullanıcının aboneliğini aktif et
    if (paymentStatusValue === "completed") {
      const userRef = doc(db, "users", paymentData.userId);
      const now = new Date();
      const subscriptionDays = paymentData.billingPeriod === "yearly" ? 365 : 30;
      const subscriptionEndDate = new Date(now);
      subscriptionEndDate.setDate(subscriptionEndDate.getDate() + subscriptionDays);

      await updateDoc(userRef, {
        premium: paymentData.plan === "premium",
        subscriptionPlan: paymentData.plan,
        subscriptionStatus: "active",
        subscriptionStartDate: Timestamp.fromDate(now),
        subscriptionEndDate: Timestamp.fromDate(subscriptionEndDate),
        billingPeriod: paymentData.billingPeriod,
        dailyQuestionCount: 0,
        lastQuestionDate: now.toISOString().split("T")[0],
      });

      // Referans kodu kullanım sayısını artır (eğer daha önce artırılmadıysa)
      if (paymentData.referralCode && paymentStatusValue === "completed") {
        const codesRef = collection(db, "referralCodes");
        const codesQuery = query(codesRef, where("code", "==", paymentData.referralCode));
        const codesSnapshot = await getDocs(codesQuery);
        
        if (!codesSnapshot.empty) {
          const codeDoc = codesSnapshot.docs[0];
          await updateDoc(codeDoc.ref, {
            usageCount: increment(1),
          });
        }
      }
    }

    // Kullanıcıyı yönlendir
    const redirectUrl =
      paymentStatusValue === "completed"
        ? `/home?payment=success&plan=${paymentData.plan}`
        : `/premium?payment=failed`;

    return NextResponse.redirect(new URL(redirectUrl, request.url));
  } catch (error: any) {    return NextResponse.redirect(new URL("/premium?payment=error", request.url));
  }
}

// GET request için de destek (iyzico bazen GET ile gönderebilir)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get("token");
  const conversationId = searchParams.get("conversationId");

  if (!token || !conversationId) {
    return NextResponse.redirect(new URL("/premium?payment=error", request.url));
  }

  // POST metodunu çağır
  return POST(
    new NextRequest(request.url, {
      method: "POST",
      body: JSON.stringify({ token, conversationId }),
    })
  );
}
