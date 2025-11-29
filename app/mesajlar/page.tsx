"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { 
  collection, 
  addDoc, 
  Timestamp, 
  query, 
  orderBy, 
  onSnapshot,
  limit,
  serverTimestamp,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  where,
  setDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import HomeHeader from "@/components/HomeHeader";
import SideMenu from "@/components/SideMenu";
import Toast from "@/components/ui/Toast";
import Image from "next/image";
import StudentFooter from "@/components/StudentFooter";

interface Mesaj {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string | null;
  createdAt: Timestamp;
  read: boolean;
  type: "user" | "coach" | "admin";
  attachments?: string[];
  readByCoach?: boolean;
  readByStudent?: boolean;
}

interface Conversation {
  id: string;
  studentId: string;
  coachId: string;
  coachName: string;
  coachPhoto?: string | null;
  coachTitle?: string | null; // Coach ünvanı
  lastMessage?: Timestamp;
  lastMessageText?: string;
  unreadCount: number;
}

export default function MesajlarPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [mesajlar, setMesajlar] = useState<Mesaj[]>([]);
  const [yeniMesaj, setYeniMesaj] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get or create conversation ID
  const getConversationId = (studentId: string, coachId: string) => {
    // Sıralı ID oluştur (tutarlılık için)
    return [studentId, coachId].sort().join("_");
  };

  // Get or create conversation
  const getOrCreateConversation = async (coachId: string, coachName: string, coachPhoto?: string | null) => {
    if (!user) return null;
    
    const conversationId = getConversationId(user.uid, coachId);
    const conversationRef = doc(db, "conversations", conversationId);
    
    try {
      const conversationSnap = await getDoc(conversationRef);
      
      if (!conversationSnap.exists()) {
        // Create new conversation with correct IDs
        await setDoc(conversationRef, {
          studentId: user.uid,
          coachId: coachId, // Ensure correct coachId is saved
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Ensure coachId is correct even if conversation exists
        const existingData = conversationSnap.data();
        if (existingData.coachId !== coachId) {
          // Update coachId if it's wrong (shouldn't happen, but safety check)
          await updateDoc(conversationRef, {
            coachId: coachId,
            updatedAt: serverTimestamp(),
          });
        }
      }
      
      return conversationId;
    } catch (error) {
      console.error("Conversation oluşturulurken hata:", error);
      return null;
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth/login");
    }
  }, [user, authLoading, router]);

  // Fetch all coaches and their conversations
  useEffect(() => {
    if (!user || userData?.role !== "student") return;

    const fetchConversations = async () => {
      try {
        setLoading(true);
        
        // Get all coaches
        const coachesQuery = query(collection(db, "users"), where("role", "==", "coach"));
        const coachesSnapshot = await getDocs(coachesQuery);
        
        const conversationsList: Conversation[] = [];
        
        for (const coachDoc of coachesSnapshot.docs) {
          const coachId = coachDoc.id;
          const coachData = coachDoc.data();
          const conversationId = getConversationId(user.uid, coachId);
          
          // Check if conversation exists
          const conversationRef = doc(db, "conversations", conversationId);
          const conversationSnap = await getDoc(conversationRef);

          // Get unread count - fetch all messages and filter client-side to avoid index requirement
          const messagesRef = collection(db, "conversations", conversationId, "messages");
          const allMessagesSnapshot = await getDocs(messagesRef);
          const unreadCount = allMessagesSnapshot.docs.filter(doc => {
            const data = doc.data();
            return !data.readByStudent && data.senderId !== user.uid;
          }).length;

          // Get last message
          const lastMessageQuery = query(
            messagesRef,
            orderBy("createdAt", "desc"),
            limit(1)
          );
          const lastMessageSnapshot = await getDocs(lastMessageQuery);
          
          let lastMessage: Timestamp | undefined;
          let lastMessageText: string | undefined;
          
          if (!lastMessageSnapshot.empty) {
            const lastMsg = lastMessageSnapshot.docs[0].data();
            lastMessage = lastMsg.createdAt;
            lastMessageText = lastMsg.text || "Dosya gönderildi";
          }
          
          conversationsList.push({
            id: conversationId,
            studentId: user.uid,
            coachId: coachId,
            coachName: coachData.name || "Coach",
            coachPhoto: coachData.photoURL || null,
            coachTitle: coachData.title || null, // Coach ünvanı
            lastMessage,
            lastMessageText,
            unreadCount,
          });
        }
        
        // Sort by last message time
        conversationsList.sort((a, b) => {
          if (!a.lastMessage && !b.lastMessage) return 0;
          if (!a.lastMessage) return 1;
          if (!b.lastMessage) return -1;
          const aTime = a.lastMessage.toDate?.()?.getTime() || 0;
          const bTime = b.lastMessage.toDate?.()?.getTime() || 0;
          return bTime - aTime;
        });
        
        setConversations(conversationsList);
        setLoading(false);
      } catch (error) {
        console.error("Conversations yüklenirken hata:", error);
        setLoading(false);
    }
    };

    fetchConversations();

    // Real-time conversation updates
    const unsubscribeFunctions: (() => void)[] = [];
    
    const setupRealtimeListeners = async () => {
      const coachesQuery = query(collection(db, "users"), where("role", "==", "coach"));
      const coachesSnapshot = await getDocs(coachesQuery);
      
      coachesSnapshot.docs.forEach((coachDoc) => {
        const coachId = coachDoc.id;
        const conversationId = getConversationId(user.uid, coachId);
        
        // Listen to messages
        const messagesRef = collection(db, "conversations", conversationId, "messages");
        const messagesQuery = query(messagesRef, orderBy("createdAt", "desc"), limit(1));
        
        const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
          setConversations((prev) => {
            const updated = [...prev];
            const index = updated.findIndex((c) => c.id === conversationId);
            
            if (!snapshot.empty) {
              const lastMsg = snapshot.docs[0].data();
              if (index >= 0) {
                updated[index] = {
                  ...updated[index],
                  lastMessage: lastMsg.createdAt,
                  lastMessageText: lastMsg.text || "Dosya gönderildi",
              };
            }
            }
            
            // Re-sort
            updated.sort((a, b) => {
              if (!a.lastMessage && !b.lastMessage) return 0;
              if (!a.lastMessage) return 1;
              if (!b.lastMessage) return -1;
              const aTime = a.lastMessage.toDate?.()?.getTime() || 0;
              const bTime = b.lastMessage.toDate?.()?.getTime() || 0;
              return bTime - aTime;
            });
            
            return updated;
          });
        });
        
        unsubscribeFunctions.push(unsubscribe);
      });
    };

    setupRealtimeListeners();

    return () => {
      unsubscribeFunctions.forEach((unsub) => unsub());
    };
  }, [user, userData]);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConversation || !user) return;

    const messagesRef = collection(db, "conversations", selectedConversation.id, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const mesajListesi: Mesaj[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          mesajListesi.push({
            id: doc.id,
            ...data,
          } as Mesaj);
        });
        setMesajlar(mesajListesi);

        // Mark messages as read
        const unreadMessages = mesajListesi.filter(
          (m) => !m.readByStudent && m.senderId !== user.uid
        );
        if (unreadMessages.length > 0) {
          unreadMessages.forEach((msg) => {
            updateDoc(doc(db, "conversations", selectedConversation.id, "messages", msg.id), {
              readByStudent: true,
            }).catch(console.error);
          });
          
          // Update unread count
          setConversations((prev) =>
            prev.map((c) =>
              c.id === selectedConversation.id
                ? { ...c, unreadCount: 0 }
                : c
            )
          );
        }
      },
      (error) => {
        console.error("Mesajlar yüklenirken hata:", error);
      }
    );

    return () => unsubscribe();
  }, [selectedConversation, user]);

  // Auto-scroll to bottom when messages load or change
  useEffect(() => {
    if (mesajlar.length > 0 && !loading) {
      // Sadece bir kez scroll yap, kısa bir gecikme ile
      const timeoutId = setTimeout(() => scrollToBottom(), 100);
      return () => clearTimeout(timeoutId);
    }
  }, [mesajlar, loading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "48px";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [yeniMesaj]);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      // Sadece scrollTop kullan, tek seferde scroll yap
      container.scrollTop = container.scrollHeight;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 5) {
      alert("Maksimum 5 dosya seçebilirsiniz");
      return;
    }
    
    const invalidFiles = files.filter(file => {
      const isImage = file.type.startsWith("image/");
      const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      return !isImage && !isPDF;
    });
    
    if (invalidFiles.length > 0) {
      alert("Sadece resim ve PDF dosyaları yüklenebilir");
      return;
    }
    
    setSelectedFiles([...selectedFiles, ...files]);
    
    const newPreviews: string[] = [];
    files.forEach(file => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          newPreviews.push(e.target?.result as string);
          setFilePreviews([...filePreviews, ...newPreviews]);
        };
        reader.readAsDataURL(file);
      } else {
        newPreviews.push("");
        setFilePreviews([...filePreviews, ...newPreviews]);
      }
    });
  };

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
    setFilePreviews(filePreviews.filter((_, i) => i !== index));
  };

  const handleGonder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedConversation || (!yeniMesaj.trim() && selectedFiles.length === 0) || gonderiliyor) return;

    try {
      setGonderiliyor(true);
      setUploadingFiles(true);

      // Upload files first
      const uploadedUrls: string[] = [];
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append("file", file);

        const uploadResponse = await fetch("/api/cloudinary/upload", {
          method: "POST",
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          uploadedUrls.push(uploadData.url);
        }
      }

      // Ensure conversation exists
      await getOrCreateConversation(
        selectedConversation.coachId,
        selectedConversation.coachName,
        selectedConversation.coachPhoto
      );

      const messagesRef = collection(db, "conversations", selectedConversation.id, "messages");
      
      await addDoc(messagesRef, {
        text: yeniMesaj.trim() || "",
        senderId: user.uid,
        senderName: userData?.name || user?.displayName || "Öğrenci",
        senderPhoto: userData?.photoURL || user?.photoURL || null,
        createdAt: serverTimestamp(),
        read: false,
        readByStudent: true, // Kendi mesajı
        readByCoach: false,
        type: "user",
        attachments: uploadedUrls.length > 0 ? uploadedUrls : [],
      });

      // Update conversation
      const conversationRef = doc(db, "conversations", selectedConversation.id);
      await updateDoc(conversationRef, {
        updatedAt: serverTimestamp(),
      });

      // Send notification to coach (FCM)
      try {
        await fetch("/api/admin/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: selectedConversation.coachId,
            title: "Yeni Mesaj",
            body: `${userData?.name || "Öğrenci"}: ${yeniMesaj.trim() || "Dosya gönderildi"}`,
            data: {
              type: "message",
              conversationId: selectedConversation.id,
            },
          }),
        });
      } catch (error) {
        console.error("Bildirim gönderilirken hata:", error);
      }

      // Send WhatsApp notification to coach (if WhatsApp Web is connected)
      try {
        await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: selectedConversation.coachId,
            message: `📨 Yeni Mesaj\n\n${userData?.name || "Öğrenci"}: ${yeniMesaj.trim() || "Dosya gönderildi"}\n\nMesajı görüntülemek için uygulamaya giriş yapın.`,
          }),
        });
      } catch (error) {
        // WhatsApp bildirimi başarısız olsa bile devam et (opsiyonel)
        console.error("WhatsApp bildirimi gönderilirken hata:", error);
      }

      setYeniMesaj("");
      setSelectedFiles([]);
      setFilePreviews([]);
      
      // Mesaj gönderildikten sonra scroll yap (sadece bir kez)
      setTimeout(() => scrollToBottom(), 100);
    } catch (error) {
      console.error("Mesaj gönderilirken hata:", error);
      alert("Mesaj gönderilirken bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setGonderiliyor(false);
      setUploadingFiles(false);
    }
  };

  const formatTarih = (timestamp: Timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Şimdi";
    if (minutes < 60) return `${minutes} dakika önce`;
    if (hours < 24) return `${hours} saat önce`;
    if (days < 7) return `${days} gün önce`;
    return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
  };

  const formatTime = (timestamp: Timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
      return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  };

  if (authLoading || userDataLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
        <HomeHeader onMenuClick={() => setIsMenuOpen(true)} />
        <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-gray-400">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
      <HomeHeader onMenuClick={() => setIsMenuOpen(true)} />
      <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white/90 backdrop-blur-2xl rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-white/70 overflow-hidden">
          <div className="flex h-[calc(100vh-8rem)]">
            {/* Conversations List */}
            <div className="w-full md:w-80 border-r border-gray-200/50 flex flex-col">
              <div className="p-4 border-b border-gray-200/50">
                <h2 className="text-xl font-bold text-gray-900">Coach'lar</h2>
              </div>
              <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-gray-500 text-sm">Henüz coach bulunmuyor</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {conversations.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={async () => {
                          // Ensure conversation exists
                          await getOrCreateConversation(
                            conv.coachId,
                            conv.coachName,
                            conv.coachPhoto
                          );
                          setSelectedConversation(conv);
                        }}
                        className={`w-full p-4 text-left hover:bg-gray-50/80 transition ${
                          selectedConversation?.id === conv.id ? "bg-blue-50/80" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {conv.coachPhoto ? (
                            <img
                              src={conv.coachPhoto}
                              alt={conv.coachName}
                              className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center border-2 border-white shadow-sm">
                              <span className="text-white font-bold text-lg">
                                {conv.coachName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div>
                                <h3 className="font-semibold text-gray-900 truncate">{conv.coachName}</h3>
                                {conv.coachTitle && (
                                  <p className="text-xs text-green-600 font-medium truncate">{conv.coachTitle}</p>
                                )}
                              </div>
                              {conv.unreadCount > 0 && (
                                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                                  {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                                </span>
                              )}
              </div>
                            {conv.lastMessageText ? (
                              <>
                                <p className="text-sm text-gray-600 truncate mb-1">{conv.lastMessageText}</p>
                                {conv.lastMessage && (
                                  <p className="text-xs text-gray-400">
                                    {formatTime(conv.lastMessage)}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-sm text-gray-400 italic">Yeni sohbet başlat</p>
                            )}
            </div>
          </div>
                      </button>
                    ))}
        </div>
                )}
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 flex flex-col">
              {!selectedConversation ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-gray-500 text-lg">Bir coach seçin</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-gray-200/50 flex items-center gap-3">
                    {selectedConversation.coachPhoto ? (
                      <img
                        src={selectedConversation.coachPhoto}
                        alt={selectedConversation.coachName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {selectedConversation.coachName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-900">{selectedConversation.coachName}</h3>
                      {selectedConversation.coachTitle ? (
                        <p className="text-xs text-green-600 font-medium">{selectedConversation.coachTitle}</p>
                      ) : (
                        <p className="text-xs text-gray-500">Coach</p>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  <div
                    ref={messagesContainerRef}
                    className="flex-1 overflow-y-auto p-4 space-y-4"
                  >
                    {mesajlar.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500">Henüz mesaj yok</p>
            </div>
          ) : (
                      <>
              {mesajlar.map((mesaj, index) => {
                const isUser = mesaj.senderId === user?.uid;
                const prevMesaj = index > 0 ? mesajlar[index - 1] : null;
                const showAvatar = !prevMesaj || prevMesaj.senderId !== mesaj.senderId;
                const showDate = !prevMesaj || 
                  Math.abs((prevMesaj.createdAt?.toDate?.()?.getTime() || 0) - (mesaj.createdAt?.toDate?.()?.getTime() || 0)) > 5 * 60 * 1000;

                return (
                  <div key={mesaj.id}>
                    {showDate && (
                      <div className="flex justify-center my-4">
                        <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full font-medium">
                          {formatTarih(mesaj.createdAt)}
                        </span>
                      </div>
                    )}
                    <div className={`flex items-end gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                      {showAvatar && (
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full overflow-hidden ${isUser ? "ml-2" : "mr-2"}`}>
                                  {mesaj.senderPhoto ? (
                                <img
                                      src={mesaj.senderPhoto}
                                  alt={mesaj.senderName}
                                  className="w-full h-full object-cover"
                                />
                                  ) : (
                                <div className={`w-full h-full bg-gradient-to-br ${isUser ? "from-blue-500 to-indigo-600" : "from-green-500 to-emerald-600"} flex items-center justify-center`}>
                                  <span className="text-white font-semibold text-sm">
                                    {mesaj.senderName.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                  )}
                        </div>
                      )}
                      <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[75%] ${!showAvatar ? (isUser ? "mr-12" : "ml-12") : ""}`}>
                        {showAvatar && (
                          <span className={`text-xs font-medium mb-1 ${isUser ? "text-blue-600" : "text-green-600"}`}>
                            {mesaj.senderName}
                          </span>
                        )}
                        <div
                          className={`rounded-3xl px-5 py-3.5 shadow-lg backdrop-blur-sm ${
                            isUser
                              ? "bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 text-white rounded-br-sm shadow-blue-500/30"
                              : "bg-white/90 backdrop-blur-md text-gray-900 rounded-bl-sm shadow-gray-200/50 border border-gray-100/50"
                          }`}
                        >
                          {mesaj.attachments && mesaj.attachments.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              {mesaj.attachments.map((url, idx) => {
                                        const isPDF = url.match(/\.(pdf)$/i) || url.includes('/raw/upload/') || url.includes('format=pdf');
                                        const isImage = !isPDF && url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                                
                                if (isImage) {
                                  return (
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
                                  );
                                } else if (isPDF) {
                                          const pdfViewUrl = `/api/pdf/view?url=${encodeURIComponent(url)}`;
                                          
                                  return (
                                            <button
                                      key={idx}
                                              type="button"
                                              onClick={() => {
                                                window.open(pdfViewUrl, '_blank', 'noopener,noreferrer');
                                              }}
                                              className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-center justify-center hover:bg-red-100 transition cursor-pointer w-full"
                                    >
                                      <div className="text-center">
                                        <svg className="w-8 h-8 text-red-600 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                                <p className="text-xs text-red-700 font-medium">PDF Aç</p>
                                      </div>
                                            </button>
                                          );
                                        }
                                        return null;
                              })}
                            </div>
                          )}
                          {mesaj.text && (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                              {mesaj.text}
                            </p>
                          )}
                          {!mesaj.text && mesaj.attachments && mesaj.attachments.length > 0 && (
                            <p className="text-sm italic opacity-80">Dosya gönderildi</p>
                          )}
                        </div>
                        <div className={`flex items-center gap-1 mt-1 ${isUser ? "justify-end" : "justify-start"}`}>
                          <span className={`text-xs text-gray-500`}>
                                    {formatTime(mesaj.createdAt)}
                          </span>
                          {isUser && (
                            mesaj.readByCoach ? (
                              <span className="text-[12px] text-blue-500">✓✓</span>
                            ) : (
                              <span className="text-[12px] text-gray-400">✓</span>
                            )
                          )}
                          {!isUser && (
                            mesaj.readByStudent ? (
                              <span className="text-[12px] text-blue-500">✓✓</span>
                            ) : (
                              <span className="text-[12px] text-gray-400">✓</span>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
                      </>
                    )}
              <div ref={messagesEndRef} />
        </div>

                  {/* Message Input */}
                  <form onSubmit={handleGonder} className="p-4 border-t border-gray-200/50">
                    <div className="bg-white/90 backdrop-blur-2xl rounded-[2rem] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-white/50">
              {filePreviews.length > 0 && (
                <div className="mb-2 flex gap-2 flex-wrap">
                  {filePreviews.map((preview, idx) => (
                    <div key={idx} className="relative">
                      {preview ? (
                        <img
                          src={preview}
                          alt={`Preview ${idx + 1}`}
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                      ) : (
                                <div className="w-20 h-20 bg-red-50 rounded-lg flex items-center justify-center border border-red-200">
                                  <div className="text-center">
                                    <svg className="w-8 h-8 text-red-600 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                                    <p className="text-[10px] text-red-600 font-medium">PDF</p>
                                  </div>
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
              <div className="flex items-end gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={selectedFiles.length >= 5 || uploadingFiles}
                  className="w-11 h-11 bg-gray-100/80 hover:bg-gray-200/80 backdrop-blur-sm rounded-[1rem] flex items-center justify-center transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow-sm"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={yeniMesaj}
                    onChange={(e) => setYeniMesaj(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleGonder(e);
                      }
                    }}
                    placeholder="Mesajınızı yazın..."
                    rows={1}
                    className="w-full px-4 py-3 pr-12 rounded-[1.25rem] border border-gray-200/80 bg-white/90 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300/50 transition-all resize-none shadow-sm hover:shadow-md text-sm overflow-hidden"
                    style={{ minHeight: "48px", maxHeight: "120px" }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={(!yeniMesaj.trim() && selectedFiles.length === 0) || gonderiliyor || uploadingFiles}
                  className="w-12 h-12 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 text-white rounded-[1.25rem] flex items-center justify-center shadow-[0_4px_20px_rgba(59,130,246,0.4)] hover:shadow-[0_6px_25px_rgba(59,130,246,0.5)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {gonderiliyor || uploadingFiles ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Image Viewer Modal */}
      {imageViewerOpen && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setImageViewerOpen(false)}
        >
          <button
            onClick={() => setImageViewerOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={selectedImageUrl}
            alt="Görüntüle"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      
      <StudentFooter />
    </div>
  );
}

