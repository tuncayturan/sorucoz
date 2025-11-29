"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { collection, query, getDocs, orderBy, doc, updateDoc, addDoc, Timestamp, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import Toast from "@/components/ui/Toast";
import Image from "next/image";

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
}

interface UserProfile {
  photoURL?: string | null;
  name?: string | null;
}

interface Conversation {
  userId: string;
  userName: string;
  userEmail?: string;
  photoURL?: string | null;
  latestMessage: KullaniciMesaji;
  unreadCount: number;
  messages: KullaniciMesaji[];
}

export default function AdminMesajlarPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [kullaniciMesajlari, setKullaniciMesajlari] = useState<KullaniciMesaji[]>([]);
  const [userProfiles, setUserProfiles] = useState<{ [userId: string]: UserProfile }>({});
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<KullaniciMesaji | null>(null);
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

  useEffect(() => {
    fetchKullaniciMesajlari();
    
    // Set up real-time listeners for all users' messages
    const unsubscribeFunctions: (() => void)[] = [];
    
    const setupRealtimeListeners = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        
        usersSnapshot.docs.forEach((userDoc) => {
          const userId = userDoc.id;
          const mesajlarRef = collection(db, "users", userId, "mesajlar");
          const q = query(mesajlarRef, orderBy("createdAt", "desc"));
          
          const unsubscribe = onSnapshot(q, (snapshot) => {
            setKullaniciMesajlari(prev => {
              const updatedMessages = [...prev];
              
              snapshot.forEach((doc) => {
                const data = doc.data();
                const existingIndex = updatedMessages.findIndex(
                  m => m.id === doc.id && m.userId === userId
                );
                
                const newMessage: KullaniciMesaji = {
                  ...data,
                  id: doc.id,
                  userId,
                } as KullaniciMesaji;
                
                if (existingIndex >= 0) {
                  updatedMessages[existingIndex] = newMessage;
                } else {
                  updatedMessages.push(newMessage);
                }
              });
              
              // Remove deleted messages
              const existingIds = snapshot.docs.map(d => d.id);
              const filtered = updatedMessages.filter(
                m => m.userId !== userId || existingIds.includes(m.id)
              );
              
              // Sort by createdAt
              filtered.sort((a, b) => {
                const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
                const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
                return bTime - aTime;
              });
              
              return filtered;
            });
            
            // Update selected message if it's the one being updated
            setSelectedMessage(prev => {
              if (!prev) return prev;
              
              const updated = snapshot.docs.find(d => d.id === prev.id);
              if (updated && updated.data().userId === prev.userId) {
                const newMessage = {
                  ...prev,
                  ...updated.data(),
                } as KullaniciMesaji;
                setTimeout(() => scrollToBottom(), 300);
                setTimeout(() => scrollToBottom(), 600);
                return newMessage;
              }
              return prev;
            });
          });
          
          unsubscribeFunctions.push(unsubscribe);
        });
      } catch (error) {
        console.error("Real-time listener kurulum hatası:", error);
      }
    };
    
    setupRealtimeListeners();
    
    return () => {
      unsubscribeFunctions.forEach(unsub => unsub());
    };
  }, []);

  // URL'den mesaj seçimi (bildirimden geldiğinde)
  useEffect(() => {
    const userId = searchParams.get('userId');
    const messageId = searchParams.get('messageId');
    
    if (userId && messageId && kullaniciMesajlari.length > 0) {
      const message = kullaniciMesajlari.find(m => m.userId === userId && m.id === messageId);
      if (message) {
        setSelectedMessage(message);
        
        // Mark all unread user messages for this user as read
        const markAllMessagesAsRead = async () => {
          try {
            const unreadMessages = kullaniciMesajlari.filter(
              m => m.userId === userId && !m.read && m.type === "user"
            );
            for (const msg of unreadMessages) {
              const mesajRef = doc(db, "users", userId, "mesajlar", msg.id);
              await updateDoc(mesajRef, { read: true });
            }
          } catch (error) {
            console.error("Mesaj okuma hatası:", error);
          }
        };
        
        markAllMessagesAsRead();
      }
    }
  }, [searchParams, kullaniciMesajlari]);

  // Fetch user profiles
  useEffect(() => {
    const fetchUserProfiles = async () => {
      const profiles: { [userId: string]: UserProfile } = {};
      const userIds = [...new Set(kullaniciMesajlari.map(m => m.userId))];
      
      for (const userId of userIds) {
        try {
          const userRef = doc(db, "users", userId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            profiles[userId] = {
              photoURL: userData.photoURL || null,
              name: userData.name || null,
            };
          }
        } catch (error) {
          console.error(`User profile fetch error for ${userId}:`, error);
        }
      }
      
      setUserProfiles(profiles);
    };
    
    if (kullaniciMesajlari.length > 0) {
      fetchUserProfiles();
    }
  }, [kullaniciMesajlari]);

  const fetchKullaniciMesajlari = async () => {
    try {
      setLoading(true);
      const allMessages: KullaniciMesaji[] = [];
      const usersSnapshot = await getDocs(collection(db, "users"));

      for (const userDoc of usersSnapshot.docs) {
        const mesajlarRef = collection(db, "users", userDoc.id, "mesajlar");
        const q = query(mesajlarRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.type === "user") {
            allMessages.push({
              id: doc.id,
              userId: userDoc.id,
              ...data,
            } as KullaniciMesaji);
          }
        });
      }

      allMessages.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
        const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });

      setKullaniciMesajlari(allMessages);
    } catch (error) {
      console.error("Kullanıcı mesajları yüklenirken hata:", error);
      showToast("Kullanıcı mesajları yüklenirken bir hata oluştu.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 5) {
      showToast("Maksimum 5 dosya seçebilirsiniz", "error");
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
    if (!selectedMessage || (!replyText.trim() && selectedFiles.length === 0) || !user) return;

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

      const mesajlarRef = collection(db, "users", selectedMessage.userId, "mesajlar");
      
      await addDoc(mesajlarRef, {
        text: replyText.trim() || "",
        senderId: user.uid,
        senderName: "Admin",
        senderPhoto: user.photoURL || null,
        createdAt: Timestamp.now(),
        read: false,
        type: "admin",
        attachments: uploadedUrls.length > 0 ? uploadedUrls : [],
      });

      // Bildirim gönder
      try {
        await fetch("/api/admin/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: selectedMessage.userId,
            title: "Yeni Mesaj",
            body: "Admin'den yeni bir mesaj aldınız.",
            data: {
              type: "message",
              messageId: selectedMessage.id,
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

  // Auto-scroll to bottom when new message or selectedMessage changes
  useEffect(() => {
    if (selectedMessage && selectedConversation) {
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
  }, [selectedMessage, replyText]);

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

  // Group messages by user
  const groupedMessages = kullaniciMesajlari.reduce((acc, mesaj) => {
    const key = mesaj.userId;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(mesaj);
    return acc;
  }, {} as { [key: string]: KullaniciMesaji[] });

  // Get latest message for each user and create conversation list
  const conversationList: Conversation[] = Object.entries(groupedMessages).map(([userId, messages]) => {
    const sortedMessages = [...messages].sort((a, b) => {
      const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
      const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
      return bTime - aTime;
    });
    const latestMessage = sortedMessages[0];
    const unreadCount = messages.filter(m => !m.read && m.type === "user").length;
    const profile = userProfiles[userId] || {};
    
    // Get all messages for this user (user + admin) sorted chronologically
    const allUserMessages: KullaniciMesaji[] = [];
    
    // Fetch all messages for this user (both user and admin messages)
    const fetchAllMessages = async () => {
      try {
        const mesajlarRef = collection(db, "users", userId, "mesajlar");
        const q = query(mesajlarRef, orderBy("createdAt", "asc"));
        const snapshot = await getDocs(q);
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          allUserMessages.push({
            id: doc.id,
            userId,
            ...data,
          } as KullaniciMesaji);
        });
      } catch (error) {
        console.error("Error fetching all messages:", error);
      }
    };
    
    return {
      userId,
      userName: latestMessage.userName || profile.name || latestMessage.userEmail || "Kullanıcı",
      userEmail: latestMessage.userEmail,
      photoURL: profile.photoURL,
      latestMessage,
      unreadCount,
      messages: allUserMessages, // Will be populated by real-time listener
    };
  }).sort((a, b) => {
    const aTime = a.latestMessage.createdAt?.toDate?.()?.getTime() || 0;
    const bTime = b.latestMessage.createdAt?.toDate?.()?.getTime() || 0;
    return bTime - aTime;
  });

  // Fetch all messages for selected conversation
  const [selectedConversationMessages, setSelectedConversationMessages] = useState<KullaniciMesaji[]>([]);
  
  useEffect(() => {
    if (selectedMessage) {
      const fetchConversationMessages = async () => {
        try {
          const mesajlarRef = collection(db, "users", selectedMessage.userId, "mesajlar");
          const q = query(mesajlarRef, orderBy("createdAt", "asc"));
          const snapshot = await getDocs(q);
          
          const messages: KullaniciMesaji[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            messages.push({
              id: doc.id,
              userId: selectedMessage.userId,
              ...data,
            } as KullaniciMesaji);
          });
          
          setSelectedConversationMessages(messages);
        } catch (error) {
          console.error("Error fetching conversation messages:", error);
        }
      };
      
      fetchConversationMessages();
      
      // Set up real-time listener for this conversation
      const mesajlarRef = collection(db, "users", selectedMessage.userId, "mesajlar");
      const q = query(mesajlarRef, orderBy("createdAt", "asc"));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messages: KullaniciMesaji[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          messages.push({
            id: doc.id,
            userId: selectedMessage.userId,
            ...data,
          } as KullaniciMesaji);
        });
        setSelectedConversationMessages(messages);
        setTimeout(() => scrollToBottom(), 300);
        setTimeout(() => scrollToBottom(), 600);
      });
      
      return () => unsubscribe();
    }
  }, [selectedMessage]);

  const selectedConversation = selectedMessage 
    ? conversationList.find(c => c.userId === selectedMessage.userId)
    : null;

  const adminPhotoURL = user?.photoURL || null;

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

  const unreadCount = kullaniciMesajlari.filter(m => !m.read && m.type === "user").length;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Kullanıcı Mesajları</h1>
        <p className="text-gray-600">
          {unreadCount > 0 && (
            <span className="text-red-600 font-semibold">{unreadCount} okunmamış mesaj</span>
          )}
          {unreadCount === 0 && "Tüm mesajlar"}
        </p>
      </div>

      {/* iOS Premium Style Layout */}
      <div className="flex-1 flex bg-white/95 backdrop-blur-3xl rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.08)] border border-white/60 overflow-hidden">
        {/* Left Panel - Conversations List */}
        <div className="w-full md:w-96 border-r border-gray-200/30 flex flex-col bg-gradient-to-b from-gray-50/80 to-white/80 backdrop-blur-xl">
          {/* Conversations Header */}
          <div className="p-5 border-b border-gray-200/30 bg-white/60 backdrop-blur-xl">
            <h2 className="text-xl font-bold text-gray-900">Konuşmalar</h2>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {conversationList.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500 font-medium">Henüz kullanıcı mesajı yok</p>
              </div>
            ) : (
              conversationList.map((conversation) => {
                const isSelected = selectedMessage?.userId === conversation.userId;
                const latestMsg = conversation.latestMessage;

                return (
                  <div
                    key={conversation.userId}
                    onClick={async () => {
                      setSelectedMessage(latestMsg);
                      setReplyText("");
                      
                      // Mark all unread user messages for this user as read
                      const unreadMessages = kullaniciMesajlari.filter(
                        m => m.userId === conversation.userId && !m.read && m.type === "user"
                      );
                      for (const msg of unreadMessages) {
                        try {
                          const mesajRef = doc(db, "users", conversation.userId, "mesajlar", msg.id);
                          await updateDoc(mesajRef, { read: true });
                        } catch (error) {
                          console.error("Mesaj okuma hatası:", error);
                        }
                      }
                    }}
                    className={`p-4 border-b border-gray-100/50 cursor-pointer transition-all ${
                      isSelected 
                        ? "bg-blue-50/60 border-l-4 border-l-blue-500 backdrop-blur-sm" 
                        : "hover:bg-white/60 active:bg-gray-50/60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Profile Photo */}
                      <div className="relative flex-shrink-0">
                        {conversation.photoURL ? (
                          <img
                            src={conversation.photoURL}
                            alt={conversation.userName}
                            className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full flex items-center justify-center border-2 border-white shadow-sm bg-gradient-to-br from-green-400 to-emerald-500">
                            <span className="text-white font-bold text-lg">
                              {conversation.userName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        {conversation.unreadCount > 0 && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-2 border-white">
                            <span className="text-white text-[10px] font-bold">{conversation.unreadCount}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-gray-900 text-[15px] truncate">
                            {conversation.userName}
                          </h3>
                          <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                            {formatTarih(latestMsg.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-600 truncate flex-1">
                            {latestMsg.text.substring(0, 50)}
                            {latestMsg.text.length > 50 ? "..." : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel - Chat View */}
        <div className="flex-1 flex flex-col hidden md:flex">
          {selectedMessage && selectedConversation ? (
            <>
              {/* iOS Style Chat Header */}
              <div className="p-4 border-b border-gray-200/30 bg-white/80 backdrop-blur-xl flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  {selectedConversation.photoURL ? (
                    <img
                      src={selectedConversation.photoURL}
                      alt={selectedConversation.userName}
                      className="w-11 h-11 rounded-full object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full flex items-center justify-center bg-gradient-to-br from-green-400 to-emerald-500">
                      <span className="text-white font-bold text-base">
                        {selectedConversation.userName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900 text-[15px]">{selectedConversation.userName}</h3>
                    <p className="text-xs text-gray-500">{selectedConversation.userEmail}</p>
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
                {selectedConversationMessages.map((msg, index) => {
                  const prevMsg = index > 0 ? selectedConversationMessages[index - 1] : null;
                  const showAvatar = !prevMsg || prevMsg.type !== msg.type;
                  const isUser = msg.type === "user";

                  if (isUser) {
                    return (
                      <div key={msg.id} className="flex items-end gap-2 mb-3">
                        {showAvatar ? (
                          selectedConversation.photoURL ? (
                            <img
                              src={selectedConversation.photoURL}
                              alt={selectedConversation.userName}
                              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                              <span className="text-white font-semibold text-xs">
                                {selectedConversation.userName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )
                        ) : (
                          <div className="w-8 flex-shrink-0" />
                        )}
                        <div className="flex flex-col max-w-[75%]">
                          {showAvatar && (
                            <span className="text-[11px] font-medium mb-1 text-gray-500 px-1">
                              {selectedConversation.userName}
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
                            {msg.text && (
                              <p className="text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                                {msg.text}
                              </p>
                            )}
                            {!msg.text && !msg.attachments && (
                              <p className="text-[15px] text-gray-500 italic">Görsel gönderildi</p>
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
                    return (
                      <div key={msg.id} className="flex items-end gap-2 mb-3 flex-row-reverse">
                        {showAvatar ? (
                          adminPhotoURL ? (
                            <img
                              src={adminPhotoURL}
                              alt="Admin"
                              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                              <span className="text-white font-semibold text-xs">A</span>
                            </div>
                          )
                        ) : (
                          <div className="w-8 flex-shrink-0" />
                        )}
                        <div className="flex flex-col max-w-[75%] items-end">
                          {showAvatar && (
                            <span className="text-[11px] font-medium mb-1 text-blue-600 px-1">
                              Admin
                            </span>
                          )}
                          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 shadow-sm">
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
                            {msg.text && (
                              <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                                {msg.text}
                              </p>
                            )}
                            {!msg.text && !msg.attachments && (
                              <p className="text-[15px] italic opacity-90">Görsel gönderildi</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-1 px-1 justify-end">
                            <span className="text-[11px] text-gray-500">
                              {formatTarih(msg.createdAt)}
                            </span>
                            {msg.read && (
                              <span className="text-[12px] text-blue-500">✓✓</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                })}

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
                    accept="image/*"
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
                      className="w-full px-4 py-2.5 pr-10 rounded-2xl border-0 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition text-[15px] resize-none overflow-hidden placeholder:text-gray-400"
                      style={{ minHeight: "44px", maxHeight: "120px" }}
                    />
                    {replyText && (
                      <button
                        type="button"
                        onClick={() => setReplyText("")}
                        className="absolute right-2 bottom-2.5 p-1.5 rounded-lg hover:bg-gray-200 transition"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={(!replyText.trim() && selectedFiles.length === 0) || replying || uploadingFiles}
                    className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                  >
                    {replying ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-gray-500 font-medium">Bir konuşma seçin</p>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Chat View */}
        {selectedMessage && selectedConversation && (
          <div className="md:hidden fixed inset-0 bg-white z-50 flex flex-col">
            {/* Mobile Header */}
            <div className="p-4 border-b border-gray-200 bg-white flex items-center gap-3">
              <button
                onClick={() => setSelectedMessage(null)}
                className="p-2 rounded-xl hover:bg-gray-100"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              {selectedConversation.photoURL ? (
                <img
                  src={selectedConversation.photoURL}
                  alt={selectedConversation.userName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-green-400 to-emerald-500">
                  <span className="text-white font-bold text-sm">
                    {selectedConversation.userName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <h3 className="font-semibold text-gray-900">{selectedConversation.userName}</h3>
                <p className="text-xs text-gray-500">{selectedConversation.userEmail}</p>
              </div>
            </div>

            {/* Mobile Messages */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 bg-[#f0f2f5]"
            >
              {selectedConversationMessages.map((msg, index) => {
                const prevMsg = index > 0 ? selectedConversationMessages[index - 1] : null;
                const showAvatar = !prevMsg || prevMsg.type !== msg.type;
                const isUser = msg.type === "user";

                if (isUser) {
                  return (
                    <div key={msg.id} className="flex items-end gap-2 mb-3">
                      {showAvatar ? (
                        selectedConversation.photoURL ? (
                          <img
                            src={selectedConversation.photoURL}
                            alt={selectedConversation.userName}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                            <span className="text-white font-semibold text-xs">
                              {selectedConversation.userName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )
                      ) : (
                        <div className="w-8 flex-shrink-0" />
                      )}
                      <div className="flex flex-col max-w-[75%]">
                        {showAvatar && (
                          <span className="text-[11px] font-medium mb-1 text-gray-500 px-1">
                            {selectedConversation.userName}
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
                          {msg.text && (
                            <p className="text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                              {msg.text}
                            </p>
                          )}
                          {!msg.text && !msg.attachments && (
                            <p className="text-[15px] text-gray-500 italic">Görsel gönderildi</p>
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
                  return (
                    <div key={msg.id} className="flex items-end gap-2 mb-3 flex-row-reverse">
                      {showAvatar ? (
                        adminPhotoURL ? (
                          <img
                            src={adminPhotoURL}
                            alt="Admin"
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                            <span className="text-white font-semibold text-xs">A</span>
                          </div>
                        )
                      ) : (
                        <div className="w-8 flex-shrink-0" />
                      )}
                      <div className="flex flex-col max-w-[75%] items-end">
                        {showAvatar && (
                          <span className="text-[11px] font-medium mb-1 text-blue-600 px-1">
                            Admin
                          </span>
                        )}
                        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 shadow-sm">
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
                          {msg.text && (
                            <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                              {msg.text}
                            </p>
                          )}
                          {!msg.text && !msg.attachments && (
                            <p className="text-[15px] italic opacity-90">Görsel gönderildi</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-1 px-1 justify-end">
                          <span className="text-[11px] text-gray-500">
                            {formatTarih(msg.createdAt)}
                          </span>
                          {msg.read && (
                            <span className="text-[12px] text-blue-500">✓✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }
              })}
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
                  accept="image/*"
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
                    className="w-full px-4 py-2.5 pr-10 rounded-2xl border-0 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition text-[15px] resize-none overflow-hidden placeholder:text-gray-400"
                    style={{ minHeight: "44px", maxHeight: "120px" }}
                  />
                  {replyText && (
                    <button
                      type="button"
                      onClick={() => setReplyText("")}
                      className="absolute right-2 bottom-2.5 p-1.5 rounded-lg hover:bg-gray-200 transition"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={(!replyText.trim() && selectedFiles.length === 0) || replying || uploadingFiles}
                  className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {replying ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
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

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </div>
  );
}
