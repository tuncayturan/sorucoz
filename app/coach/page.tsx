"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, getDocs, orderBy, Timestamp, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";

interface Student {
  id: string;
  name?: string;
  email?: string;
  createdAt: Timestamp;
}

interface MessageStats {
  total: number;
  unread: number;
}

export default function CoachDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { userData } = useUserData();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageStats, setMessageStats] = useState<MessageStats>({
    total: 0,
    unread: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch all students
      const usersRef = collection(db, "users");
      // Index gerektirmemek için önce role ile filtrele, sonra client-side'da sırala
      const q = query(usersRef, where("role", "==", "student"));
      const snapshot = await getDocs(q);

      const studentsList: Student[] = [];
      snapshot.forEach((doc) => {
        studentsList.push({
          id: doc.id,
          ...doc.data(),
        } as Student);
      });
      // Client-side'da createdAt'e göre sırala
      studentsList.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
        const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
        return bTime - aTime; // Yeni olanlar önce
      });
      setStudents(studentsList);

      // Fetch message statistics
      await fetchMessageStats();
    } catch (error) {
      console.error("Veri yüklenirken hata:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessageStats = async () => {
    try {
      let total = 0;
      let unread = 0;

      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);

      for (const userDoc of usersSnapshot.docs) {
        const userDocData = userDoc.data();
        if (userDocData.role === "student") {
          const userId = userDoc.id;
          const mesajlarRef = collection(db, "users", userId, "mesajlar");
          const mesajlarSnapshot = await getDocs(mesajlarRef);

          mesajlarSnapshot.forEach((doc) => {
            const data = doc.data();
            total++;
            if (data.type === "user" && !data.readByCoach) {
              unread++;
            }
          });
        }
      }

      setMessageStats({ total, unread });
    } catch (error) {
      console.error("Mesaj istatistikleri yüklenirken hata:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-12 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Coach panel genel bakış</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Toplam Öğrenci */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-green-200/50 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-green-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">👥</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 font-medium mb-2">Toplam Öğrenci</p>
            <p className="text-3xl font-bold text-green-600">{students.length}</p>
            <p className="text-xs text-gray-500 mt-2">Kayıtlı öğrenciler</p>
          </div>
        </div>

        {/* Toplam Mesaj */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-blue-200/50 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">💬</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 font-medium mb-2">Toplam Mesaj</p>
            <p className="text-3xl font-bold text-blue-600">{messageStats.total}</p>
            <p className="text-xs text-gray-500 mt-2">Tüm mesajlar</p>
          </div>
        </div>

        {/* Okunmamış Mesaj */}
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-orange-200/50 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">📨</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 font-medium mb-2">Okunmamış Mesaj</p>
            <p className="text-3xl font-bold text-orange-600">{messageStats.unread}</p>
            <p className="text-xs text-gray-500 mt-2">Yanıt bekleyen</p>
          </div>
        </div>
      </div>

      {/* Hızlı Erişim */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-green-200/20 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Hızlı Erişim</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/coach/chat"
              className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100 hover:shadow-lg transition text-center"
            >
              <div className="text-3xl mb-2">💬</div>
              <p className="font-bold text-gray-900">Öğrenci Mesajları</p>
            </a>
            <a
              href="/coach/calendar"
              className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100 hover:shadow-lg transition text-center"
            >
              <div className="text-3xl mb-2">📅</div>
              <p className="font-bold text-gray-900">Takvim</p>
            </a>
            <a
              href="/coach/profile"
              className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-100 hover:shadow-lg transition text-center"
            >
              <div className="text-3xl mb-2">👤</div>
              <p className="font-bold text-gray-900">Profil</p>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

