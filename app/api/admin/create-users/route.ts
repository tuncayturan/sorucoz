import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

interface UserData {
  name: string;
  email: string;
  password?: string;
}

interface SuccessResult {
  email: string;
  name: string;
  password: string;
  uid: string;
}

interface ErrorResult {
  email: string;
  error: string;
}

// Otomatik şifre oluşturucu
function generatePassword(): string {
  const length = 12;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

export async function POST(req: NextRequest) {
  try {
    const { users } = await req.json();

    if (!users || !Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { error: "Geçerli kullanıcı verisi sağlanmalıdır" },
        { status: 400 }
      );
    }

    // Firebase Admin instance'larını al
    const adminAuth = getAdminAuth();
    const adminDb = getAdminFirestore();

    const results: {
      success: SuccessResult[];
      errors: ErrorResult[];
    } = {
      success: [],
      errors: [],
    };

    for (const userData of users) {
      try {
        const { name, email, password } = userData as UserData;

        // Validation
        if (!name || !email) {
          results.errors.push({
            email: email || "bilinmeyen",
            error: "Ad Soyad ve Email gereklidir",
          });
          continue;
        }

        // Email formatı kontrolü
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          results.errors.push({
            email,
            error: "Geçersiz email formatı",
          });
          continue;
        }

        // Şifre oluştur (eğer sağlanmadıysa)
        const finalPassword = password && password.trim() !== "" ? password : generatePassword();

        // Firebase Authentication'da kullanıcı oluştur
        const userRecord = await adminAuth.createUser({
          email,
          password: finalPassword,
          displayName: name,
          emailVerified: true, // Admin tarafından eklenen kullanıcılar otomatik onaylı
        });

        // Firestore'a kullanıcı bilgilerini ekle
        await adminDb.collection("users").doc(userRecord.uid).set({
          name,
          email,
          role: "student",
          premium: false,
          subscriptionPlan: "trial",
          subscriptionStatus: "trial",
          createdAt: Timestamp.now(),
          photoURL: null,
          emailVerified: true, // Admin tarafından eklenen kullanıcılar otomatik onaylı
        });

        results.success.push({
          email,
          name,
          password: finalPassword,
          uid: userRecord.uid,
        });
      } catch (error: any) {
        console.error(`Kullanıcı oluşturma hatası (${userData.email}):`, error);
        
        let errorMessage = "Kullanıcı oluşturulamadı";
        if (error.code === "auth/email-already-exists") {
          errorMessage = "Bu email adresi zaten kullanılıyor";
        } else if (error.code === "auth/invalid-email") {
          errorMessage = "Geçersiz email adresi";
        } else if (error.code === "auth/weak-password") {
          errorMessage = "Şifre çok zayıf (minimum 6 karakter)";
        }

        results.errors.push({
          email: userData.email,
          error: errorMessage,
        });
      }
    }

    return NextResponse.json({
      message: "İşlem tamamlandı",
      results,
      summary: {
        total: users.length,
        success: results.success.length,
        failed: results.errors.length,
      },
    });
  } catch (error: any) {    return NextResponse.json(
      { error: "Sunucu hatası", details: error.message },
      { status: 500 }
    );
  }
}

