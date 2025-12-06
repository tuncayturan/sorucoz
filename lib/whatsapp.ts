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

  // Firestore'dan bağlantı durumunu kontrol et - eğer bağlantı bilgileri yoksa, direkt QR kod göster
  let hasConnectionInfo = false;
  try {
    await loadWhatsAppModules();
    const { db } = await import("@/lib/firebase");
    const { doc, getDoc } = await import("firebase/firestore");
    const coachDoc = await getDoc(doc(db, "users", coachId));
    if (coachDoc.exists()) {
      const coachData = coachDoc.data();
      // Eğer WhatsApp bağlantı bilgileri varsa (whatsappConnected ve whatsappConnectedAt)
      hasConnectionInfo = !!(coachData.whatsappConnected && coachData.whatsappConnectedAt);
      console.log(`📊 Coach ${coachId} için Firestore bağlantı durumu:`, {
        whatsappConnected: coachData.whatsappConnected,
        whatsappConnectedAt: coachData.whatsappConnectedAt ? 'Var' : 'Yok',
        hasConnectionInfo: hasConnectionInfo,
      });
    }
  } catch (error) {
    console.error("Firestore bağlantı durumu kontrol hatası:", error);
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

  // Firestore'dan bağlantı durumunu kontrol et
  // Eğer bağlantı bilgileri yoksa, direkt QR kod göster (otomatik bağlanma yapma)
  let shouldAutoConnect = false;
  if (hasConnectionInfo) {
    shouldAutoConnect = true;
    console.log(`🔄 Coach ${coachId} için otomatik bağlanma deneniyor (Firestore'da bağlantı bilgileri var)`);
  } else {
    console.log(`📱 Coach ${coachId} için Firestore'da bağlantı bilgileri yok, QR kod gösterilecek`);
  }
  
  // Session dosyalarını kontrol et - eğer bozuksa temizle
  try {
    if (typeof window === "undefined") {
      const fs = await import("fs/promises");
      const path = await import("path");
      const sessionPath = path.join(process.cwd(), `.wwebjs_auth/${coachId}`);
      
      try {
        const stats = await fs.stat(sessionPath);
        if (stats.isDirectory()) {
          // Session var ama Firestore'da bağlı değilse, bozuk olabilir - temizle
          if (!shouldAutoConnect) {
            console.warn(`⚠️ Coach ${coachId} için session dosyaları var ama Firestore'da bağlı değil. Bozuk olabilir, temizleniyor...`);
            try {
              // Önce mevcut client'ı destroy et (varsa)
              const existing = coachClients.get(coachId);
              if (existing && existing.client) {
                try {
                  await existing.client.destroy();
                  await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                  console.error("Mevcut client destroy hatası:", error);
                }
              }
              
              // Session dosyalarını temizle
              await fs.rm(sessionPath, { recursive: true, force: true });
              console.log(`✅ Coach ${coachId} için bozuk session dosyaları temizlendi`);
            } catch (error: any) {
              if (error.code !== "EBUSY" && error.code !== "ENOENT") {
                console.error(`❌ Session temizleme hatası:`, error);
              } else if (error.code === "EBUSY") {
                console.warn(`⚠️ Session dosyaları kilitli, temizlenemedi. Devam ediliyor...`);
              }
            }
          }
        }
      } catch (error: any) {
        // Session klasörü yok, normal
        if (error.code !== "ENOENT") {
          console.error(`❌ Session kontrol hatası:`, error);
        }
      }
    }
  } catch (error) {
    console.error("Session kontrol hatası:", error);
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
    
    // Railway ve diğer cloud ortamları için Puppeteer yapılandırması
    const puppeteerOptions: any = {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process", // Railway için önemli
        "--disable-gpu",
      ],
    };
    
    // Railway'de Chromium PATH'i
    if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) {
      // Railway'de Chromium nixpacks ile yüklenir
      // PATH otomatik olarak ayarlanır, ekstra yapılandırma gerekmez
      console.log(`🚂 Railway ortamı tespit edildi, Puppeteer yapılandırması optimize ediliyor...`);
    }
    
    const client = new Client({
      authStrategy: new LocalAuth({
        dataPath: `./.wwebjs_auth/${coachId}`, // Her coach için ayrı klasör
      }),
      puppeteer: puppeteerOptions,
    });
    console.log(`✅ Coach ${coachId} için WhatsApp Client oluşturuldu`);

    // QR kod event'i - base64 image olarak oluştur
    // ÖNEMLİ: Event listener'ı initialize() çağrılmadan ÖNCE kurmalıyız
    console.log(`🎯 Coach ${coachId} için QR event listener kuruluyor...`);
    
    // Event listener'ın kurulduğunu doğrula
    const qrListener = async (qr: string) => {
      try {
        console.log(`📱 ========== QR KOD EVENT TETİKLENDİ ==========`);
        console.log(`📱 Coach ${coachId} için QR kod event'i tetiklendi (QR string uzunluk: ${qr.length})`);
        console.log(`📱 QR string ilk 50 karakter: ${qr.substring(0, 50)}...`);
        
        // QR kodunu base64 image olarak oluştur
        console.log(`🔄 QR kod base64'e çevriliyor...`);
        const qrCodeImage = await qrcode.toDataURL(qr, {
          width: 300,
          margin: 2,
          errorCorrectionLevel: 'M',
        });

        console.log(`✅ Coach ${coachId} için QR kod base64'e çevrildi (uzunluk: ${qrCodeImage.length})`);
        console.log(`📊 QR kod güncelleniyor - Önceki: ${clientData.qrCode ? 'Var' : 'Yok'}, Yeni: Var`);
        console.log(`📊 Base64 preview: ${qrCodeImage.substring(0, 50)}...`);
        
        clientData.qrCode = qrCodeImage;
        clientData.isInitializing = true; // QR kod geldi, hala bağlanıyor
        
        // QR kod güncellendiğini logla
        console.log(`✅ Coach ${coachId} için clientData.qrCode güncellendi: ${clientData.qrCode ? 'Var (' + clientData.qrCode.length + ' karakter)' : 'Yok'}`);
        console.log(`📱 ========== QR KOD EVENT TAMAMLANDI ==========`);
        
        // QR kod oluşturulduğunda Firestore'a kaydet
        try {
          await loadWhatsAppModules();
          const { db } = await import("@/lib/firebase");
          const { serverTimestamp } = await import("firebase/firestore");
          await updateDoc(doc(db, "users", coachId), {
            whatsappQRGeneratedAt: serverTimestamp(), // QR kod oluşturulma zamanı
            whatsappConnecting: true, // Bağlantı kuruluyor
          });
          console.log(`📱 Coach ${coachId} için QR kod oluşturulma zamanı kaydedildi`);
        } catch (error) {
          console.error("QR kod oluşturulma zamanı kaydetme hatası:", error);
        }
        
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
        console.error(`❌ Hata detayı:`, error);
      }
    };
    
    // Event listener'ı kur
    client.on("qr", qrListener);
    console.log(`✅ Coach ${coachId} için QR event listener kuruldu`);
    
    // Event listener'ın gerçekten kurulduğunu doğrula
    const listenerCount = client.listenerCount ? client.listenerCount("qr") : 0;
    console.log(`🔍 Coach ${coachId} için QR event listener sayısı: ${listenerCount}`);

    // Error event'lerini dinle
    client.on("auth_failure", async (msg: string) => {
      console.error(`❌ Coach ${coachId} için auth_failure:`, msg);
      console.error(`❌ Auth failure mesajı:`, msg);
      clientData.isInitializing = false;
      clientData.qrCode = null;
      
      // Session dosyaları bozuk olabilir, temizle
      console.log(`🗑️ Coach ${coachId} için auth_failure nedeniyle session temizleniyor...`);
      
      // Client'ı önce destroy et
      try {
        await client.destroy();
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 saniye bekle
      } catch (error) {
        console.error(`❌ Client destroy hatası (auth_failure):`, error);
      }
      
      // Session'ı temizle
      try {
        await clearWhatsAppSessionForCoach(coachId);
      } catch (error) {
        console.error(`❌ Session temizleme hatası (auth_failure):`, error);
      }
    });
    
    client.on("disconnected", (reason: string) => {
      console.error(`❌ Coach ${coachId} için disconnected:`, reason);
      clientData.isInitializing = false;
      clientData.qrCode = null;
    });
    
    // Gelen mesajları dinle ve Firestore'a kaydet
    client.on("message", async (message: any) => {
      try {
        // Sadece gelen mesajları kaydet (kendi gönderdiğimiz mesajları değil)
        if (message.from === "status@broadcast") return; // Status mesajlarını atla
        
        const { db } = await import("@/lib/firebase");
        const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");
        
        // Contact bilgilerini al (profil fotoğrafı ve isim)
        let profilePicUrl: string | null = null;
        let contactName: string | null = null;
        
        try {
          const contact = await message.getContact();
          
          // Profil fotoğrafını al
          try {
            profilePicUrl = await contact.getProfilePicUrl();
            console.log(`📸 WhatsApp profil fotoğrafı alındı (From: ${message.from})`);
          } catch (error) {
            console.log(`⚠️ Profil fotoğrafı alınamadı (From: ${message.from}):`, error);
          }
          
          // Contact adını al
          contactName = contact.pushname || contact.name || null;
          console.log(`📝 WhatsApp contact adı: ${contactName}`);
        } catch (error) {
          console.error("Contact bilgisi alınırken hata:", error);
        }
        
        const messageData: any = {
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
          profilePicUrl: profilePicUrl, // WhatsApp profil fotoğrafı
          contactName: contactName, // WhatsApp contact adı
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
        console.log(`📨 WhatsApp mesajı kaydedildi (Coach: ${coachId}, From: ${message.from}, Contact: ${contactName})`);
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
        
        // Alıcı contact bilgilerini al (profil fotoğrafı ve isim)
        let profilePicUrl: string | null = null;
        let contactName: string | null = null;
        
        try {
          const contact = await message.getContact();
          
          // Profil fotoğrafını al
          try {
            profilePicUrl = await contact.getProfilePicUrl();
            console.log(`📸 WhatsApp profil fotoğrafı alındı (To: ${message.to})`);
          } catch (error) {
            console.log(`⚠️ Profil fotoğrafı alınamadı (To: ${message.to}):`, error);
          }
          
          // Contact adını al
          contactName = contact.pushname || contact.name || null;
          console.log(`📝 WhatsApp contact adı: ${contactName}`);
        } catch (error) {
          console.error("Contact bilgisi alınırken hata:", error);
        }
        
        const messageData: any = {
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
          profilePicUrl: profilePicUrl, // WhatsApp profil fotoğrafı
          contactName: contactName, // WhatsApp contact adı
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
        console.log(`📤 WhatsApp mesajı kaydedildi (Coach: ${coachId}, To: ${message.to}, Contact: ${contactName})`);
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
      
      // Coach'un telefon numarasını ve bağlantı durumunu Firestore'a kaydet
      // Bu, QR kod okutulduktan sonra bağlantı kurulduğunda çalışır
      try {
        await loadWhatsAppModules();
        const { db } = await import("@/lib/firebase");
        const { serverTimestamp } = await import("firebase/firestore");
        const coachPhoneNumber = (client.info as any)?.wid?.user || null;
        const pushname = (client.info as any)?.pushname || null;
        
        if (coachPhoneNumber) {
          await updateDoc(doc(db, "users", coachId), {
            whatsappPhoneNumber: coachPhoneNumber, // Coach'un WhatsApp numarası
            whatsappConnected: true, // Bağlantı durumu
            whatsappConnectedAt: serverTimestamp(), // Bağlantı zamanı
            whatsappPushname: pushname, // WhatsApp ismi
            whatsappLastSeen: serverTimestamp(), // Son görülme
            whatsappConnecting: false, // Bağlantı tamamlandı
            whatsappConnectingStartTime: null, // Başlatma zamanı temizle
          });
          console.log(`📱 Coach ${coachId} için WhatsApp bağlantı bilgileri Firestore'a kaydedildi: ${coachPhoneNumber}`);
        } else {
          console.warn(`⚠️ Coach ${coachId} için telefon numarası alınamadı`);
        }
      } catch (error) {
        console.error("WhatsApp bilgileri kaydetme hatası:", error);
      }
    });

    client.on("authenticated", async () => {
      console.log(`✅ Coach ${coachId} için WhatsApp kimlik doğrulaması tamamlandı!`);
      
      // QR kod okutulduğunda Firestore'a kaydet
      try {
        await loadWhatsAppModules();
        const { db } = await import("@/lib/firebase");
        const { serverTimestamp } = await import("firebase/firestore");
        await updateDoc(doc(db, "users", coachId), {
          whatsappQRScannedAt: serverTimestamp(), // QR kod okutma zamanı
          whatsappConnecting: true, // Bağlantı kuruluyor
        });
        console.log(`📱 Coach ${coachId} için QR kod okutma zamanı kaydedildi`);
      } catch (error) {
        console.error("QR kod okutma zamanı kaydetme hatası:", error);
      }
    });

    client.on("auth_failure", (msg: any) => {
      console.error(`❌ Coach ${coachId} için WhatsApp kimlik doğrulama hatası:`, msg);
      clientData.isInitializing = false;
      coachClients.delete(coachId);
    });

    client.on("disconnected", async (reason: any) => {
      console.log(`⚠️ Coach ${coachId} için WhatsApp bağlantısı kesildi:`, reason);
      clientData.isReady = false;
      clientData.isInitializing = false;
      clientData.qrCode = null;
      
      // Bağlantı kesilme durumunu Firestore'a kaydet
      try {
        await loadWhatsAppModules();
        const { db } = await import("@/lib/firebase");
        const { serverTimestamp } = await import("firebase/firestore");
        await updateDoc(doc(db, "users", coachId), {
          whatsappConnected: false, // Bağlantı durumu
          whatsappDisconnectedAt: serverTimestamp(), // Bağlantı kesilme zamanı
          whatsappDisconnectReason: reason || "unknown", // Kesilme nedeni
        });
        console.log(`📱 Coach ${coachId} için WhatsApp bağlantı kesilme durumu kaydedildi`);
      } catch (error) {
        console.error("Bağlantı kesilme durumu kaydetme hatası:", error);
      }
      
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
    
    // Event listener'ların kurulduğunu doğrula
    console.log(`🔍 Coach ${coachId} için event listener'lar kontrol ediliyor...`);
    const eventNames = client.listenerCount ? ['qr', 'ready', 'authenticated', 'auth_failure', 'disconnected'] : [];
    eventNames.forEach(eventName => {
      const count = client.listenerCount ? client.listenerCount(eventName) : 0;
      console.log(`   - ${eventName}: ${count} listener`);
    });
    
    // Initialize'den önce event listener'ların kurulduğunu doğrula
    const qrListenerCountBefore = client.listenerCount ? client.listenerCount("qr") : 0;
    console.log(`🔍 Initialize öncesi QR listener sayısı: ${qrListenerCountBefore}`);
    
    if (qrListenerCountBefore === 0) {
      console.error(`❌ QR listener kurulmamış! Yeniden kuruluyor...`);
      client.on("qr", qrListener);
      console.log(`✅ QR listener yeniden kuruldu`);
    }
    
    // Initialize'i await etmeden başlat (async işlem)
    // QR kod event'i geldiğinde clientData.qrCode güncellenecek
    console.log(`🚀 Coach ${coachId} için client.initialize() çağrılıyor...`);
    const initStartTime = Date.now();
    
    // QR event'inin gelmesi için timeout ekle
    const qrTimeout = setTimeout(() => {
      if (!clientData.qrCode && !clientData.isReady) {
        console.warn(`⚠️ Coach ${coachId} için 30 saniye sonra hala QR kod gelmedi`);
        console.warn(`⚠️ Client durumu:`, {
          isReady: clientData.isReady,
          isInitializing: clientData.isInitializing,
          hasQRCode: !!clientData.qrCode,
        });
        
        // Client durumunu kontrol et
        try {
          const clientState = (client as any).pupPage ? 'Puppeteer page var' : 'Puppeteer page yok';
          console.warn(`⚠️ Puppeteer durumu: ${clientState}`);
        } catch (error) {
          console.error(`❌ Client durumu kontrol hatası:`, error);
        }
      }
    }, 30000); // 30 saniye
    
    client.initialize()
      .then(() => {
        clearTimeout(qrTimeout);
        const initDuration = Date.now() - initStartTime;
        console.log(`✅ Coach ${coachId} için WhatsApp client initialize tamamlandı (${initDuration}ms)`);
        console.log(`📊 Initialize sonrası durum: isReady=${clientData.isReady}, hasQRCode=${!!clientData.qrCode}, isInitializing=${clientData.isInitializing}`);
        
        // Initialize sonrası event listener'ları kontrol et
        const qrListenerCountAfter = client.listenerCount ? client.listenerCount("qr") : 0;
        console.log(`🔍 Initialize sonrası QR listener sayısı: ${qrListenerCountAfter}`);
        
        // Eğer ready event'i gelmediyse, hala initializing olabilir
        if (!clientData.isReady) {
          console.log(`⏳ Coach ${coachId} için QR kod veya ready event bekleniyor...`);
          
          // Initialize tamamlandıktan sonra 5 saniye bekle ve QR kod kontrolü yap
          setTimeout(() => {
            if (!clientData.isReady && !clientData.qrCode) {
              console.warn(`⚠️ Coach ${coachId} için initialize tamamlandı ama QR kod henüz gelmedi (5 saniye sonra)`);
              console.warn(`⚠️ Mevcut durum: isReady=${clientData.isReady}, hasQRCode=${!!clientData.qrCode}, isInitializing=${clientData.isInitializing}`);
              
              // Client durumunu kontrol et
              try {
                const clientInfo = client.info;
                console.log(`📊 Client info:`, clientInfo ? 'Var' : 'Yok');
                if (clientInfo) {
                  console.log(`📊 Client state:`, {
                    wid: clientInfo.wid ? 'Var' : 'Yok',
                    pushname: clientInfo.pushname || 'Yok',
                  });
                }
              } catch (error) {
                console.error(`❌ Client info alınamadı:`, error);
              }
              
              // QR event listener'ının hala aktif olup olmadığını kontrol et
              const currentQrListenerCount = client.listenerCount ? client.listenerCount("qr") : 0;
              console.warn(`⚠️ QR listener sayısı: ${currentQrListenerCount}`);
              
              if (currentQrListenerCount === 0) {
                console.error(`❌ QR event listener kaybolmuş! Yeniden kuruluyor...`);
                client.on("qr", qrListener);
                console.log(`✅ QR listener yeniden kuruldu`);
              }
              
              // Puppeteer durumunu kontrol et
              try {
                const pupPage = (client as any).pupPage;
                if (pupPage) {
                  console.log(`📊 Puppeteer page durumu: Var`);
                  pupPage.url().then((url: string) => {
                    console.log(`📊 Puppeteer page URL: ${url || 'Alınamadı'}`);
                  }).catch(() => {
                    console.warn(`⚠️ Puppeteer page URL alınamadı`);
                  });
                } else {
                  console.warn(`⚠️ Puppeteer page yok - bu QR kod gelmemesinin nedeni olabilir`);
                }
              } catch (error) {
                console.error(`❌ Puppeteer durumu kontrol hatası:`, error);
              }
            }
          }, 5000); // 5 saniye sonra kontrol et
        }
      })
      .catch((error: any) => {
        clearTimeout(qrTimeout);
        console.error(`❌ WhatsApp client initialize hatası (Coach ${coachId}):`, error);
        console.error(`❌ Hata detayı:`, error?.message || error);
        console.error(`❌ Hata stack:`, error?.stack);
        console.error(`❌ Hata name:`, error?.name);
        console.error(`❌ Hata code:`, error?.code);
        
        // Puppeteer hatası kontrolü
        if (error?.message?.includes("Puppeteer") || error?.message?.includes("browser") || error?.message?.includes("headless")) {
          console.error(`❌ Puppeteer hatası tespit edildi - Railway ortamında Puppeteer çalışmıyor olabilir`);
          console.error(`❌ Railway ortamında Puppeteer için gerekli bağımlılıklar yüklü mü kontrol edin`);
        }
        
        clientData.isInitializing = false;
        clientData.qrCode = null;
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
    
    // Debug: QR kod durumunu logla
    console.log(`📊 getWhatsAppStatusForCoach (Coach: ${coachId}):`, {
      isReady: clientData.isReady,
      isInitializing: clientData.isInitializing,
      hasQRCode: !!clientData.qrCode,
      qrCodeLength: clientData.qrCode ? clientData.qrCode.length : 0,
      qrCodePreview: clientData.qrCode ? clientData.qrCode.substring(0, 50) + '...' : 'null',
    });
    
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
 * Coach için WhatsApp session'ını tamamen temizler (dosyaları siler)
 */
export async function clearWhatsAppSessionForCoach(coachId: string): Promise<void> {
  console.log(`🗑️ Coach ${coachId} için WhatsApp session temizleniyor...`);
  
  try {
    // Önce client'ı kapat ve Map'ten kaldır
    const clientData = coachClients.get(coachId);
    if (clientData && clientData.client) {
      try {
        console.log(`🔌 Coach ${coachId} için client destroy ediliyor...`);
        await clientData.client.destroy();
        console.log(`✅ Coach ${coachId} için client destroy edildi`);
        
        // Client destroy edildikten sonra biraz bekle (dosyaların kilitlenmesini önlemek için)
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 saniye bekle
      } catch (error: any) {
        console.error(`❌ Client destroy hatası (Coach ${coachId}):`, error);
        // Devam et, session dosyalarını temizlemeyi dene
      }
    }
    
    // Client'ı Map'ten kaldır
    coachClients.delete(coachId);
    sessionLoadingCoaches.delete(coachId);
    
    // Session dosyalarını sil
    if (typeof window === "undefined") {
      const fs = await import("fs/promises");
      const path = await import("path");
      const sessionPath = path.join(process.cwd(), `.wwebjs_auth/${coachId}`);
      
      try {
        // Session klasörünü sil (retry mekanizması ile)
        let retries = 3;
        while (retries > 0) {
          try {
            await fs.rm(sessionPath, { recursive: true, force: true });
            console.log(`✅ Coach ${coachId} için session dosyaları silindi`);
            break;
          } catch (error: any) {
            retries--;
            if (error.code === "EBUSY" || error.code === "ENOENT") {
              if (error.code === "EBUSY" && retries > 0) {
                console.warn(`⚠️ Session dosyaları kilitli, ${retries} deneme kaldı. 1 saniye bekleniyor...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
              } else if (error.code === "ENOENT") {
                // Dosya zaten yok, bu normal
                console.log(`ℹ️ Session klasörü zaten yok (Coach ${coachId})`);
                break;
              }
            }
            if (retries === 0) {
              console.error(`❌ Session dosyası silme hatası (Coach ${coachId}):`, error);
              // EBUSY hatası kritik değil, devam et
              if (error.code !== "EBUSY") {
                throw error;
              }
            }
          }
        }
      } catch (error: any) {
        if (error.code !== "ENOENT" && error.code !== "EBUSY") {
          console.error(`❌ Session temizleme hatası (Coach ${coachId}):`, error);
          // Kritik olmayan hatalar için devam et
        }
      }
    }
    
    console.log(`✅ Coach ${coachId} için session temizleme işlemi tamamlandı`);
  } catch (error) {
    console.error(`❌ Session temizleme hatası (Coach ${coachId}):`, error);
    throw error;
  }
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
