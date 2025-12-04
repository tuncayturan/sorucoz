"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { collection, query, getDocs, orderBy, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast from "@/components/ui/Toast";
import Image from "next/image";

interface Student {
  id: string;
  name: string;
  email: string;
  photoURL?: string | null;
  subscriptionPlan?: "trial" | "lite" | "premium";
  createdAt: any;
}

interface Question {
  id: string;
  ders: string;
  status: "pending" | "answered" | "solved";
  createdAt: any;
  soruImgUrl?: string; // Soru görseli URL'si
  pdfUrl?: string;
  subject?: string;
  solution?: {
    steps: Array<{ step: number; explanation: string; calculation?: string }>;
    finalAnswer: string;
  } | null;
}

const SUBJECT_COLORS: { [key: string]: string } = {
  "Matematik": "from-blue-500 to-indigo-600",
  "Fizik": "from-purple-500 to-pink-600",
  "Kimya": "from-green-500 to-emerald-600",
  "Biyoloji": "from-red-500 to-rose-600",
  "Türkçe": "from-yellow-500 to-orange-600",
  "Tarih": "from-amber-500 to-yellow-600",
  "Coğrafya": "from-teal-500 to-cyan-600",
  "Felsefe": "from-indigo-500 to-purple-600",
  "Vatandaşlık": "from-blue-500 to-cyan-600",
  "Güncel": "from-gray-500 to-slate-600",
  "Fen Bilgisi": "from-emerald-500 to-teal-600",
  "Sosyal Bilgiler": "from-orange-500 to-amber-600",
  "Bilinmeyen": "from-gray-500 to-gray-600",
};

const SUBJECT_ICONS: { [key: string]: string } = {
  "Matematik": "🔢",
  "Fizik": "⚛️",
  "Kimya": "🧪",
  "Biyoloji": "🔬",
  "Türkçe": "📝",
  "Tarih": "📜",
  "Coğrafya": "🌍",
  "Felsefe": "💭",
  "Vatandaşlık": "📋",
  "Güncel": "📰",
  "Fen Bilgisi": "🔬",
  "Sosyal Bilgiler": "🌐",
  "Bilinmeyen": "❓",
};

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();
  const [student, setStudent] = useState<Student | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [groupedQuestions, setGroupedQuestions] = useState<{ [key: string]: Question[] }>({});
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
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

  // Fetch student data and questions
  useEffect(() => {
    if (!user || userData?.role !== "coach" || !studentId) return;
    fetchStudentData();
  }, [user, userData, studentId]);

  const fetchStudentData = async () => {
    try {
      setLoading(true);

      // Öğrenci bilgilerini al
      const studentRef = doc(db, "users", studentId);
      const studentSnap = await getDoc(studentRef);

      if (!studentSnap.exists()) {
        showToast("Öğrenci bulunamadı!", "error");
        router.push("/coach/students");
        return;
      }

      const studentData = {
        id: studentSnap.id,
        ...studentSnap.data(),
      } as Student;

      setStudent(studentData);

      // Öğrencinin sorularını al
      const sorularRef = collection(db, "users", studentId, "sorular");
      const sorularQuery = query(sorularRef, orderBy("createdAt", "desc"));
      const sorularSnapshot = await getDocs(sorularQuery);

      const questionsList: Question[] = [];
      sorularSnapshot.forEach((doc) => {
        questionsList.push({
          id: doc.id,
          ...doc.data(),
        } as Question);
      });

      setQuestions(questionsList);

      // Derslere göre grupla
      const grouped: { [key: string]: Question[] } = {};
      questionsList.forEach((q) => {
        const ders = q.ders || "Bilinmeyen";
        if (!grouped[ders]) {
          grouped[ders] = [];
        }
        grouped[ders].push(q);
      });

      setGroupedQuestions(grouped);

      // İlk dersi seç (en çok sorusu olan)
      const sortedSubjects = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);
      if (sortedSubjects.length > 0) {
        setSelectedSubject(sortedSubjects[0][0]);
      }
    } catch (error) {
      console.error("Öğrenci verileri yüklenirken hata:", error);
      showToast("Veriler yüklenirken bir hata oluştu.", "error");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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

  if (!student) {
    return null;
  }

  const subjects = Object.keys(groupedQuestions).sort((a, b) => 
    groupedQuestions[b].length - groupedQuestions[a].length
  );

  const displayedQuestions = selectedSubject ? groupedQuestions[selectedSubject] : questions;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Back Button & Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push("/coach/students")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-medium">Öğrencilere Dön</span>
        </button>

        {/* Student Info Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 mb-6">
          <div className="flex items-center gap-4 mb-4">
            {student.photoURL && student.photoURL.trim() !== "" ? (
              <img
                src={student.photoURL}
                alt={student.name}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-green-200 shadow-md"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const fallback = document.createElement('div');
                    fallback.className = 'w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-md';
                    fallback.textContent = student.name.charAt(0).toUpperCase();
                    parent.appendChild(fallback);
                  }
                }}
              />
            ) : (
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-md">
                {student.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-1">{student.name}</h1>
              <p className="text-gray-600 mb-2">{student.email}</p>
              <div className="flex items-center gap-2">
                {student.subscriptionPlan && (
                  <span className={`text-xs px-3 py-1 rounded-full font-bold ${
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
            <div className="text-right">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4">
                <p className="text-xs text-gray-600 mb-1">Toplam Soru</p>
                <p className="text-3xl font-bold text-green-600">{questions.length}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 pt-4 border-t border-gray-200 flex gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/coach/chat?studentId=${studentId}`);
              }}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Mesaj Gönder
            </button>
          </div>
        </div>
      </div>

      {/* Subject Tabs */}
      {subjects.length > 0 && (
        <div className="mb-6">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setSelectedSubject(null)}
                className={`px-4 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${
                  selectedSubject === null
                    ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Tümü ({questions.length})
              </button>
              {subjects.map((subject) => (
                <button
                  key={subject}
                  onClick={() => setSelectedSubject(subject)}
                  className={`px-4 py-2 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                    selectedSubject === subject
                      ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <span>{SUBJECT_ICONS[subject] || "❓"}</span>
                  <span>{subject} ({groupedQuestions[subject].length})</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-4">
        {displayedQuestions.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-12 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-500 font-semibold text-lg">
              {selectedSubject ? `${selectedSubject} dersi için soru yok` : "Henüz soru yok"}
            </p>
          </div>
        ) : (
          displayedQuestions.map((question) => (
            <div
              key={question.id}
              onClick={() => router.push(`/coach/students/${studentId}/question/${question.id}`)}
              className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 hover:shadow-[0_15px_50px_rgba(0,0,0,0.12)] transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
            >
              <div className="flex items-start gap-4">
                {/* Left: Subject Icon */}
                <div className={`w-16 h-16 bg-gradient-to-br ${SUBJECT_COLORS[question.ders] || SUBJECT_COLORS["Bilinmeyen"]} rounded-xl flex items-center justify-center text-3xl shadow-lg flex-shrink-0`}>
                  {SUBJECT_ICONS[question.ders] || "❓"}
                </div>

                {/* Middle: Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-lg mb-1">{question.ders || "Bilinmeyen"}</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    {formatDate(question.createdAt)}
                  </p>
                  <span className={`inline-block text-xs px-3 py-1.5 rounded-full font-bold ${
                    question.status === "solved"
                      ? "bg-green-100 text-green-700"
                      : question.status === "answered"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {question.status === "solved" ? "✓ Çözüldü" : 
                     question.status === "answered" ? "✓ Yanıtlandı" : "⏸ Beklemede"}
                  </span>
                </div>

                {/* Right: Preview Image */}
                {question.soruImgUrl && question.soruImgUrl.trim() !== "" ? (
                  <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-gray-200 shadow-md flex-shrink-0 bg-gray-100 relative">
                    <img
                      src={question.soruImgUrl}
                      alt="Soru önizleme"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200"><svg class="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>';
                        }
                      }}
                    />
                  </div>
                ) : question.pdfUrl ? (
                  <div className="w-24 h-24 rounded-xl border-2 border-gray-200 shadow-md flex-shrink-0 bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center">
                    <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-xl border-2 border-gray-200 shadow-md flex-shrink-0 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
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

