"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { collection, addDoc, Timestamp, query, orderBy, getDocs, doc, updateDoc, arrayUnion, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import HomeHeader from "@/components/HomeHeader";
import SideMenu from "@/components/SideMenu";
import StudentFooter from "@/components/StudentFooter";

interface DestekMesaji {
  id: string;
  konu: string;
  mesaj: string;
  createdAt: Timestamp;
  status: "pending" | "answered" | "closed" | "solved";
  userEmail?: string;
  userName?: string;
  yanit?: string; // Legacy: tek mesaj için backward compatibility
  yanitTarihi?: Timestamp; // Legacy
  attachments?: string[]; // Resim/dosya URL'leri
  yanitAttachments?: string[]; // Legacy: tek mesaj için
  yanitlar?: Array<{ // Yeni: çoklu mesajlar için array
    content: string;
    timestamp: Timestamp;
    attachments?: string[];
    readByStudent?: boolean; // Öğrenci tarafından okundu mu
  }>;
  ogrenciYanit?: string; // Legacy: tek mesaj için backward compatibility
  ogrenciYanitTarihi?: Timestamp; // Legacy
  ogrenciYanitAttachments?: string[]; // Legacy: tek mesaj için
  ogrenciYanitlar?: Array<{ // Yeni: çoklu mesajlar için array
    content: string;
    timestamp: Timestamp;
    attachments?: string[];
    readByAdmin?: boolean; // Admin tarafından okundu mu
  }>;
  readByAdmin?: boolean; // İlk mesaj admin tarafından okundu mu
  readByStudent?: boolean; // Admin yanıtı öğrenci tarafından okundu mu (legacy)
}

function DestekPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [formData, setFormData] = useState({
    konu: "",
    mesaj: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [destekMesajlari, setDestekMesajlari] = useState<DestekMesaji[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>("");
  const [selectedMessage, setSelectedMessage] = useState<DestekMesaji | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [replyText, setReplyText] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [replyFilePreviews, setReplyFilePreviews] = useState<string[]>([]);
  const [replying, setReplying] = useState(false);
  const [uploadingReplyFiles, setUploadingReplyFiles] = useState(false);
  const replyFileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/landing");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    
    // Initial fetch
    fetchDestekMesajlari();
    
    // Set up real-time listener for support messages
    const destekRef = collection(db, "users", user.uid, "destek");
    const q = query(destekRef, orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mesajlar: DestekMesaji[] = [];
      snapshot.forEach((doc) => {
        mesajlar.push({
          id: doc.id,
          ...doc.data(),
        } as DestekMesaji);
      });
      
      setDestekMesajlari(mesajlar);
    });
    
    return () => {
      unsubscribe();
    };
  }, [user]);
  
  // Scroll to bottom function
  const scrollToBottom = () => {
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      // Try scrolling the container directly first (more reliable)
      if (messagesContainerRef.current) {
        const container = messagesContainerRef.current;
        // Check if container is visible (has dimensions) and has scrollable content
        if (container.offsetHeight > 0 && container.scrollHeight > container.offsetHeight) {
          // Force scroll to bottom immediately
          container.scrollTop = container.scrollHeight;
        } else if (container.scrollHeight > 0) {
          // Even if not scrollable yet, try to set scroll position
          container.scrollTop = container.scrollHeight;
        }
        // Also try with delays to ensure it works after layout
        setTimeout(() => {
          if (container.scrollHeight > 0) {
            container.scrollTop = container.scrollHeight;
          }
        }, 50);
        setTimeout(() => {
          if (container.scrollHeight > 0) {
            container.scrollTop = container.scrollHeight;
          }
        }, 150);
      }
      // Also try scrollIntoView as fallback
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "auto", block: "end" });
      }
    });
  };
  
  // Separate effect to update selectedMessage when destekMesajlari changes
  useEffect(() => {
    if (selectedMessage && destekMesajlari.length > 0) {
      const updated = destekMesajlari.find(m => m.id === selectedMessage.id);
      if (updated) {
        console.log("🟢 [STUDENT REAL-TIME] Updating selectedMessage with new data");
        console.log("  - updated.yanitlar:", updated.yanitlar);
        console.log("  - updated.yanit:", updated.yanit);
        console.log("  - updated.yanitlar length:", updated.yanitlar?.length || 0);
        setSelectedMessage(updated);
        // Scroll to bottom after update - use multiple timeouts to ensure it works
        setTimeout(() => scrollToBottom(), 200);
        setTimeout(() => scrollToBottom(), 400);
        setTimeout(() => scrollToBottom(), 600);
        setTimeout(() => scrollToBottom(), 800);
      }
    }
  }, [destekMesajlari]);

  // Auto-scroll to bottom when selectedMessage changes
  useEffect(() => {
    if (selectedMessage) {
      // Wait for messages to render, then scroll - use more aggressive approach
      const scroll = () => {
        if (messagesContainerRef.current) {
          const container = messagesContainerRef.current;
          // Check if container is visible and has content
          if (container.offsetHeight > 0 && container.scrollHeight > 0) {
            container.scrollTop = container.scrollHeight;
          }
        }
      };
      // Use longer delays to ensure container is fully rendered
      setTimeout(scroll, 200);
      setTimeout(scroll, 400);
      setTimeout(scroll, 600);
      setTimeout(scroll, 800);
      setTimeout(scroll, 1000);
      setTimeout(scroll, 1200);
    }
  }, [selectedMessage]);

  // URL'den mesaj seçimi (bildirimden geldiğinde)
  useEffect(() => {
    const supportId = searchParams.get('supportId');
    
    if (supportId && destekMesajlari.length > 0) {
      const message = destekMesajlari.find(m => m.id === supportId);
      if (message) {
        setSelectedMessage(message);
        
        // Scroll to bottom after selecting message - use multiple timeouts to ensure it works
        setTimeout(() => scrollToBottom(), 200);
        setTimeout(() => scrollToBottom(), 400);
        setTimeout(() => scrollToBottom(), 600);
        setTimeout(() => scrollToBottom(), 800);
        setTimeout(() => scrollToBottom(), 1000);
        setTimeout(() => scrollToBottom(), 1200);
        
        // Mark admin messages as read by student when opened
        const markAdminMessagesAsRead = async () => {
          try {
            if (!user) return;
            const destekRef = doc(db, "users", user.uid, "destek", supportId);
            const destekSnap = await getDoc(destekRef);
            
            if (destekSnap.exists()) {
              const data = destekSnap.data();
              
              // Mark admin replies as read by student
              if (data.yanitlar && Array.isArray(data.yanitlar)) {
                const updatedYanitlar = data.yanitlar.map((yanit: any) => ({
                  ...yanit,
                  readByStudent: yanit.readByStudent || true, // Mark as read
                }));
                await updateDoc(destekRef, { yanitlar: updatedYanitlar });
              } else if (data.yanit && !data.readByStudent) {
                // Legacy single field
                await updateDoc(destekRef, { readByStudent: true });
              }
            }
          } catch (error) {
            console.error("Mesaj okunma durumu güncelleme hatası:", error);
          }
        };
        
        markAdminMessagesAsRead();
        
        // URL'yi temizle
        const url = new URL(window.location.href);
        url.searchParams.delete('supportId');
        window.history.replaceState({}, '', url.pathname);
      }
    }
  }, [destekMesajlari, searchParams, user]);

  // Scroll to top button visibility
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY || document.documentElement.scrollTop;
      setShowScrollTop(scrollPosition > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const fetchDestekMesajlari = async () => {
    if (!user) return;

    try {
      setLoadingMessages(true);
      const destekRef = collection(db, "users", user.uid, "destek");
      const q = query(destekRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);

      const mesajlar: DestekMesaji[] = [];
      querySnapshot.forEach((doc) => {
        mesajlar.push({
          id: doc.id,
          ...doc.data(),
        } as DestekMesaji);
      });

      setDestekMesajlari(mesajlar);
    } catch (error) {
      console.error("Destek mesajları yüklenirken hata:", error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Lütfen giriş yapın.");
      return;
    }

    if (!formData.konu || (!formData.mesaj && selectedFiles.length === 0)) {
      alert("Lütfen konu ve mesaj veya dosya seçin.");
      return;
    }

    try {
      setSubmitting(true);
      setUploadingFiles(true);

      // Upload files first
      const uploadedUrls: string[] = [];
      for (const file of selectedFiles) {
        const formDataUpload = new FormData();
        formDataUpload.append("file", file);

        const uploadResponse = await fetch("/api/cloudinary/upload", {
          method: "POST",
          body: formDataUpload,
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          uploadedUrls.push(uploadData.url);
        }
      }

      // Firestore'a destek mesajını kaydet
      const supportRef = collection(db, "users", user.uid, "destek");
      const supportData: any = {
        konu: formData.konu,
        mesaj: formData.mesaj || "",
        createdAt: Timestamp.now(),
        status: "pending", // pending, answered, closed
        userEmail: userData?.email || user?.email || "",
        userName: userData?.name || user?.displayName || "Kullanıcı",
      };
      
      // Only add attachments if there are any (Firestore doesn't accept undefined)
      if (uploadedUrls.length > 0) {
        supportData.attachments = uploadedUrls;
      }
      
      const newSupportDoc = await addDoc(supportRef, supportData);

      // Admin'e push notification gönder
      try {
        await fetch("/api/admin/send-notification-to-admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Yeni Destek Mesajı",
            body: `${userData?.name || user?.displayName || "Kullanıcı"}: ${formData.konu}`,
            data: {
              type: "support",
              supportId: newSupportDoc.id,
              userId: user.uid,
            },
          }),
        });
      } catch (notifError) {
        console.error("Admin bildirim gönderme hatası:", notifError);
      }

      // Başarı mesajı göster
      setSubmitted(true);
      setFormData({ konu: "", mesaj: "" });
      setSelectedFiles([]);
      setFilePreviews([]);
      
      // Destek mesajlarını yenile
      await fetchDestekMesajlari();
      
      // 5 saniye sonra başarı mesajını gizle
      setTimeout(() => setSubmitted(false), 5000);
    } catch (error) {
      console.error("Destek mesajı gönderilirken hata:", error);
      alert("Mesaj gönderilirken bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setSubmitting(false);
      setUploadingFiles(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Limit to 5 files
    const filesToAdd = files.slice(0, 5 - selectedFiles.length);
    setSelectedFiles(prev => [...prev, ...filesToAdd]);

    // Create previews
    filesToAdd.forEach(file => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFilePreviews(prev => [...prev, e.target?.result as string]);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreviews(prev => [...prev, ""]);
      }
    });
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setFilePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleReplyFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Limit to 5 files
    const filesToAdd = files.slice(0, 5 - replyFiles.length);
    setReplyFiles(prev => [...prev, ...filesToAdd]);

    // Create previews
    filesToAdd.forEach(file => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setReplyFilePreviews(prev => [...prev, e.target?.result as string]);
        };
        reader.readAsDataURL(file);
      } else {
        setReplyFilePreviews(prev => [...prev, ""]);
      }
    });
  };

  const removeReplyFile = (index: number) => {
    setReplyFiles(prev => prev.filter((_, i) => i !== index));
    setReplyFilePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const formatTarih = (date: Date) => {
    return date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedMessage) return;

    if (!replyText.trim() && replyFiles.length === 0) {
      alert("Lütfen mesaj veya dosya ekleyin.");
      return;
    }

    try {
      setReplying(true);
      setUploadingReplyFiles(true);

      // Upload files first
      const uploadedUrls: string[] = [];
      for (const file of replyFiles) {
        const formDataUpload = new FormData();
        formDataUpload.append("file", file);

        const uploadResponse = await fetch("/api/cloudinary/upload", {
          method: "POST",
          body: formDataUpload,
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          uploadedUrls.push(uploadData.url);
        }
      }

      const destekRef = doc(db, "users", user.uid, "destek", selectedMessage.id);
      
      // Create new reply object
      const newReply = {
        content: replyText.trim() || "",
        timestamp: Timestamp.now(),
        attachments: uploadedUrls.length > 0 ? uploadedUrls : [],
      };
      
      // Use arrayUnion to add to ogrenciYanitlar array (preserves existing messages)
      const updateData: any = {
        ogrenciYanitlar: arrayUnion(newReply),
      };
      
      // Also update legacy single ogrenciYanit field for backward compatibility
      updateData.ogrenciYanit = replyText.trim() || "";
      updateData.ogrenciYanitTarihi = Timestamp.now();
      if (uploadedUrls.length > 0) {
        updateData.ogrenciYanitAttachments = uploadedUrls;
      }
      
      await updateDoc(destekRef, updateData);

      // Update local state
      const newReplyForState = {
        content: replyText.trim() || "",
        timestamp: Timestamp.now(),
        attachments: uploadedUrls.length > 0 ? uploadedUrls : [],
        readByAdmin: false, // Admin henüz okumadı
      };
      
      const updatedMessage: DestekMesaji = {
        ...selectedMessage,
      };
      
      // Add to ogrenciYanitlar array or create new array
      if (selectedMessage.ogrenciYanitlar && Array.isArray(selectedMessage.ogrenciYanitlar)) {
        updatedMessage.ogrenciYanitlar = [...selectedMessage.ogrenciYanitlar, newReplyForState];
      } else {
        updatedMessage.ogrenciYanitlar = [newReplyForState];
      }
      
      // Also update legacy fields for backward compatibility
      updatedMessage.ogrenciYanit = replyText.trim() || "";
      updatedMessage.ogrenciYanitTarihi = Timestamp.now();
      if (uploadedUrls.length > 0) {
        updatedMessage.ogrenciYanitAttachments = uploadedUrls;
      }
      
      // Update messages list first
      // Update messages list first
      const updatedDestekMesajlari = destekMesajlari.map(msg =>
        msg.id === selectedMessage.id
          ? updatedMessage
          : msg
      );
      setDestekMesajlari(updatedDestekMesajlari);
      
      // Then update selected message to trigger re-render
      setSelectedMessage(updatedMessage);

      // Scroll to bottom to show new message
      setTimeout(() => scrollToBottom(), 200);
      setTimeout(() => scrollToBottom(), 400);
      setTimeout(() => scrollToBottom(), 600);

      // Clear form
      setReplyText("");
      setReplyFiles([]);
      setReplyFilePreviews([]);
    } catch (error) {
      console.error("Cevap gönderme hatası:", error);
      alert("Cevap gönderilirken bir hata oluştu.");
    } finally {
      setReplying(false);
      setUploadingReplyFiles(false);
    }
  };

  if (authLoading || userDataLoading) {
    return (
      <div className="h-screen w-full flex justify-center items-center bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  const konuLabels: { [key: string]: string } = {
    teknik: "Teknik Sorun",
    hesap: "Hesap Sorunu",
    odeme: "Ödeme Sorunu",
    oneriler: "Öneriler",
    diger: "Diğer",
  };

  const statusLabels: { [key: string]: { label: string; color: string; bgColor: string; gradient: string } } = {
    pending: { 
      label: "Beklemede", 
      color: "text-yellow-700", 
      bgColor: "bg-yellow-100",
      gradient: "from-yellow-50 to-orange-50"
    },
    answered: { 
      label: "Yanıtlandı", 
      color: "text-blue-700", 
      bgColor: "bg-blue-100",
      gradient: "from-blue-50 to-cyan-50"
    },
    closed: { 
      label: "Çözüldü", 
      color: "text-green-700", 
      bgColor: "bg-green-100",
      gradient: "from-green-50 to-emerald-50"
    },
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
      <HomeHeader onMenuClick={() => setIsMenuOpen(true)} />
      <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <div className="flex justify-center items-start px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        <div className="w-full max-w-6xl">
          {/* Header */}
          <div className="mb-8 animate-slideFade">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Destek</h1>
            <p className="text-gray-600">Sorularınız, önerileriniz veya sorunlarınız için bizimle iletişime geçin</p>
          </div>

          {/* Success Message - Premium */}
          {submitted && (
            <div className="mb-6 bg-gradient-to-br from-green-50 to-emerald-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(34,197,94,0.2)] border border-green-100 relative overflow-hidden animate-slideFade">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-green-200/30 rounded-full blur-2xl"></div>
              <div className="relative z-10 flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-green-900 text-lg">Mesajınız başarıyla gönderildi!</p>
                  <p className="text-sm text-green-700 font-medium">En kısa sürede size dönüş yapacağız.</p>
                </div>
              </div>
            </div>
          )}

          {/* Contact Info Cards - Premium */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(59,130,246,0.2)] border border-blue-100 relative overflow-hidden group hover:scale-[1.02] transition-all">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-200/30 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-lg">E-posta</h3>
                <p className="text-sm text-gray-700 mb-1 font-medium">destek@sorucoz.com</p>
                <p className="text-xs text-gray-500 font-medium">7/24 destek</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(34,197,94,0.2)] border border-green-100 relative overflow-hidden group hover:scale-[1.02] transition-all">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-green-200/30 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-lg">Canlı Destek</h3>
                <p className="text-sm text-gray-700 mb-1 font-medium">Mesajlar bölümünden</p>
                <p className="text-xs text-gray-500 mb-3 font-medium">Koçunuzla iletişime geçin</p>
                <button
                  onClick={() => router.push("/mesajlar")}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition active:scale-[0.98]"
                >
                  Mesaj Gönder
                </button>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(168,85,247,0.2)] border border-purple-100 relative overflow-hidden group hover:scale-[1.02] transition-all">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-200/30 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-lg">Yanıt Süresi</h3>
                <p className="text-sm text-gray-700 mb-1 font-medium">24 saat içinde</p>
                <p className="text-xs text-gray-500 font-medium">Genellikle daha hızlı</p>
              </div>
            </div>
          </div>

          {/* Contact Form - Premium */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 mb-6 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-200/20 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Bize Ulaşın</h2>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="konu" className="block text-sm font-bold text-gray-700 mb-2">
                    Konu
                  </label>
                  <select
                    id="konu"
                    value={formData.konu}
                    onChange={(e) => setFormData({ ...formData, konu: e.target.value })}
                    className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition shadow-sm hover:shadow-md"
                    required
                  >
                    <option value="">Konu seçin</option>
                    <option value="teknik">Teknik Sorun</option>
                    <option value="hesap">Hesap Sorunu</option>
                    <option value="odeme">Ödeme Sorunu</option>
                    <option value="oneriler">Öneriler</option>
                    <option value="diger">Diğer</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="mesaj" className="block text-sm font-bold text-gray-700 mb-2">
                    Mesajınız
                  </label>
                  <textarea
                    id="mesaj"
                    value={formData.mesaj}
                    onChange={(e) => setFormData({ ...formData, mesaj: e.target.value })}
                    rows={6}
                    className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none shadow-sm hover:shadow-md"
                    placeholder="Sorunuzu veya önerinizi detaylı bir şekilde yazın..."
                  />
                </div>

                {/* File Input */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={selectedFiles.length >= 5 || uploadingFiles}
                    className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-700">
                      {selectedFiles.length >= 5 ? "Maksimum 5 dosya" : "Resim/Dosya Ekle (Maks. 5)"}
                    </span>
                  </button>
                </div>

                {/* File Previews */}
                {filePreviews.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {filePreviews.map((preview, idx) => (
                      <div key={idx} className="relative">
                        {preview ? (
                          <img
                            src={preview}
                            alt={`Preview ${idx + 1}`}
                            className="w-24 h-24 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || uploadingFiles || (!formData.mesaj && selectedFiles.length === 0)}
                  className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-lg"
                >
                  {submitting || uploadingFiles ? "Gönderiliyor..." : "Gönder"}
                </button>
              </form>
            </div>
          </div>

          {/* Destek Mesajları Listesi - Card View */}
          {destekMesajlari.length > 0 && (
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 mb-6 relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-200/20 rounded-full blur-3xl"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 p-6 border-b border-gray-200/50">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Destek Mesajlarım</h2>
                </div>
                {loadingMessages ? (
                  <div className="text-center py-12 text-gray-500 font-medium">Yükleniyor...</div>
                ) : (
                  <div className="p-6 space-y-3">
                    {destekMesajlari.map((mesaj) => {
                      const statusInfo = statusLabels[mesaj.status] || statusLabels.pending;
                      const mesajTarih = mesaj.createdAt?.toDate?.() || new Date(mesaj.createdAt?.seconds * 1000);
                      
                      const formatTarih = (date: Date) => {
                        const now = new Date();
                        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

                        if (messageDate.getTime() === today.getTime()) {
                          return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
                        } else {
                          return date.toLocaleDateString("tr-TR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                        }
                      };

                      const previewText = mesaj.mesaj?.substring(0, 100) || (mesaj.attachments && mesaj.attachments.length > 0 ? `${mesaj.attachments.length} dosya eklendi` : "Mesaj yok");
                      const hasReply = !!mesaj.yanit;

                      return (
                        <button
                          key={mesaj.id}
                          onClick={() => setSelectedMessage(mesaj)}
                          className="w-full text-left bg-white hover:bg-gray-50 rounded-xl p-4 border border-gray-200 hover:border-blue-300 transition-all shadow-sm hover:shadow-md"
                        >
                          <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              mesaj.status === "pending" 
                                ? "bg-gradient-to-br from-yellow-400 to-orange-500" 
                                : mesaj.status === "answered" 
                                ? "bg-gradient-to-br from-blue-400 to-cyan-500"
                                : "bg-gradient-to-br from-green-400 to-emerald-500"
                            }`}>
                              {mesaj.status === "pending" ? "⏳" : mesaj.status === "answered" ? "✓" : "✓"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <h3 className="font-bold text-gray-900 text-base truncate">
                                  {konuLabels[mesaj.konu] || mesaj.konu}
                                </h3>
                                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ml-2 flex-shrink-0 ${statusInfo.bgColor} ${statusInfo.color}`}>
                                  {statusInfo.label}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 truncate mb-1">
                                {previewText}{mesaj.mesaj && mesaj.mesaj.length > 100 ? "..." : ""}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                <span>{formatTarih(mesajTarih)}</span>
                                {hasReply && (
                                  <>
                                    <span>•</span>
                                    <span className="text-blue-600 font-medium">Yanıtlandı</span>
                                  </>
                                )}
                                {mesaj.attachments && mesaj.attachments.length > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                      {mesaj.attachments.length} dosya
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Message Detail Modal */}
          {selectedMessage && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setSelectedMessage(null)}
            >
              <div
                className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setSelectedMessage(null)}
                        className="w-10 h-10 rounded-full hover:bg-white/80 flex items-center justify-center transition"
                      >
                        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">
                          {konuLabels[selectedMessage.konu] || selectedMessage.konu}
                        </h2>
                        <span className={`text-xs px-3 py-1 rounded-full font-semibold mt-1 inline-block ${
                          statusLabels[selectedMessage.status].bgColor
                        } ${statusLabels[selectedMessage.status].color}`}>
                          {statusLabels[selectedMessage.status].label}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content - WhatsApp Style Chronological Messages */}
                <div 
                  ref={messagesContainerRef}
                  className="flex-1 overflow-y-auto p-4 bg-[#f0f2f5]"
                >
                  {(() => {
                    // Create a flat array of all messages in chronological order
                    const allMessages: Array<{
                      type: 'user' | 'admin';
                      timestamp: Date;
                      content: string;
                      attachments?: string[];
                      readByAdmin?: boolean; // Admin tarafından okundu mu (öğrenci mesajları için)
                      readByStudent?: boolean; // Öğrenci tarafından okundu mu (admin mesajları için)
                    }> = [];

                    // Add user's initial message
                    if (selectedMessage.mesaj || (selectedMessage.attachments && selectedMessage.attachments.length > 0)) {
                      allMessages.push({
                        type: 'user',
                        timestamp: selectedMessage.createdAt?.toDate?.() || new Date(selectedMessage.createdAt?.seconds * 1000),
                        content: selectedMessage.mesaj || '',
                        attachments: selectedMessage.attachments,
                        readByAdmin: selectedMessage.readByAdmin || false, // Admin okudu mu
                      });
                    }

                    // Add admin replies (from array or legacy field)
                    console.log("🔵 [STUDENT VIEW] selectedMessage.yanitlar:", selectedMessage.yanitlar);
                    console.log("🔵 [STUDENT VIEW] selectedMessage.yanit:", selectedMessage.yanit);
                    console.log("🔵 [STUDENT VIEW] selectedMessage object:", selectedMessage);
                    
                    if (selectedMessage.yanitlar && Array.isArray(selectedMessage.yanitlar) && selectedMessage.yanitlar.length > 0) {
                      // New array format
                      console.log("✅ [STUDENT VIEW] Found yanitlar array with", selectedMessage.yanitlar.length, "messages");
                      selectedMessage.yanitlar.forEach((yanit: any, index: number) => {
                        console.log(`  - Admin reply ${index + 1}:`, yanit.content?.substring(0, 50) || "no content", "timestamp:", yanit.timestamp);
                        allMessages.push({
                          type: 'admin',
                          timestamp: yanit.timestamp?.toDate?.() || (yanit.timestamp ? new Date(yanit.timestamp.seconds * 1000) : new Date()),
                          content: yanit.content || '',
                          attachments: yanit.attachments || [],
                          readByStudent: yanit.readByStudent || false, // Öğrenci okudu mu
                        });
                      });
                    } else if (selectedMessage.yanit || (selectedMessage.yanitAttachments && selectedMessage.yanitAttachments.length > 0)) {
                      // Legacy single field format
                      console.log("⚠️ [STUDENT VIEW] Using legacy yanit field");
                      allMessages.push({
                        type: 'admin',
                        timestamp: selectedMessage.yanitTarihi?.toDate?.() || (selectedMessage.yanitTarihi ? new Date(selectedMessage.yanitTarihi.seconds * 1000) : new Date()),
                        content: selectedMessage.yanit || '',
                        attachments: selectedMessage.yanitAttachments || [],
                        readByStudent: selectedMessage.readByStudent || false, // Öğrenci okudu mu
                      });
                    } else {
                      console.log("❌ [STUDENT VIEW] No admin replies found");
                    }
                    
                    console.log("🔵 [STUDENT VIEW] Total allMessages after admin replies:", allMessages.length);

                    // Add student replies (from array or legacy field)
                    if (selectedMessage.ogrenciYanitlar && Array.isArray(selectedMessage.ogrenciYanitlar) && selectedMessage.ogrenciYanitlar.length > 0) {
                      // New array format
                      selectedMessage.ogrenciYanitlar.forEach((ogrenciYanit: any) => {
                        allMessages.push({
                          type: 'user',
                          timestamp: ogrenciYanit.timestamp?.toDate?.() || (ogrenciYanit.timestamp ? new Date(ogrenciYanit.timestamp.seconds * 1000) : new Date()),
                          content: ogrenciYanit.content || '',
                          attachments: ogrenciYanit.attachments || [],
                          readByAdmin: ogrenciYanit.readByAdmin || false, // Admin okudu mu
                        });
                      });
                    } else if (selectedMessage.ogrenciYanit || (selectedMessage.ogrenciYanitAttachments && selectedMessage.ogrenciYanitAttachments.length > 0)) {
                      // Legacy single field format
                      allMessages.push({
                        type: 'user',
                        timestamp: selectedMessage.ogrenciYanitTarihi?.toDate?.() || (selectedMessage.ogrenciYanitTarihi ? new Date(selectedMessage.ogrenciYanitTarihi.seconds * 1000) : new Date()),
                        content: selectedMessage.ogrenciYanit || '',
                        attachments: selectedMessage.ogrenciYanitAttachments || [],
                        readByAdmin: false, // Admin okudu mu (legacy için varsayılan false)
                      });
                    }

                    // Sort chronologically (oldest first)
                    allMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

                    const userPhoto = userData?.photoURL || user?.photoURL || null;
                    const userName = userData?.name || user?.displayName || "Kullanıcı";

                    return allMessages.map((msg, index) => {
                      const prevMsg = index > 0 ? allMessages[index - 1] : null;
                      const showAvatar = !prevMsg || prevMsg.type !== msg.type;
                      const uniqueKey = `${msg.type}-${msg.timestamp.getTime()}-${index}`;

                      if (msg.type === 'user') {
                        return (
                          <div key={uniqueKey} className="flex items-end gap-2 mb-3">
                            {showAvatar ? (
                              userPhoto ? (
                                <img
                                  src={userPhoto}
                                  alt={userName}
                                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                                  <span className="text-white font-semibold text-xs">
                                    {userName.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )
                            ) : (
                              <div className="w-8 flex-shrink-0" />
                            )}
                            <div className="flex flex-col max-w-[75%]">
                              {showAvatar && (
                                <span className="text-[11px] font-medium mb-1 text-gray-500 px-1">
                                  {userName}
                                </span>
                              )}
                              <div className="bg-white rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm">
                                {msg.attachments && msg.attachments.length > 0 && (
                                  <div className="grid grid-cols-2 gap-2 mb-2">
                                    {msg.attachments.map((url, idx) => (
                                      <button
                                        key={idx}
                                        onClick={() => {
                                          setSelectedImageUrl(url);
                                          setImageViewerOpen(true);
                                        }}
                                        className="rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition"
                                      >
                                        <img
                                          src={url}
                                          alt={`Ek ${idx + 1}`}
                                          className="w-full h-32 object-cover"
                                        />
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {msg.content && (
                                  <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap break-words">
                                    {msg.content}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 mt-1 px-1">
                                <span className="text-[10px] text-gray-400">
                                  {formatTarih(msg.timestamp)}
                                </span>
                                {/* Read receipt for student messages */}
                                {msg.type === 'user' && (
                                  <span className={`text-[11px] ${msg.readByAdmin ? 'text-blue-500' : 'text-gray-400'}`}>
                                    {msg.readByAdmin ? '✓✓' : '✓'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      } else {
                        // Admin message
                        const uniqueKey = `${msg.type}-${msg.timestamp.getTime()}-${index}`;
                        return (
                          <div key={uniqueKey} className="flex items-end gap-2 mb-3 justify-end">
                            <div className="flex flex-col max-w-[75%] items-end">
                              {showAvatar && (
                                <span className="text-[11px] font-medium mb-1 text-gray-500 px-1">
                                  Admin
                                </span>
                              )}
                              <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 shadow-sm">
                                {msg.attachments && msg.attachments.length > 0 && (
                                  <div className="grid grid-cols-2 gap-2 mb-2">
                                    {msg.attachments.map((url, idx) => (
                                      <button
                                        key={idx}
                                        onClick={() => {
                                          setSelectedImageUrl(url);
                                          setImageViewerOpen(true);
                                        }}
                                        className="rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition"
                                      >
                                        <img
                                          src={url}
                                          alt={`Ek ${idx + 1}`}
                                          className="w-full h-32 object-cover"
                                        />
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {msg.content && (
                                  <p className="text-white text-sm leading-relaxed whitespace-pre-wrap break-words">
                                    {msg.content}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 mt-1 px-1 justify-end">
                                <span className="text-[10px] text-gray-400">
                                  {formatTarih(msg.timestamp)}
                                </span>
                                {/* Read receipt for admin messages */}
                                {msg.type === 'admin' && (
                                  <span className={`text-[11px] ${msg.readByStudent ? 'text-blue-500' : 'text-gray-400'}`}>
                                    {msg.readByStudent ? '✓✓' : '✓'}
                                  </span>
                                )}
                              </div>
                            </div>
                            {showAvatar ? (
                              <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                                <span className="text-white font-semibold text-xs">A</span>
                              </div>
                            ) : (
                              <div className="w-8 flex-shrink-0" />
                            )}
                          </div>
                        );
                      }
                    });
                  })()}
                  <div ref={messagesEndRef} />
                </div>

                {/* Footer - Reply Form (only if not closed/solved) */}
                {selectedMessage.status !== "closed" && selectedMessage.status !== "solved" && (
                  <div className="p-6 border-t border-gray-200 bg-gray-50">
                    <form onSubmit={handleReply} className="space-y-4">
                      <div>
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              if (replyText.trim() || replyFiles.length > 0) {
                                handleReply(e);
                              }
                            }
                          }}
                          placeholder="Mesajınızı yazın... (Enter ile gönder)"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          rows={3}
                        />
                      </div>

                      {/* File Previews */}
                      {replyFilePreviews.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {replyFilePreviews.map((preview, idx) => (
                            <div key={idx} className="relative">
                              {preview ? (
                                <img
                                  src={preview}
                                  alt={`Preview ${idx + 1}`}
                                  className="w-20 h-20 object-cover rounded-lg"
                                />
                              ) : (
                                <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => removeReplyFile(idx)}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <input
                          type="file"
                          ref={replyFileInputRef}
                          onChange={handleReplyFileSelect}
                          multiple
                          accept="image/*,.pdf,.doc,.docx"
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => replyFileInputRef.current?.click()}
                          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition text-gray-700 font-medium"
                          disabled={replyFiles.length >= 5}
                        >
                          📎 Dosya Ekle ({replyFiles.length}/5)
                        </button>
                        <button
                          type="submit"
                          disabled={replying || uploadingReplyFiles || (!replyText.trim() && replyFiles.length === 0)}
                          className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {replying || uploadingReplyFiles ? "Gönderiliyor..." : "Cevap Gönder"}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
                {selectedMessage.status === "closed" && (
                  <div className="p-6 border-t border-gray-200 bg-green-50">
                    <p className="text-sm text-green-700 font-medium text-center">
                      ✓ Bu destek mesajı çözüldü olarak işaretlenmiştir. Yeni bir destek mesajı oluşturmak için yukarıdaki formu kullanabilirsiniz.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* FAQ Section - Premium */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-200/20 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Sık Sorulan Sorular</h2>
              </div>
              <div className="space-y-5">
                <div className="border-b border-gray-200 pb-5 group">
                  <h3 className="font-bold text-gray-900 mb-2 text-lg group-hover:text-blue-600 transition">Soru nasıl sorulur?</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Ana sayfadaki "Soru Sor" butonuna tıklayarak veya menüden "Soru Sor" seçeneğini kullanarak sorunuzu yükleyebilirsiniz. Sorunuz otomatik olarak analiz edilir ve çözümü adım adım gösterilir.
                  </p>
                </div>
                <div className="border-b border-gray-200 pb-5 group">
                  <h3 className="font-bold text-gray-900 mb-2 text-lg group-hover:text-blue-600 transition">Günlük soru limiti nedir?</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Trial planında günde 3 soru, Lite planında günde 10 soru, Premium planında ise sınırsız soru sorabilirsiniz.
                  </p>
                </div>
                <div className="border-b border-gray-200 pb-5 group">
                  <h3 className="font-bold text-gray-900 mb-2 text-lg group-hover:text-blue-600 transition">Plan nasıl değiştirilir?</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Profil sayfasından veya "Premium" menüsünden planınızı görüntüleyebilir ve yükseltebilirsiniz.
                  </p>
                </div>
                <div className="group">
                  <h3 className="font-bold text-gray-900 mb-2 text-lg group-hover:text-blue-600 transition">Sorunum çözülmedi, ne yapmalıyım?</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Mesajlar bölümünden koçunuzla iletişime geçebilir veya yukarıdaki formu kullanarak destek ekibimize ulaşabilirsiniz.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll to Top Button */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={`fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-[0_10px_30px_rgba(59,130,246,0.4)] flex items-center justify-center transition-all duration-300 ${
          showScrollTop
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-4 scale-90 pointer-events-none"
        } active:scale-95 hover:shadow-[0_15px_40px_rgba(59,130,246,0.5)]`}
        aria-label="Yukarı git"
      >
        <svg
          className="w-6 h-6 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M5 10l7-7m0 0l7 7m-7-7v18"
          />
        </svg>
      </button>

      {/* Image Viewer Modal */}
      {imageViewerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setImageViewerOpen(false)}
        >
          <div className="relative max-w-7xl max-h-[90vh] w-full mx-4">
            <button
              onClick={() => setImageViewerOpen(false)}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition"
            >
              <svg className="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={selectedImageUrl}
              alt="Görüntüle"
              className="w-full h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
      
      <StudentFooter />
    </div>
  );
}

export default function DestekPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    }>
      <DestekPageContent />
    </Suspense>
  );
}
