"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function CleanTokensPage() {
  const { user } = useAuth();
  const [userId, setUserId] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [allResult, setAllResult] = useState<any>(null);

  const handleCleanAll = async () => {
    if (!confirm("⚠️ TÜM kullanıcıların token'larını temizlemek istediğinizden emin misiniz?\n\nHer kullanıcıda sadece EN SON 1 TOKEN kalacak.")) {
      return;
    }

    try {
      setLoadingAll(true);
      setAllResult(null);
      
      const response = await fetch("/api/admin/clean-fcm-tokens", {
        method: "GET",
      });

      const data = await response.json();
      setAllResult(data);
      
      if (data.success) {
        alert(`✅ TÜM KULLANICILAR TEMİZLENDİ!\n\n` +
              `Kontrol edilen: ${data.usersChecked} kullanıcı\n` +
              `Birden fazla token'ı olan: ${data.usersWithMultipleTokens}\n` +
              `Toplam temizlenen token: ${data.totalTokensCleaned}\n\n` +
              `Artık herkesin sadece 1 token'ı var! 🎉`);
      } else {
        alert(`❌ Hata: ${data.error}`);
      }
    } catch (error: any) {
      alert(`❌ Hata: ${error.message}`);
    } finally {
      setLoadingAll(false);
    }
  };

  const handleClean = async () => {
    if (!userId) {
      alert("Lütfen user ID girin");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/admin/clean-fcm-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        alert(`✅ Başarılı!\n\nTemizlenen: ${data.cleaned}\nKalan: ${data.remaining}`);
      } else {
        alert(`❌ Hata: ${data.error}`);
      }
    } catch (error: any) {
      alert(`❌ Hata: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">FCM Token Temizleme</h1>
      
      {/* TÜM KULLANICILAR İÇİN TEMİZLİK */}
      <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg p-6 shadow-lg mb-6">
        <h2 className="text-xl font-bold mb-2">🔥 Tüm Kullanıcılar İçin Agresif Temizlik</h2>
        <p className="text-sm mb-4 opacity-90">
          Duplicate bildirim sorununu çözmek için TÜM kullanıcıların token'larını temizler.
          Her kullanıcıda sadece EN SON 1 TOKEN kalır.
        </p>
        
        <button
          onClick={handleCleanAll}
          disabled={loadingAll}
          className="w-full px-6 py-3 bg-white text-red-600 rounded-lg font-bold hover:bg-gray-100 disabled:opacity-50 transition"
        >
          {loadingAll ? "⏳ Tüm Kullanıcılar Temizleniyor..." : "🚀 TÜM KULLANICILARI TEMİZLE"}
        </button>

        {allResult && (
          <div className="mt-4 p-4 bg-white/20 rounded-lg backdrop-blur">
            <h3 className="font-semibold mb-2">✅ Sonuç:</h3>
            <div className="text-sm space-y-1">
              <p>👥 Kontrol edilen: <strong>{allResult.usersChecked}</strong> kullanıcı</p>
              <p>🔧 Birden fazla token'ı olan: <strong>{allResult.usersWithMultipleTokens}</strong></p>
              <p>🗑️ Toplam temizlenen: <strong>{allResult.totalTokensCleaned}</strong> token</p>
            </div>
          </div>
        )}
      </div>

      {/* TEK KULLANICI İÇİN TEMİZLİK */}
      <div className="bg-white rounded-lg p-6 shadow-lg">
        <h2 className="text-lg font-bold mb-4">Tek Kullanıcı İçin Temizlik</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            User ID:
          </label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="eXmxQflNFueQC1DgnGOVySp4Hk23"
            className="w-full px-4 py-2 border rounded-lg"
          />
          <p className="text-xs text-gray-500 mt-1">
            Coach'un Firestore User ID'sini girin
          </p>
        </div>

        <button
          onClick={handleClean}
          disabled={loading}
          className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? "Temizleniyor..." : "Geçersiz Token'ları Temizle"}
        </button>

        {result && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Sonuç:</h3>
            <pre className="text-sm">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="font-semibold mb-2">⚠️ Not:</h3>
        <p className="text-sm text-gray-700">
          Coach'un User ID'sini Firestore'dan alabilirsiniz:<br/>
          Admin Panel → Kullanıcılar → Coach'u bulun → ID'yi kopyalayın
        </p>
      </div>
    </div>
  );
}

