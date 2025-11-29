// Dynamic imports for server-side only modules
let Client: any;
let LocalAuth: any;
let qrcodeTerminal: any;
let qrcode: any;
let updateDoc: any;
let doc: any;

// Her coach için ayrı WhatsApp client instance'ları
const coachClients = new Map<string, {
  client: any;
  isReady: boolean;
  isInitializing: boolean;
  qrCode: string | null;
  qrCodeListeners: Set<(qr: string) => void>;
}>();

// Session yükleme işleminin devam edip etmediğini takip et
const sessionLoadingCoaches = new Set<string>();

/**
 * WhatsApp modüllerini yükler (sadece server-side)
 */
async function loadWhatsAppModules() {
  if (typeof window !== "undefined") {
    throw new Error("WhatsApp modülleri sadece server-side'da çalışabilir");
  }

  if (!Client) {
    const whatsappWeb = await import("whatsapp-web.js");
    Client = whatsappWeb.Client;
    LocalAuth = whatsappWeb.LocalAuth;
    qrcodeTerminal = await import("qrcode-terminal");
    qrcode = await import("qrcode");
    const firestore = await import("firebase/firestore");
    updateDoc = firestore.updateDoc;
    const firebase = await import("@/lib/firebase");
    doc = firestore.doc;
  }
}

/**
 * Coach için WhatsApp client'ı başlatır ve QR kod gösterir
 * @param coachId Coach'un user ID'si
 */
export async function initializeWhatsAppForCoach(coachId: string): Promise<{
  client: any;
  qrCode: string | null;
}> {
  console.log(`🔵 initializeWhatsAppForCoach çağrıldı (Coach: ${coachId})`);
  
  try {
    await loadWhatsAppModules();
    console.log(`✅ WhatsApp modülleri yüklendi (Coach: ${coachId})`);
  } catch (error: any) {
    console.error(`❌ WhatsApp modül yükleme hatası (Coach: ${coachId}):`, error);
    throw error;
  }

  // Eğer zaten varsa ve hazırsa, döndür
  const existing = coachClients.get(coachId);
  if (existing) {
    if (existing.isReady && existing.client) {
      // Client'ın hala bağlı olup olmadığını kontrol et
      try {
        const clientInfo = existing.client.info;
        if (clientInfo && clientInfo.wid) {
          console.log(`✅ Coach ${coachId} için WhatsApp client zaten bağlı`);
          return { client: existing.client, qrCode: existing.qrCode };
        }
      } catch (error) {
        console.log(`⚠️ Coach ${coachId} için client bilgisi alınamadı, yeniden başlatılıyor`);
        // Client geçersiz, Map'ten kaldır ve yeniden başlat
        coachClients.delete(coachId);
      }
    }
    
    // Eğer başlatılıyorsa, mevcut durumu döndür (bekleme yapma, polling zaten var)
    if (existing.isInitializing) {
      console.log(`⏳ Coach ${coachId} için WhatsApp zaten başlatılıyor, mevcut durum döndürülüyor`);
      return { client: existing.client, qrCode: existing.qrCode };
    }
    
    // Eğer client var ama bağlı değilse ve başlatılmıyorsa, yeniden başlat
    if (!existing.isReady && !existing.isInitializing) {
      console.log(`🔄 Coach ${coachId} için WhatsApp client var ama bağlı değil, yeniden başlatılıyor`);
      // Eski client'ı temizle
      if (existing.client) {
        try {
          existing.client.destroy();
        } catch (error) {
          console.error("Client destroy hatası:", error);
        }
      }
      coachClients.delete(coachId);
    }
  }

  // Yeni client oluştur
  const clientData = {
    client: null as any,
    isReady: false,
    isInitializing: true,
    qrCode: null as string | null,
    qrCodeListeners: new Set<(qr: string) => void>(),
  };

  coachClients.set(coachId, clientData);

  try {
    console.log(`🔧 Coach ${coachId} için WhatsApp Client oluşturuluyor...`);
    const client = new Client({
      authStrategy: new LocalAuth({
        dataPath: `./.wwebjs_auth/${coachId}`, // Her coach için ayrı klasör
      }),
      puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
    });
    console.log(`✅ Coach ${coachId} için WhatsApp Client oluşturuldu`);

    // QR kod event'i - base64 image olarak oluştur
    client.on("qr", async (qr: string) => {
      try {
        console.log(`📱 Coach ${coachId} için QR kod event'i tetiklendi`);
        // QR kodunu base64 image olarak oluştur
        const qrCodeImage = await qrcode.toDataURL(qr, {
          width: 300,
          margin: 2,
        });

        console.log(`✅ Coach ${coachId} için QR kod base64'e çevrildi (uzunluk: ${qrCodeImage.length})`);
        clientData.qrCode = qrCodeImage;
        
        // Tüm listener'lara bildir
        clientData.qrCodeListeners.forEach((listener) => {
          listener(qrCodeImage);
        });

        // Terminal'e de yazdır (opsiyonel)
        console.log(`\n📱 Coach ${coachId} için WhatsApp QR Kodu oluşturuldu`);
        if (qrcodeTerminal.default) {
          qrcodeTerminal.default.generate(qr, { small: true });
        } else if (qrcodeTerminal.generate) {
          qrcodeTerminal.generate(qr, { small: true });
        }
      } catch (error) {
        console.error(`❌ QR kod oluşturma hatası (Coach ${coachId}):`, error);
      }
    });

    // Gelen mesajları dinle ve Firestore'a kaydet
    client.on("message", async (message: any) => {
      try {
        // Sadece gelen mesajları kaydet (kendi gönderdiğimiz mesajları değil)
        if (message.from === "status@broadcast") return; // Status mesajlarını atla
        
        const { db } = await import("@/lib/firebase");
        const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");
        
        const messageData = {
          coachId: coachId,
          from: message.from,
          to: message.to || null,
          body: message.body || "",
          timestamp: message.timestamp || Date.now(),
          isGroup: message.isGroup || false,
          isMedia: message.hasMedia || false,
          mediaUrl: null as string | null,
          isFromCoach: false, // Gelen mesaj
          createdAt: serverTimestamp(),
        };

        // Eğer medya varsa, medya URL'sini al
        if (message.hasMedia) {
          try {
            const media = await message.downloadMedia();
            // Medya'yı Cloudinary'ye yükle veya base64 olarak sakla
            // Şimdilik base64 olarak saklayalım
            messageData.mediaUrl = `data:${media.mimetype};base64,${media.data}`;
          } catch (error) {
            console.error("Medya indirme hatası:", error);
          }
        }

        // Firestore'a kaydet
        await addDoc(collection(db, "whatsapp_messages"), messageData);
        console.log(`📨 WhatsApp mesajı kaydedildi (Coach: ${coachId}, From: ${message.from})`);
      } catch (error) {
        console.error("WhatsApp mesaj kaydetme hatası:", error);
      }
    });

    // Coach'un gönderdiği mesajları dinle ve Firestore'a kaydet
    client.on("message_create", async (message: any) => {
      try {
        // Sadece coach'un gönderdiği mesajları kaydet
        if (message.fromMe === false) return; // Sadece gönderilen mesajlar
        if (message.from === "status@broadcast") return; // Status mesajlarını atla
        
        const { db } = await import("@/lib/firebase");
        const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");
        
        const messageData = {
          coachId: coachId,
          from: message.from || null,
          to: message.to || null,
          body: message.body || "",
          timestamp: message.timestamp || Date.now(),
          isGroup: message.isGroup || false,
          isMedia: message.hasMedia || false,
          mediaUrl: null as string | null,
          isFromCoach: true, // Coach'un gönderdiği mesaj
          createdAt: serverTimestamp(),
        };

        // Eğer medya varsa, medya URL'sini al
        if (message.hasMedia) {
          try {
            const media = await message.downloadMedia();
            // Medya'yı Cloudinary'ye yükle veya base64 olarak sakla
            // Şimdilik base64 olarak saklayalım
            messageData.mediaUrl = `data:${media.mimetype};base64,${media.data}`;
          } catch (error) {
            console.error("Medya indirme hatası:", error);
          }
        }

        // Firestore'a kaydet
        await addDoc(collection(db, "whatsapp_messages"), messageData);
        console.log(`📤 WhatsApp mesajı kaydedildi (Coach: ${coachId}, To: ${message.to})`);
      } catch (error) {
        console.error("WhatsApp mesaj kaydetme hatası:", error);
      }
    });

    client.on("ready", async () => {
      console.log(`✅ Coach ${coachId} için WhatsApp bağlantısı hazır!`);
      clientData.isReady = true;
      clientData.isInitializing = false;
      clientData.qrCode = null; // QR kod artık gerekli değil
      sessionLoadingCoaches.delete(coachId); // Session yükleme tamamlandı
      
      // Client bilgisini logla
      try {
        const clientInfo = client.info;
        console.log(`📱 Coach ${coachId} için WhatsApp bilgileri:`, {
          wid: clientInfo?.wid?.user || "N/A",
          pushname: clientInfo?.pushname || "N/A",
        });
      } catch (error) {
        console.error("Client bilgisi alınamadı:", error);
      }
      
      // Coach'un telefon numarasını otomatik kaydet
      try {
        await loadWhatsAppModules();
        const { db } = await import("@/lib/firebase");
        const coachPhoneNumber = (client.info as any)?.wid?.user || null;
        if (coachPhoneNumber) {
          await updateDoc(doc(db, "users", coachId), {
            whatsappPhoneNumber: coachPhoneNumber, // Coach'un WhatsApp numarası
          });
          console.log(`📱 Coach ${coachId} için WhatsApp numarası kaydedildi: ${coachPhoneNumber}`);
        }
      } catch (error) {
        console.error("WhatsApp numarası kaydetme hatası:", error);
      }
    });

    client.on("authenticated", () => {
      console.log(`✅ Coach ${coachId} için WhatsApp kimlik doğrulaması tamamlandı!`);
    });

    client.on("auth_failure", (msg: any) => {
      console.error(`❌ Coach ${coachId} için WhatsApp kimlik doğrulama hatası:`, msg);
      clientData.isInitializing = false;
      coachClients.delete(coachId);
    });

    client.on("disconnected", (reason: any) => {
      console.log(`⚠️ Coach ${coachId} için WhatsApp bağlantısı kesildi:`, reason);
      clientData.isReady = false;
      clientData.isInitializing = false;
      clientData.qrCode = null;
      
      // Otomatik yeniden bağlanmayı dene (5 saniye sonra)
      setTimeout(async () => {
        console.log(`🔄 Coach ${coachId} için otomatik yeniden bağlanma deneniyor...`);
        try {
          // Client'ı temizle
          if (clientData.client) {
            try {
              clientData.client.destroy();
            } catch (error) {
              console.error("Client destroy hatası:", error);
            }
          }
          coachClients.delete(coachId);
          
          // Yeniden başlat
          await initializeWhatsAppForCoach(coachId);
        } catch (error) {
          console.error(`❌ Otomatik yeniden bağlanma hatası (Coach ${coachId}):`, error);
        }
      }, 5000); // 5 saniye sonra yeniden dene
    });

    clientData.client = client;
    
    // Client'ı başlat (async - QR kod event'i sonra gelecek)
    console.log(`🔄 Coach ${coachId} için WhatsApp client başlatılıyor...`);
    console.log(`📤 Coach ${coachId} için initialize çağrıldı, QR kod event'i bekleniyor...`);
    
    // MaxListeners uyarısını önlemek için
    if (process.setMaxListeners) {
      process.setMaxListeners(20);
    }
    
    // Initialize'i await etmeden başlat (async işlem)
    // QR kod event'i geldiğinde clientData.qrCode güncellenecek
    client.initialize()
      .then(() => {
        console.log(`✅ Coach ${coachId} için WhatsApp client initialize tamamlandı`);
        // Eğer ready event'i gelmediyse, hala initializing olabilir
        if (!clientData.isReady) {
          console.log(`⏳ Coach ${coachId} için QR kod veya ready event bekleniyor...`);
        }
      })
      .catch((error: any) => {
        console.error(`❌ WhatsApp client initialize hatası (Coach ${coachId}):`, error);
        console.error(`❌ Hata detayı:`, error?.message || error);
        console.error(`❌ Hata stack:`, error?.stack);
        clientData.isInitializing = false;
        sessionLoadingCoaches.delete(coachId);
        coachClients.delete(coachId);
      });

    // Client başlatıldı, QR kod event'i bekleniyor
    // Hemen dön, QR kod event'inde gelecek
    // Not: initialize() await edilmiyor çünkü QR kod event'i async olarak gelecek
    console.log(`📤 Coach ${coachId} için initialize çağrıldı, QR kod event'i bekleniyor...`);
    return { client, qrCode: clientData.qrCode };
  } catch (error) {
    console.error(`❌ WhatsApp başlatma hatası (Coach ${coachId}):`, error);
    clientData.isInitializing = false;
    coachClients.delete(coachId);
    throw error;
  }
}

/**
 * WhatsApp mesajı gönderir (coach'a)
 * @param coachId Coach'un user ID'si
 * @param phoneNumber Telefon numarası (örn: "905551234567")
 * @param message Mesaj içeriği
 */
export async function sendWhatsAppMessage(
  coachId: string,
  phoneNumber: string,
  message: string
): Promise<boolean> {
  try {
    const clientData = coachClients.get(coachId);
    
    if (!clientData || !clientData.isReady) {
      await initializeWhatsAppForCoach(coachId);
      const updated = coachClients.get(coachId);
      if (!updated || !updated.isReady) {
        throw new Error("WhatsApp client hazır değil");
      }
    }

    const client = coachClients.get(coachId)!.client;
    const formattedNumber = phoneNumber.replace(/[^0-9]/g, "");
    const chatId = `${formattedNumber}@c.us`;

    await client.sendMessage(chatId, message);
    console.log(`✅ WhatsApp mesajı gönderildi (Coach: ${coachId}, Numara: ${phoneNumber})`);
    return true;
  } catch (error: any) {
    console.error("WhatsApp mesaj gönderme hatası:", error);
    throw error;
  }
}

/**
 * Coach için WhatsApp durumunu kontrol eder
 * Eğer client yoksa ama session varsa, otomatik olarak başlatır
 */
export async function getWhatsAppStatusForCoach(coachId: string): Promise<{
  isReady: boolean;
  isInitializing: boolean;
  qrCode: string | null;
}> {
  const clientData = coachClients.get(coachId);
  
  // Eğer client varsa, durumunu kontrol et
  if (clientData) {
    // Eğer isReady true ise, client'ın hala bağlı olup olmadığını kontrol et
    if (clientData.isReady && clientData.client) {
      try {
        const clientInfo = clientData.client.info;
        if (!clientInfo || !clientInfo.wid) {
          // Client bilgisi yok, bağlantı kesilmiş
          console.log(`⚠️ Coach ${coachId} için client bilgisi yok, durum güncelleniyor`);
          clientData.isReady = false;
          return { isReady: false, isInitializing: false, qrCode: null };
        }
      } catch (error) {
        // Client bilgisi alınamıyor, bağlantı kesilmiş olabilir
        console.log(`⚠️ Coach ${coachId} için client bilgisi alınamadı:`, error);
        clientData.isReady = false;
        return { isReady: false, isInitializing: false, qrCode: null };
      }
    }
    
    return {
      isReady: clientData.isReady,
      isInitializing: clientData.isInitializing,
      qrCode: clientData.qrCode,
    };
  }
  
  // Client yoksa, session dosyasını kontrol et ve varsa başlat (sadece bir kez)
  if (!sessionLoadingCoaches.has(coachId)) {
    sessionLoadingCoaches.add(coachId);
    
    try {
      const fs = await import("fs/promises");
      const path = await import("path");
      const sessionPath = path.join(process.cwd(), `.wwebjs_auth/${coachId}`);
      
      // Session klasörü var mı kontrol et
      try {
        const stats = await fs.stat(sessionPath);
        if (stats.isDirectory()) {
          // Session var, client'ı başlat (async, beklemeden)
          console.log(`🔄 Coach ${coachId} için mevcut session bulundu, client başlatılıyor...`);
          initializeWhatsAppForCoach(coachId).catch((error) => {
            console.error(`❌ Session yükleme hatası (Coach ${coachId}):`, error);
            sessionLoadingCoaches.delete(coachId);
          });
        } else {
          sessionLoadingCoaches.delete(coachId);
        }
      } catch (error) {
        // Session klasörü yok, normal
        sessionLoadingCoaches.delete(coachId);
      }
    } catch (error) {
      // fs modülü yüklenemiyor (client-side), normal
      sessionLoadingCoaches.delete(coachId);
    }
  }
  
  // Client henüz yükleniyor olabilir, mevcut durumu döndür
  const currentClientData = coachClients.get(coachId);
  if (currentClientData) {
    return {
      isReady: currentClientData.isReady,
      isInitializing: currentClientData.isInitializing,
      qrCode: currentClientData.qrCode,
    };
  }
  
  // Client yok ve session yüklenmiyor
  if (!sessionLoadingCoaches.has(coachId)) {
    return { isReady: false, isInitializing: false, qrCode: null };
  }
  
  // Session yükleniyor
  return { isReady: false, isInitializing: true, qrCode: null };
}

/**
 * Coach için WhatsApp client'ını kapatır ve Map'ten kaldırır
 */
export function disconnectWhatsAppForCoach(coachId: string): void {
  const clientData = coachClients.get(coachId);
  if (clientData && clientData.client) {
    try {
      clientData.client.destroy();
      console.log(`🔌 WhatsApp client kapatıldı (Coach: ${coachId})`);
    } catch (error: any) {
      console.error(`❌ WhatsApp client kapatma hatası (Coach: ${coachId}):`, error);
    }
  }
  coachClients.delete(coachId);
  console.log(`🗑️ WhatsApp client Map'ten kaldırıldı (Coach: ${coachId})`);
}

/**
 * QR kod listener ekler (real-time güncellemeler için)
 */
export function addQRCodeListener(
  coachId: string,
  listener: (qr: string) => void
): () => void {
  const clientData = coachClients.get(coachId);
  if (clientData) {
    clientData.qrCodeListeners.add(listener);
    // Eğer zaten QR kod varsa, hemen gönder
    if (clientData.qrCode) {
      listener(clientData.qrCode);
    }
  }
  // Cleanup fonksiyonu
  return () => {
    const current = coachClients.get(coachId);
    if (current) {
      current.qrCodeListeners.delete(listener);
    }
  };
}
