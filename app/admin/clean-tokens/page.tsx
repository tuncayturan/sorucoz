"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function CleanTokensPage() {
  const { user } = useAuth();
  const [userId, setUserId] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

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
      
      <div className="bg-white rounded-lg p-6 shadow-lg">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            User ID (Coach ID):
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

