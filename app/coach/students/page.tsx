"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast from "@/components/ui/Toast";

interface Student {
  id: string;
  name: string;
  email: string;
  photoURL?: string | null;
  subscriptionPlan?: "trial" | "lite" | "premium";
  createdAt: any;
  lastQuestionDate?: string;
  dailyQuestionCount?: number;
}

interface StudentWithStats extends Student {
  totalQuestions: number;
  solvedQuestions: number;
  lastQuestionTime?: any;
}

export default function CoachStudentsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    isVisible: boolean;
  }>({
    message: "",
    type: "info",
    isVisible: false,
  });

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  // Role check
  useEffect(() => {
    if (!authLoading && !userDataLoading) {
      if (!user) {
        router.replace("/landing");
      } else if (userData?.role !== "coach") {
        router.replace("/home");
      }
    }
  }, [user, userData, authLoading, userDataLoading, router]);

  // Fetch students
  useEffect(() => {
    if (!user || userData?.role !== "coach") return;
    fetchStudents();
  }, [user, userData]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      
      // Tüm öğrencileri getir
      const studentsRef = collection(db, "users");
      const studentsQuery = query(studentsRef, where("role", "==", "student"));
      const studentsSnapshot = await getDocs(studentsQuery);

      const studentsWithStats: StudentWithStats[] = [];

      // Her öğrenci için soru istatistiklerini al
      for (const studentDoc of studentsSnapshot.docs) {
        const studentData = studentDoc.data() as Student;
        
        // Öğrencinin sorularını al
        const sorularRef = collection(db, "users", studentDoc.id, "sorular");
        const sorularQuery = query(sorularRef, orderBy("createdAt", "desc"));
        const sorularSnapshot = await getDocs(sorularQuery);

        let solvedCount = 0;
        let lastQuestionTime: any | null = null;

        sorularSnapshot.forEach((soruDoc) => {
          const soruData = soruDoc.data();
          if (soruData.status === "solved") {
            solvedCount++;
          }
          if (!lastQuestionTime && soruData.createdAt) {
            lastQuestionTime = soruData.createdAt;
          }
        });

        studentsWithStats.push({
          id: studentDoc.id,
          ...studentData,
          totalQuestions: sorularSnapshot.size,
          solvedQuestions: solvedCount,
          lastQuestionTime,
        });
      }

      // En son soru sorandan başla
      studentsWithStats.sort((a, b) => {
        const aTime = a.lastQuestionTime?.toDate?.()?.getTime() || 0;
        const bTime = b.lastQuestionTime?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });

      setStudents(studentsWithStats);
      setFilteredStudents(studentsWithStats);
    } catch (error) {
      console.error("Öğrenciler yüklenirken hata:", error);
      showToast("Öğrenciler yüklenirken bir hata oluştu.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Arama fonksiyonu
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredStudents(students);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = students.filter((student) => {
      const nameMatch = student.name?.toLowerCase().includes(query);
      const emailMatch = student.email?.toLowerCase().includes(query);
      return nameMatch || emailMatch;
    });

    setFilteredStudents(filtered);
  }, [searchQuery, students]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Hiç";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / 86400000);

    if (days === 0) return "Bugün";
    if (days === 1) return "Dün";
    if (days < 7) return `${days} gün önce`;
    return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  };

  if (authLoading || userDataLoading || loading) {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Öğrenciler</h1>
        <p className="text-gray-600">
          {searchQuery ? (
            <>
              <span className="font-semibold">{filteredStudents.length}</span> sonuç bulundu
              {filteredStudents.length !== students.length && (
                <span className="text-gray-400"> (Toplam {students.length} öğrenci)</span>
              )}
            </>
          ) : (
            <>Toplam {students.length} kayıtlı öğrenci</>
          )}
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6 bg-gray-50/50 rounded-3xl p-5 border border-gray-100/50">
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-12 py-4 rounded-2xl border-2 border-gray-200/80 bg-white/90 backdrop-blur-sm focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/20 transition-all text-base font-medium"
            placeholder="İsim veya e-posta ile ara..."
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Students Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStudents.length === 0 && searchQuery ? (
          <div className="col-span-full text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-gray-500 font-semibold text-lg">Sonuç bulunamadı</p>
            <p className="text-gray-400 text-sm mt-1">"{searchQuery}" için eşleşen öğrenci bulunamadı</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <p className="text-gray-500 font-semibold text-lg">Henüz öğrenci yok</p>
            <p className="text-gray-400 text-sm mt-1">Kayıtlı öğrenci bulunmamaktadır</p>
          </div>
        ) : (
          filteredStudents.map((student) => (
            <div
              key={student.id}
              onClick={() => router.push(`/coach/students/${student.id}`)}
              className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 hover:shadow-[0_15px_50px_rgba(0,0,0,0.12)] transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="flex items-start gap-4 mb-4">
                {student.photoURL && student.photoURL.trim() !== "" ? (
                  <img
                    src={student.photoURL}
                    alt={student.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-green-200 shadow-md"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      // Eğer resim yüklenemezse, baş harfli avatar göster
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        const fallback = document.createElement('div');
                        fallback.className = 'w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-md';
                        fallback.textContent = student.name.charAt(0).toUpperCase();
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                ) : (
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-md">
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-lg mb-1">{student.name}</h3>
                  <p className="text-sm text-gray-600 truncate">{student.email}</p>
                  {student.subscriptionPlan && (
                    <span className={`inline-block mt-2 text-xs px-3 py-1 rounded-full font-bold ${
                      student.subscriptionPlan === "premium"
                        ? "bg-yellow-100 text-yellow-700"
                        : student.subscriptionPlan === "lite"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-700"
                    }`}>
                      {student.subscriptionPlan === "premium" ? "⭐ Premium" : 
                       student.subscriptionPlan === "lite" ? "📚 Lite" : "🆓 Trial"}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-3">
                  <p className="text-xs text-gray-600 mb-1">Toplam Soru</p>
                  <p className="text-2xl font-bold text-blue-600">{student.totalQuestions}</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-3">
                  <p className="text-xs text-gray-600 mb-1">Çözülen</p>
                  <p className="text-2xl font-bold text-green-600">{student.solvedQuestions}</p>
                </div>
              </div>

              {/* Last Activity */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Son aktivite: {formatDate(student.lastQuestionTime)}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/coach/chat?studentId=${student.id}`);
                    }}
                    className="px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-bold rounded-lg hover:shadow-md transition-all flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Mesaj
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </div>
  );
}

