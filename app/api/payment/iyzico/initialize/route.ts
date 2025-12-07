import { NextRequest, NextResponse } from "next/server";
import { createPaymentRequest } from "@/lib/iyzico";
import { doc, getDoc, collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, plan, billingPeriod, referralCode } = body;

    if (!userId || !plan || !billingPeriod) {
      return NextResponse.json(
        { error: "Eksik parametreler" },
        { status: 400 }
      );
    }

    // Kullanıcı bilgilerini al
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return NextResponse.json(
        { error: "Kullanıcı bulunamadı" },
        { status: 404 }
      );
    }

    const userData = userSnap.data();
    const userName = userData.name || "Kullanıcı";
    const userEmail = userData.email || "";

    // Admin ayarlarından iyzico bilgilerini al
    const settingsRef = doc(db, "adminSettings", "paymentMethods");
    const settingsSnap = await getDoc(settingsRef);
    const paymentMethods = settingsSnap.exists() ? settingsSnap.data().methods : [];
    const iyzicoSettings = paymentMethods.find((m: any) => m.id === "iyzico");

    if (!iyzicoSettings || !iyzicoSettings.enabled) {
      return NextResponse.json(
        { error: "iyzico ödeme yöntemi aktif değil" },
        { status: 400 }
      );
    }

    // Fiyat hesaplama
    const litePriceMonthly = 99;
    const premiumPriceMonthly = 399;
    const basePrice = billingPeriod === "yearly"
      ? (plan === "premium" ? premiumPriceMonthly * 12 : litePriceMonthly * 12)
      : (plan === "premium" ? premiumPriceMonthly : litePriceMonthly);

    // Referans kodu indirimi
    let finalPrice = basePrice;
    let discountAmount = 0;
    if (referralCode) {
      const codesRef = collection(db, "referralCodes");
      const { query, where, getDocs } = await import("firebase/firestore");
      const codesQuery = query(codesRef, where("code", "==", referralCode.toUpperCase()));
      const codesSnapshot = await getDocs(codesQuery);
      
      if (!codesSnapshot.empty) {
        const codeData = codesSnapshot.docs[0].data();
        if (codeData.isActive && (!codeData.maxUsage || codeData.usageCount < codeData.maxUsage)) {
          discountAmount = Math.round((basePrice * codeData.discountPercent) / 100);
          finalPrice = basePrice - discountAmount;
        }
      }
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

    // Ödeme request'i oluştur
    const paymentRequest = createPaymentRequest(
      userId,
      userName,
      userEmail,
      finalPrice,
      plan,
      billingPeriod,
      referralCode
    );

    // iyzico'ya ödeme başlatma isteği gönder
    const payment = await new Promise((resolve, reject) => {
      iyzico.threedsInitialize.create(paymentRequest, (err: any, result: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });

    const paymentResult = payment as any;

    if (paymentResult.status !== "success") {
      return NextResponse.json(
        { error: paymentResult.errorMessage || "Ödeme başlatılamadı" },
        { status: 400 }
      );
    }

    // Ödeme kaydı oluştur
    const paymentsRef = collection(db, "payments");
    const paymentRecord = {
      userId,
      userName,
      userEmail,
      plan,
      billingPeriod,
      amount: finalPrice,
      originalAmount: basePrice,
      discountAmount,
      referralCode: referralCode || null,
      status: "pending",
      paymentMethod: "iyzico",
      conversationId: paymentRequest.conversationId,
      iyzicoPaymentId: paymentResult.paymentId,
      createdAt: Timestamp.now(),
    };

    const paymentDocRef = await addDoc(paymentsRef, paymentRecord);

    return NextResponse.json({
      success: true,
      paymentId: paymentDocRef.id,
      htmlContent: paymentResult.threeDSHtmlContent,
      conversationId: paymentRequest.conversationId,
    });
  } catch (error: any) {
    console.error("iyzico initialize error:", error);
    return NextResponse.json(
      { error: error.message || "Ödeme başlatılamadı" },
      { status: 500 }
    );
  }
}
