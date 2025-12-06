import { NextResponse } from "next/server";

/**
 * Puppeteer'ın çalışıp çalışmadığını test eder
 * GET /api/whatsapp/test-puppeteer
 */
export async function GET() {
  try {
    console.log("🧪 Puppeteer test başlatılıyor...");
    
    // Puppeteer'ı import et
    let puppeteer: any;
    try {
      puppeteer = await import("puppeteer");
      console.log("✅ Puppeteer modülü yüklendi");
    } catch (error: any) {
      console.error("❌ Puppeteer modülü yüklenemedi:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Puppeteer modülü yüklenemedi",
          details: error?.message || String(error),
        },
        { status: 500 }
      );
    }
    
    // Browser'ı başlat
    let browser: any;
    try {
      console.log("🚀 Browser başlatılıyor...");
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-gpu",
        ],
      });
      console.log("✅ Browser başlatıldı");
    } catch (error: any) {
      console.error("❌ Browser başlatılamadı:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Browser başlatılamadı",
          details: error?.message || String(error),
          stack: error?.stack,
        },
        { status: 500 }
      );
    }
    
    // Test sayfası aç
    let page: any;
    try {
      console.log("📄 Test sayfası açılıyor...");
      page = await browser.newPage();
      await page.goto("https://www.google.com", { waitUntil: "networkidle0", timeout: 10000 });
      console.log("✅ Test sayfası açıldı");
      
      const title = await page.title();
      console.log(`✅ Sayfa başlığı: ${title}`);
      
      await page.close();
      await browser.close();
      
      return NextResponse.json({
        success: true,
        message: "Puppeteer çalışıyor",
        title: title,
      });
    } catch (error: any) {
      console.error("❌ Test sayfası açılamadı:", error);
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error("❌ Browser kapatılamadı:", closeError);
        }
      }
      return NextResponse.json(
        {
          success: false,
          error: "Test sayfası açılamadı",
          details: error?.message || String(error),
          stack: error?.stack,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("❌ Puppeteer test hatası:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Puppeteer test başarısız",
        details: error?.message || String(error),
        stack: error?.stack,
      },
      { status: 500 }
    );
  }
}

