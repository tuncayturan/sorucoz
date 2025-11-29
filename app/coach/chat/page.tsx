"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, query, getDocs, orderBy, doc, updateDoc, addDoc, Timestamp, onSnapshot, getDoc, where, serverTimestamp, setDoc, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import Toast from "@/components/ui/Toast";

interface KullaniciMesaji {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  text: string;
  senderId: string;
  senderName?: string;
  senderPhoto?: string | null;
  createdAt: Timestamp;
  read: boolean;
  type: "user" | "coach" | "admin";
  attachments?: string[];
  readByCoach?: boolean; // Coach tarafından okundu mu
  readByStudent?: boolean; // Öğrenci tarafından okundu mu
}

interface UserProfile {
  photoURL?: string | null;
  name?: string | null;
}

interface Conversation {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  photoURL?: string | null;
  lastMessage?: Timestamp;
  lastMessageText?: string;
  unreadCount: number;
}

interface ConversationMessage {
  id: string;
  text: string;
  senderId: string;
  senderName?: string;
  senderPhoto?: string | null;
  createdAt: Timestamp;
  read: boolean;
  type: "user" | "coach";
  attachments?: string[];
  readByCoach?: boolean;
  readByStudent?: boolean;
}

export default function CoachChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesContainerRefDesktop = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    isVisible: boolean;
  }>({
    message: "",
    type: "info",
    isVisible: false,
  });


  // Fetch conversations for this coach
  useEffect(() => {
    if (!user || userData?.role !== "coach") return;

    const fetchConversations = async () => {
      try {
        setLoading(true);
        
        // Get all conversations where this coach is involved
        const conversationsQuery = query(
          collection(db, "conversations"),
          where("coachId", "==", user.uid)
        );
        const conversationsSnapshot = await getDocs(conversationsQuery);
        
        const conversationsList: Conversation[] = [];
        
        for (const convDoc of conversationsSnapshot.docs) {
          const convData = convDoc.data();
          const conversationId = convDoc.id;
          
          // Double-check: Ensure this conversation belongs to this coach
          if (convData.coachId !== user.uid) {
            console.warn(`Conversation ${conversationId} does not belong to coach ${user.uid}, skipping...`);
            continue; // Skip conversations that don't belong to this coach
          }
          
          // Get student info
          const studentRef = doc(db, "users", convData.studentId);
          const studentSnap = await getDoc(studentRef);
          const studentData = studentSnap.exists() ? studentSnap.data() : null;
          
          // Get unread count - fetch all messages and filter client-side to avoid index requirement
          const messagesRef = collection(db, "conversations", conversationId, "messages");
          const allMessagesSnapshot = await getDocs(messagesRef);
          const unreadCount = allMessagesSnapshot.docs.filter(doc => {
            const data = doc.data();
            return !data.readByCoach && data.senderId !== user.uid;
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
            studentId: convData.studentId,
            studentName: studentData?.name || "Öğrenci",
            studentEmail: studentData?.email,
            photoURL: studentData?.photoURL || null,
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
      const conversationsQuery = query(
        collection(db, "conversations"),
        where("coachId", "==", user.uid)
      );
      const conversationsSnapshot = await getDocs(conversationsQuery);
      
      conversationsSnapshot.docs.forEach((convDoc) => {
        const conversationId = convDoc.id;
        
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
        const mesajListesi: ConversationMessage[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          mesajListesi.push({
            id: doc.id,
            ...data,
          } as ConversationMessage);
        });
        setConversationMessages(mesajListesi);

        // Mark messages as read
        const unreadMessages = mesajListesi.filter(
          (m) => !m.readByCoach && m.senderId !== user.uid
        );
        if (unreadMessages.length > 0) {
          unreadMessages.forEach((msg) => {
            updateDoc(doc(db, "conversations", selectedConversation.id, "messages", msg.id), {
              readByCoach: true,
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 5) {
      showToast("Maksimum 5 dosya seçebilirsiniz", "error");
      return;
    }
    
    // Dosya tipi kontrolü
    const invalidFiles = files.filter(file => {
      const isImage = file.type.startsWith("image/");
      const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      return !isImage && !isPDF;
    });
    
    if (invalidFiles.length > 0) {
      showToast("Sadece resim ve PDF dosyaları yüklenebilir", "error");
      return;
    }
    
    setSelectedFiles([...selectedFiles, ...files]);
    
    // Create previews
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
        // PDF için boş string (preview'da PDF ikonu gösterilecek)
        newPreviews.push("");
        setFilePreviews([...filePreviews, ...newPreviews]);
      }
    });
  };

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
    setFilePreviews(filePreviews.filter((_, i) => i !== index));
  };

  const handleMesajYanit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedConversation || (!replyText.trim() && selectedFiles.length === 0) || !user) return;

    try {
      setReplying(true);
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

      const messagesRef = collection(db, "conversations", selectedConversation.id, "messages");
      
      await addDoc(messagesRef, {
        text: replyText.trim() || "",
        senderId: user.uid,
        senderName: userData?.name || "Coach",
        senderPhoto: userData?.photoURL || user?.photoURL || null,
        createdAt: serverTimestamp(),
        read: false,
        readByStudent: false,
        readByCoach: true, // Kendi mesajı
        type: "coach",
        attachments: uploadedUrls.length > 0 ? uploadedUrls : [],
      });

      // Update conversation
      const conversationRef = doc(db, "conversations", selectedConversation.id);
      await updateDoc(conversationRef, {
        updatedAt: serverTimestamp(),
      });

      // Send notification to student
      try {
        await fetch("/api/admin/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: selectedConversation.studentId,
            title: "Yeni Mesaj",
            body: `${userData?.name || "Coach"}: ${replyText.trim() || "Dosya gönderildi"}`,
            data: {
              type: "message",
              conversationId: selectedConversation.id,
            },
          }),
        });
      } catch (notifError) {
        console.error("Bildirim gönderme hatası:", notifError);
      }

      setReplyText("");
      setSelectedFiles([]);
      setFilePreviews([]);
      
      setTimeout(() => scrollToBottom(), 300);
      setTimeout(() => scrollToBottom(), 600);
    } catch (error) {
      console.error("Mesaj gönderme hatası:", error);
      showToast("Mesaj gönderilirken bir hata oluştu.", "error");
    } finally {
      setReplying(false);
      setUploadingFiles(false);
    }
  };

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      const containers = [
        messagesContainerRef.current,
        messagesContainerRefDesktop.current
      ].filter(Boolean) as HTMLDivElement[];
      
      containers.forEach(container => {
        if (container.offsetHeight > 0 && container.scrollHeight > container.offsetHeight) {
          container.scrollTop = container.scrollHeight;
        }
      });
    });
  };

  // Auto-scroll to bottom when new message or selectedConversation changes
  useEffect(() => {
    if (selectedConversation && conversationMessages.length > 0) {
      const scroll = () => {
        const containers = [
          messagesContainerRef.current,
          messagesContainerRefDesktop.current
        ].filter(Boolean) as HTMLDivElement[];
        
        containers.forEach(container => {
          if (container.offsetHeight > 0 && container.scrollHeight > 0) {
            container.scrollTop = container.scrollHeight;
          }
        });
      };
      setTimeout(scroll, 200);
      setTimeout(scroll, 400);
      setTimeout(scroll, 600);
      setTimeout(scroll, 800);
      setTimeout(scroll, 1000);
      setTimeout(scroll, 1200);
    }
  }, [selectedConversation, replyText]);

  const formatTarih = (timestamp: Timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
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

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  // URL'den conversation seçimi (bildirimden geldiğinde)
  useEffect(() => {
    const userId = searchParams.get('userId');
    if (userId && conversations.length > 0) {
      const conv = conversations.find(c => c.studentId === userId);
      if (conv) {
        setSelectedConversation(conv);
      }
    }
  }, [searchParams, conversations]);

  const coachPhotoURL = userData?.photoURL || user?.photoURL || null;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="bg-white/90 backdrop-blur-2xl rounded-3xl p-12 shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-white/50 text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const totalUnreadCount = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Öğrenci Mesajları</h1>
        <p className="text-gray-600">
          {totalUnreadCount > 0 && (
            <span className="text-red-600 font-semibold">{totalUnreadCount} okunmamış mesaj</span>
          )}
          {totalUnreadCount === 0 && "Tüm mesajlar"}
        </p>
      </div>

      {/* iOS Premium Style Layout */}
      <div className="flex-1 flex bg-white/95 backdrop-blur-3xl rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.08)] border border-white/60 overflow-hidden">
          {/* Left Panel - Conversations List */}
          <div className={`w-full md:w-96 border-r border-gray-200/30 flex flex-col bg-gradient-to-b from-gray-50/80 to-white/80 backdrop-blur-xl ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
            {/* Conversations Header */}
            <div className="p-5 border-b border-gray-200/30 bg-white/60 backdrop-blur-xl">
              <h2 className="text-xl font-bold text-gray-900">Öğrenciler</h2>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-gray-500 font-medium">Henüz öğrenci mesajı yok</p>
                </div>
              ) : (
                conversations.map((conversation) => {
                  const isSelected = selectedConversation?.id === conversation.id;

                  return (
                    <button
                      key={conversation.id}
                      onClick={() => {
                        setSelectedConversation(conversation);
                        setReplyText("");
                      }}
                      className={`w-full p-4 border-b border-gray-100/50 text-left transition-all ${
                        isSelected 
                          ? "bg-green-50/60 border-l-4 border-l-green-500 backdrop-blur-sm" 
                          : "hover:bg-white/60 active:bg-gray-50/60"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Profile Photo */}
                        <div className="relative flex-shrink-0">
                          {conversation.photoURL ? (
                            <img
                              src={conversation.photoURL}
                              alt={conversation.studentName}
                              className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-full flex items-center justify-center border-2 border-white shadow-sm bg-gradient-to-br from-green-400 to-emerald-500">
                              <span className="text-white font-bold text-lg">
                                {conversation.studentName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          {conversation.unreadCount > 0 && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-2 border-white">
                              <span className="text-white text-[10px] font-bold">{conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-semibold text-gray-900 text-[15px] truncate">
                              {conversation.studentName}
                            </h3>
                            {conversation.lastMessage && (
                              <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                                {formatTarih(conversation.lastMessage)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            {conversation.lastMessageText ? (
                              <p className="text-xs text-gray-600 truncate flex-1">
                                {conversation.lastMessageText.substring(0, 50)}
                                {conversation.lastMessageText.length > 50 ? "..." : ""}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-400 italic">Yeni sohbet</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel - Chat View - Desktop */}
          <div className="flex-1 flex flex-col hidden md:flex">
            {selectedConversation ? (
              <>
                {/* iOS Style Chat Header */}
                <div className="p-4 border-b border-gray-200/30 bg-white/80 backdrop-blur-xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    {selectedConversation.photoURL ? (
                      <img
                        src={selectedConversation.photoURL}
                        alt={selectedConversation.studentName}
                        className="w-11 h-11 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full flex items-center justify-center bg-gradient-to-br from-green-400 to-emerald-500">
                        <span className="text-white font-bold text-base">
                          {selectedConversation.studentName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-900 text-[15px]">{selectedConversation.studentName}</h3>
                      <p className="text-xs text-gray-500">{selectedConversation.studentEmail || "Öğrenci"}</p>
                    </div>
                  </div>
                </div>

                {/* iOS Style Messages Container */}
                <div 
                  ref={messagesContainerRefDesktop}
                  className="flex-1 overflow-y-auto p-4 bg-[#f0f2f5]"
                  style={{
                    backgroundImage: "radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.03) 0%, transparent 50%)"
                  }}
                >
                  {/* All Messages - WhatsApp Style Chronological Order */}
                  {conversationMessages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500">Henüz mesaj yok</p>
                    </div>
                  ) : (
                    <>
                      {conversationMessages.map((msg, index) => {
                      const prevMsg = index > 0 ? conversationMessages[index - 1] : null;
                    const showAvatar = !prevMsg || prevMsg.type !== msg.type;
                    const isUser = msg.type === "user";

                    if (isUser) {
                      return (
                        <div key={msg.id} className="flex items-end gap-2 mb-3">
                          {showAvatar ? (
                            selectedConversation.photoURL ? (
                              <img
                                src={selectedConversation.photoURL}
                                alt={selectedConversation.studentName}
                                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                                <span className="text-white font-semibold text-xs">
                                  {selectedConversation.studentName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )
                          ) : (
                            <div className="w-8 flex-shrink-0" />
                          )}
                          <div className="flex flex-col max-w-[75%]">
                            {showAvatar && (
                              <span className="text-[11px] font-medium mb-1 text-gray-500 px-1">
                                {selectedConversation.studentName}
                              </span>
                            )}
                            <div className="bg-white rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm">
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                  {msg.attachments.map((url, idx) => {
                                    // PDF kontrolü: URL'de .pdf uzantısı veya Cloudinary raw URL'i
                                    const isPDF = url.match(/\.(pdf)$/i) || url.includes('/raw/upload/') || url.includes('format=pdf');
                                    // Resim kontrolü: PDF değilse ve resim uzantısı varsa
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
                                      // PDF'i API endpoint üzerinden aç (doğru Content-Type ile)
                                      const pdfViewUrl = `/api/pdf/view?url=${encodeURIComponent(url)}`;
                                      
                                      return (
                                        <button
                                          key={idx}
                                          type="button"
                                          onClick={() => {
                                            // PDF'i yeni sekmede aç
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
                              {msg.text && (
                                <p className="text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                                  {msg.text}
                                </p>
                              )}
                              {!msg.text && msg.attachments && msg.attachments.length > 0 && (
                                <p className="text-[15px] text-gray-500 italic">Dosya gönderildi</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mt-1 px-1">
                              <span className="text-[11px] text-gray-500">
                                {formatTarih(msg.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      // Coach message
                      const messageCoachPhoto = msg.senderPhoto || coachPhotoURL;
                      return (
                        <div key={msg.id} className="flex items-end gap-2 mb-3 flex-row-reverse">
                          {showAvatar ? (
                            messageCoachPhoto ? (
                              <img
                                src={messageCoachPhoto}
                                alt={msg.senderName || "Coach"}
                                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                                <span className="text-white font-semibold text-xs">
                                  {(msg.senderName || "C").charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )
                          ) : (
                            <div className="w-8 flex-shrink-0" />
                          )}
                          <div className="flex flex-col max-w-[75%] items-end">
                            {showAvatar && (
                              <span className="text-[11px] font-medium mb-1 text-green-600 px-1">
                                {msg.senderName || "Coach"}
                              </span>
                            )}
                            <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 shadow-sm">
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                  {msg.attachments.map((url, idx) => {
                                    // PDF kontrolü: URL'de .pdf uzantısı veya Cloudinary raw URL'i
                                    const isPDF = url.match(/\.(pdf)$/i) || url.includes('/raw/upload/') || url.includes('format=pdf');
                                    // Resim kontrolü: PDF değilse ve resim uzantısı varsa
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
                                      return (
                                        <a
                                          key={idx}
                                          href={url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="rounded-lg bg-white/20 p-4 flex items-center justify-center hover:bg-white/30 transition"
                                        >
                                          <div className="text-center">
                                            <svg className="w-8 h-8 text-white mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            </svg>
                                            <p className="text-xs text-white">PDF</p>
                                          </div>
                                        </a>
                                      );
                                    }
                                    return null;
                                  })}
                                </div>
                              )}
                              {msg.text && (
                                <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                                  {msg.text}
                                </p>
                              )}
                              {!msg.text && msg.attachments && msg.attachments.length > 0 && (
                                <p className="text-[15px] italic opacity-90">Dosya gönderildi</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mt-1 px-1 justify-end">
                              <span className="text-[11px] text-gray-500">
                                {formatTarih(msg.createdAt)}
                              </span>
                              {/* Read Receipts */}
                              {msg.readByStudent ? (
                                <span className="text-[12px] text-blue-500">✓✓</span>
                              ) : (
                                <span className="text-[12px] text-gray-400">✓</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                    </>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* iOS Style Message Input */}
                <form onSubmit={handleMesajYanit} className="p-3 border-t border-gray-200/30 bg-white/90 backdrop-blur-xl">
                  {/* File Previews */}
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
                  <div className="flex items-end gap-2">
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
                      className="w-11 h-11 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <div className="flex-1 relative">
                      <textarea
                        ref={textareaRef}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleMesajYanit(e);
                          }
                        }}
                        placeholder="Mesajınızı yazın..."
                        rows={1}
                        className="w-full px-4 py-3 pr-12 rounded-2xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition resize-none shadow-sm hover:shadow-md text-sm"
                        style={{ minHeight: "48px", maxHeight: "120px" }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={(!replyText.trim() && selectedFiles.length === 0) || replying || uploadingFiles}
                      className="w-11 h-11 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                    >
                      {replying || uploadingFiles ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      )}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-[#f0f2f5]">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Bir konuşma seçin</h3>
                  <p className="text-sm text-gray-600">Öğrenci mesajlarını görüntülemek için sol panelden bir konuşma seçin</p>
                </div>
              </div>
            )}
          </div>

          {/* Mobile View - Chat */}
          {selectedConversation && (
            <div className="md:hidden fixed inset-0 bg-white z-50 flex flex-col">
              {/* Mobile Header */}
              <div className="p-4 border-b border-gray-200 bg-white flex items-center gap-3">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                {selectedConversation.photoURL ? (
                  <img
                    src={selectedConversation.photoURL}
                    alt={selectedConversation.studentName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-green-400 to-emerald-500">
                    <span className="text-white font-bold text-sm">
                      {selectedConversation.studentName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedConversation.studentName}</h3>
                </div>
              </div>

              {/* Mobile Messages Container */}
              <div 
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4 bg-[#f0f2f5]"
              >
                {conversationMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">Henüz mesaj yok</p>
                  </div>
                ) : (
                  <>
                    {conversationMessages.map((msg, index) => {
                    const prevMsg = index > 0 ? conversationMessages[index - 1] : null;
                  const showAvatar = !prevMsg || prevMsg.type !== msg.type;
                  const isUser = msg.type === "user";

                  if (isUser) {
                    return (
                      <div key={msg.id} className="flex items-end gap-2 mb-3">
                        {showAvatar ? (
                          selectedConversation.photoURL ? (
                            <img
                              src={selectedConversation.photoURL}
                              alt={selectedConversation.studentName}
                              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                              <span className="text-white font-semibold text-xs">
                                {selectedConversation.studentName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )
                        ) : (
                          <div className="w-8 flex-shrink-0" />
                        )}
                        <div className="flex flex-col max-w-[75%]">
                          <div className="bg-white rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm">
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="grid grid-cols-2 gap-2 mb-2">
                                {msg.attachments.map((url, idx) => {
                                  const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                                  const isPDF = url.match(/\.(pdf)$/i);
                                  
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
                                    return (
                                      <a
                                        key={idx}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="rounded-lg bg-gray-200 p-4 flex items-center justify-center hover:bg-gray-300 transition"
                                      >
                                        <div className="text-center">
                                          <svg className="w-8 h-8 text-red-600 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                          </svg>
                                          <p className="text-xs text-gray-700">PDF</p>
                                        </div>
                                      </a>
                                    );
                                  }
                                  return null;
                                })}
                              </div>
                            )}
                            {msg.text && (
                              <p className="text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                                {msg.text}
                              </p>
                            )}
                            {!msg.text && msg.attachments && msg.attachments.length > 0 && (
                              <p className="text-[15px] text-gray-500 italic">Dosya gönderildi</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-1 px-1">
                            <span className="text-[11px] text-gray-500">
                              {formatTarih(msg.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    const messageCoachPhoto = msg.senderPhoto || coachPhotoURL;
                    return (
                      <div key={msg.id} className="flex items-end gap-2 mb-3 flex-row-reverse">
                        {showAvatar ? (
                          messageCoachPhoto ? (
                            <img
                              src={messageCoachPhoto}
                              alt={msg.senderName || "Coach"}
                              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                              <span className="text-white font-semibold text-xs">
                                {(msg.senderName || "C").charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )
                        ) : (
                          <div className="w-8 flex-shrink-0" />
                        )}
                        <div className="flex flex-col max-w-[75%] items-end">
                          {showAvatar && (
                            <span className="text-[11px] font-medium mb-1 text-green-600 px-1">
                              {msg.senderName || "Coach"}
                            </span>
                          )}
                          <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 shadow-sm">
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="grid grid-cols-2 gap-2 mb-2">
                                {msg.attachments.map((url, idx) => {
                                  const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                                  const isPDF = url.match(/\.(pdf)$/i);
                                  
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
                                        className="rounded-lg bg-white/20 p-4 flex items-center justify-center hover:bg-white/30 transition"
                                      >
                                        <div className="text-center">
                                          <svg className="w-8 h-8 text-white mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                          </svg>
                                          <p className="text-xs text-white">PDF</p>
                                        </div>
                                      </button>
                                    );
                                  }
                                  return null;
                                })}
                              </div>
                            )}
                            {msg.text && (
                              <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                                {msg.text}
                              </p>
                            )}
                            {!msg.text && msg.attachments && msg.attachments.length > 0 && (
                              <p className="text-[15px] italic opacity-90">Dosya gönderildi</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-1 px-1 justify-end">
                            <span className="text-[11px] text-gray-500">
                              {formatTarih(msg.createdAt)}
                            </span>
                            {msg.readByStudent ? (
                              <span className="text-[12px] text-blue-500">✓✓</span>
                            ) : (
                              <span className="text-[12px] text-gray-400">✓</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                    })}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Mobile Input */}
              <form onSubmit={handleMesajYanit} className="p-3 border-t border-gray-200 bg-white">
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
                          <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
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
                <div className="flex items-end gap-2">
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
                    className="w-11 h-11 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <div className="flex-1 relative">
                    <textarea
                      ref={textareaRef}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleMesajYanit(e);
                        }
                      }}
                      placeholder="Mesajınızı yazın..."
                      rows={1}
                      className="w-full px-4 py-3 pr-12 rounded-2xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition resize-none shadow-sm hover:shadow-md text-sm"
                      style={{ minHeight: "48px", maxHeight: "120px" }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={(!replyText.trim() && selectedFiles.length === 0) || replying || uploadingFiles}
                    className="w-11 h-11 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                  >
                    {replying || uploadingFiles ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
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

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </div>
  );
}

