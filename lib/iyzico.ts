// iyzico yapılandırması
// NOT: iyzipay import'u API route'larında yapılıyor (build hatası önlemek için)
// Bu dosya sadece createPaymentRequest fonksiyonunu export ediyor

// Ödeme başlatma için request oluştur
export function createPaymentRequest(
  userId: string,
  userName: string,
  userEmail: string,
  amount: number,
  plan: "lite" | "premium",
  billingPeriod: "monthly" | "yearly",
  referralCode?: string
) {
  const conversationId = `payment_${userId}_${Date.now()}`;
  const basketItems = [
    {
      id: plan,
      name: `${plan === "premium" ? "Premium" : "Lite"} Plan - ${billingPeriod === "yearly" ? "Yıllık" : "Aylık"}`,
      category1: "Abonelik",
      itemType: "VIRTUAL",
      price: amount.toFixed(2),
    },
  ];

  return {
    locale: "tr",
    conversationId,
    price: amount.toFixed(2),
    paidPrice: amount.toFixed(2),
    currency: "TRY",
    basketId: `basket_${userId}_${Date.now()}`,
    paymentChannel: "WEB",
    paymentGroup: "PRODUCT",
    callbackUrl: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/payment/iyzico/callback`,
    enabledInstallments: [2, 3, 6, 9, 12],
    buyer: {
      id: userId,
      name: userName,
      surname: userName.split(" ")[1] || userName,
      gsmNumber: "+905350000000",
      email: userEmail,
      identityNumber: "11111111111",
      lastLoginDate: new Date().toISOString(),
      registrationDate: new Date().toISOString(),
      registrationAddress: "Test Adres",
      ip: "85.34.78.112",
      city: "Istanbul",
      country: "Turkey",
      zipCode: "34000",
    },
    shippingAddress: {
      contactName: userName,
      city: "Istanbul",
      country: "Turkey",
      address: "Test Adres",
      zipCode: "34000",
    },
    billingAddress: {
      contactName: userName,
      city: "Istanbul",
      country: "Turkey",
      address: "Test Adres",
      zipCode: "34000",
    },
    basketItems,
    metadata: {
      userId,
      plan,
      billingPeriod,
      referralCode: referralCode || null,
    },
  };
}
