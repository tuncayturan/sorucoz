"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast from "@/components/ui/Toast";
import Image from "next/image";

interface Question {
  id: string;
  ders: string;
  status: "pending" | "answered" | "solved";
  createdAt: any;
  soruImgUrl?: string; // Soru görseli
  pdfUrl?: string;
  solution?: {
    steps: Array<{ step: number; explanation: string; calculation?: string }>;
    finalAnswer: string;
  } | null;
  coachNotes?: string;
  updatedAt?: any;
}

interface Student {
  name: string;
  email: string;
  photoURL?: string | null;
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

export default function QuestionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;
  const questionId = params.questionId as string;
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();
  const [student, setStudent] = useState<Student | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
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

  // Fetch question data
  useEffect(() => {
    if (!user || userData?.role !== "coach" || !studentId || !questionId) return;
    fetchQuestionData();
  }, [user, userData, studentId, questionId]);

  const fetchQuestionData = async () => {
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

      setStudent(studentSnap.data() as Student);

      // Soru bilgilerini al
      const questionRef = doc(db, "users", studentId, "sorular", questionId);
      const questionSnap = await getDoc(questionRef);

      if (!questionSnap.exists()) {
        showToast("Soru bulunamadı!", "error");
        router.push(`/coach/students/${studentId}`);
        return;
      }

      setQuestion({
        id: questionSnap.id,
        ...questionSnap.data(),
      } as Question);
    } catch (error) {
      console.error("Soru verileri yüklenirken hata:", error);
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

  if (!question || !student) {
    return null;
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back Button & Actions */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => router.push(`/coach/students/${studentId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-medium">{student.name} - Sorulara Dön</span>
        </button>
        <button
          onClick={() => router.push(`/coach/chat?studentId=${studentId}`)}
          className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:shadow-lg transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Mesaj Gönder
        </button>
      </div>

      {/* Question Header */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 bg-gradient-to-br ${SUBJECT_COLORS[question.ders] || SUBJECT_COLORS["Bilinmeyen"]} rounded-xl flex items-center justify-center text-3xl shadow-lg`}>
              {SUBJECT_ICONS[question.ders] || "❓"}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{question.ders || "Bilinmeyen"}</h1>
              <p className="text-sm text-gray-600">{formatDate(question.createdAt)}</p>
            </div>
          </div>
          <span className={`text-sm px-4 py-2 rounded-full font-bold ${
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

        {/* Student Info */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
          {student.photoURL ? (
            <img
              src={student.photoURL}
              alt={student.name}
              className="w-10 h-10 rounded-full object-cover border-2 border-green-200"
            />
          ) : (
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
              {student.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900">{student.name}</p>
            <p className="text-xs text-gray-600">{student.email}</p>
          </div>
        </div>
      </div>

      {/* Question Image/PDF */}
      {(question.soruImgUrl || question.pdfUrl) && (
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Soru Görseli</h2>
          {question.soruImgUrl && (
            <div className="relative w-full rounded-2xl overflow-hidden bg-gray-100">
              <img
                src={question.soruImgUrl}
                alt="Soru"
                className="w-full h-auto max-h-[600px] object-contain"
              />
            </div>
          )}
          {question.pdfUrl && (
            <a
              href={question.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold mt-4"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              PDF'i Görüntüle
            </a>
          )}
        </div>
      )}

      {/* Solution Steps */}
      {question.solution && question.solution.steps && question.solution.steps.length > 0 && (
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
              <span className="text-2xl">📝</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Çözüm Adımları</h2>
          </div>
          <div className="space-y-4">
            {question.solution.steps.map((step, index) => (
              <div
                key={index}
                className="flex gap-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0">
                  {step.step || index + 1}
                </div>
                <div className="flex-1">
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap font-medium">
                    {step.explanation}
                  </p>
                  {step.calculation && (
                    <div className="mt-2 p-3 bg-white/60 rounded-xl border border-blue-200">
                      <p className="text-sm text-gray-700 font-mono">{step.calculation}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Final Answer */}
      {question.solution?.finalAnswer && (
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Son Cevap</h2>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-6 border-2 border-yellow-200">
            <p className="text-gray-900 font-bold text-xl whitespace-pre-wrap">
              {question.solution.finalAnswer}
            </p>
          </div>
        </div>
      )}

      {/* Coach Notes */}
      {question.coachNotes && (
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center">
              <span className="text-2xl">👨‍🏫</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Coach Notları</h2>
          </div>
          <div className="whitespace-pre-wrap text-gray-700 leading-relaxed bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-100">
            {question.coachNotes}
          </div>
        </div>
      )}

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </div>
  );
}

