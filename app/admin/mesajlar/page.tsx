"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { collection, query, getDocs, orderBy, doc, updateDoc, addDoc, Timestamp, onSnapshot, getDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import Toast from "@/components/ui/Toast";
import Image from "next/image";
import EmojiPicker from "@/components/ui/EmojiPicker";
import VoiceRecorder from "@/components/ui/VoiceRecorder";
import VoiceMessage from "@/components/ui/VoiceMessage";
import MessageContextMenu from "@/components/ui/MessageContextMenu";

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
  updatedAt?: Timestamp;
  read: boolean;
  type: "user" | "coach" | "admin";
  attachments?: string[];
  edited?: boolean;
  audioUrl?: string;
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const voiceButtonRef = useRef<HTMLButtonElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimeRef = useRef<number>(0);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    messageId: string | null;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    messageId: null,
  });
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

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
        
        // URL'yi temizle
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.delete('userId');
          url.searchParams.delete('messageId');
          window.history.replaceState({}, '', url.pathname);
        }
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

  // Emoji ekleme
  const handleEmojiSelect = (emoji: string) => {
    if (editingMessageId) {
      setEditingText(prev => prev + emoji);
    } else {
      setReplyText(prev => prev + emoji);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  // Mesaj düzenleme
  const startEditMessage = (message: KullaniciMesaji) => {
    if (message.senderId === user?.uid && message.type === "admin") {
      setEditingMessageId(message.id);
      setEditingText(message.text);
    }
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  const saveEdit = async () => {
    if (!editingMessageId || !selectedMessage || !editingText.trim()) return;

    try {
      const messageRef = doc(db, "users", selectedMessage.userId, "mesajlar", editingMessageId);
      await updateDoc(messageRef, {
        text: editingText.trim(),
        updatedAt: serverTimestamp(),
        edited: true,
      });
      setEditingMessageId(null);
      setEditingText("");
    } catch (error) {
      console.error("Mesaj düzenlenirken hata:", error);
      showToast("Mesaj düzenlenirken bir hata oluştu.", "error");
    }
  };

  // Mesaj silme
  const deleteMessage = async (messageId: string) => {
    if (!selectedMessage || !user) return;

    if (!confirm("Bu mesajı silmek istediğinize emin misiniz?")) return;

    try {
      const messageRef = doc(db, "users", selectedMessage.userId, "mesajlar", messageId);
      await deleteDoc(messageRef);
      showToast("Mesaj silindi.", "success");
    } catch (error) {
      console.error("Mesaj silinirken hata:", error);
      showToast("Mesaj silinirken bir hata oluştu.", "error");
    }
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, messageId: string) => {
    e.preventDefault();
    const message = kullaniciMesajlari.find(m => m.id === messageId);
    if (message && message.senderId === user?.uid && message.type === "admin" && !message.audioUrl) {
      setContextMenu({
        isOpen: true,
        position: { x: e.clientX, y: e.clientY },
        messageId,
      });
    }
  };

  const handleLongPress = (e: React.TouchEvent, messageId: string) => {
    e.preventDefault();
    const message = kullaniciMesajlari.find(m => m.id === messageId);
    if (message && message.senderId === user?.uid && message.type === "admin" && !message.audioUrl) {
      longPressTimerRef.current = setTimeout(() => {
        const touch = e.touches[0];
        setContextMenu({
          isOpen: true,
          position: { x: touch.clientX, y: touch.clientY },
          messageId,
        });
      }, 500); // 500ms basılı tutma
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const closeContextMenu = () => {
    setContextMenu({
      isOpen: false,
      position: { x: 0, y: 0 },
      messageId: null,
    });
  };

  // Ses kaydı başlatma
  const startVoiceRecording = async () => {
    if (isRecording || !user || !selectedMessage) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4"
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Cleanup timer first
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        
        // Get final recording time from ref (more reliable than state)
        const finalTime = recordingTimeRef.current;
        
        // Cleanup stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        setIsRecording(false);
        setRecordingTime(0);
        recordingTimeRef.current = 0;
        
        // Process audio blob if we have data and minimum duration
        if (audioChunksRef.current.length > 0 && finalTime >= 0.5) {
          try {
            const blob = new Blob(audioChunksRef.current, { 
              type: mediaRecorder.mimeType || 'audio/webm' 
            });
            console.log("Ses kaydı hazır, boyut:", blob.size, "süre:", finalTime);
            await handleVoiceRecordingComplete(blob);
          } catch (error) {
            console.error("Ses işlenirken hata:", error);
            showToast("Ses kaydı işlenirken bir hata oluştu.", "error");
          }
        } else {
          console.log("Kayıt gönderilmiyor - chunks:", audioChunksRef.current.length, "süre:", finalTime);
        }
        
        // Clear chunks
        audioChunksRef.current = [];
      };

      // Start recording with timeslice to get data chunks regularly
      mediaRecorder.start(100); // Get data every 100ms
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimeRef.current = 0;

      recordingTimerRef.current = setInterval(() => {
        recordingTimeRef.current += 0.1;
        setRecordingTime(recordingTimeRef.current);
      }, 100);
    } catch (error) {
      console.error("Ses kaydı başlatılırken hata:", error);
      alert("Mikrofon erişimi reddedildi. Lütfen izin verin.");
      setIsRecording(false);
    }
  };

  // Ses kaydı durdurma
  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording && mediaRecorderRef.current.state !== 'inactive') {
      try {
        console.log("Kayıt durduruluyor, mevcut chunks:", audioChunksRef.current.length);
        // Request data before stopping to ensure we get all data
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.requestData();
          // Small delay to ensure data is collected
          setTimeout(() => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop();
            }
          }, 50);
        } else {
          mediaRecorderRef.current.stop();
        }
      } catch (error) {
        console.error("Kayıt durdurulurken hata:", error);
        setIsRecording(false);
        setRecordingTime(0);
        recordingTimeRef.current = 0;
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      }
    }
  };

  // Ses kaydı gönderme
  const handleVoiceRecordingComplete = async (audioBlob: Blob) => {
    if (!user || !selectedMessage) {
      console.error("Kullanıcı veya mesaj bulunamadı");
      return;
    }

    if (!audioBlob || audioBlob.size === 0) {
      console.error("Ses dosyası geçersiz veya boş");
      showToast("Ses kaydı boş. Lütfen tekrar deneyin.", "error");
      return;
    }

    try {
      setReplying(true);
      console.log("Ses dosyası yükleniyor, boyut:", audioBlob.size);
      
      const formData = new FormData();
      const fileName = `voice_${Date.now()}.${audioBlob.type.includes('webm') ? 'webm' : 'mp4'}`;
      formData.append("file", audioBlob, fileName);

      const uploadResponse = await fetch("/api/cloudinary/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error("Upload hatası:", errorText);
        throw new Error("Ses dosyası yüklenemedi");
      }

      const uploadData = await uploadResponse.json();
      const audioUrl = uploadData.url;
      console.log("Ses dosyası yüklendi, URL:", audioUrl);

      const mesajlarRef = collection(db, "users", selectedMessage.userId, "mesajlar");
      
      await addDoc(mesajlarRef, {
        text: "🎤 Ses mesajı",
        senderId: user.uid,
        senderName: "Admin",
        senderPhoto: user.photoURL || null,
        createdAt: serverTimestamp(),
        read: false,
        type: "admin",
        audioUrl: audioUrl,
      });

      try {
        await fetch("/api/admin/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: selectedMessage.userId,
            title: "Yeni Ses Mesajı",
            body: "Admin ses mesajı gönderdi",
            data: {
              type: "admin_message",
              messageId: selectedMessage.id,
              userId: selectedMessage.userId,
            },
          }),
        });
        console.log("[Admin Messages] Voice notification sent to user:", selectedMessage.userId);
      } catch (error) {
        console.error("Bildirim gönderilirken hata:", error);
      }

      setTimeout(() => scrollToBottom(), 100);
    } catch (error) {
      console.error("Ses mesajı gönderilirken hata:", error);
      showToast("Ses mesajı gönderilirken bir hata oluştu.", "error");
    } finally {
      setReplying(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

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
        createdAt: serverTimestamp(),
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
              type: "admin_message",
              messageId: selectedMessage.id,
              userId: selectedMessage.userId,
            },
          }),
        });
        console.log("[Admin Messages] Notification sent to user:", selectedMessage.userId);
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
                className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-[#f0f2f5] min-w-0"
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
                        <div className={`flex flex-col ${!msg.text && !msg.audioUrl && msg.attachments && msg.attachments.length > 0 ? 'mr-auto' : 'max-w-[85%] sm:max-w-[80%] md:max-w-[75%]'}`}>
                          {showAvatar && (
                            <span className="text-[11px] font-medium mb-1 text-gray-500 px-1">
                              {selectedConversation.userName}
                            </span>
                          )}
                          <div className={`rounded-2xl overflow-hidden ${
                            !msg.text && !msg.audioUrl && msg.attachments && msg.attachments.length > 0
                              ? 'p-0 bg-transparent shadow-none'
                              : 'bg-white rounded-bl-md shadow-sm px-2 py-1.5 sm:px-2.5 sm:py-2 md:px-3.5 md:py-2'
                          }`}
                          onContextMenu={(e) => {
                            if (msg.senderId === user?.uid && msg.type === "admin") {
                              handleContextMenu(e, msg.id);
                            }
                          }}
                          onTouchStart={(e) => {
                            if (msg.senderId === user?.uid && msg.type === "admin") {
                              handleLongPress(e, msg.id);
                            }
                          }}
                          onTouchEnd={handleTouchEnd}
                          onTouchCancel={handleTouchEnd}
                          >
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className={`grid grid-cols-2 gap-2 ${msg.text || msg.audioUrl ? 'mb-2' : ''}`}>
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
                            {editingMessageId === msg.id && msg.type === "user" ? (
                              <div className="flex items-center gap-2 w-full">
                                <p className="text-sm text-gray-500">Kullanıcı mesajları düzenlenemez</p>
                              </div>
                            ) : (
                              <>
                                {msg.audioUrl ? (
                                  <VoiceMessage 
                                    audioUrl={msg.audioUrl} 
                                    isOwnMessage={false}
                                  />
                                ) : (
                                  <>
                                    {msg.text && (
                                      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-all min-w-0">
                                        {msg.text}
                                        {msg.edited && (
                                          <span className="text-xs opacity-70 ml-1 italic">(düzenlendi)</span>
                                        )}
                                      </p>
                                    )}
                                  </>
                                )}
                              </>
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
                        <div className={`flex flex-col ${!msg.text && !msg.audioUrl && msg.attachments && msg.attachments.length > 0 ? 'ml-auto items-end' : 'max-w-[90%] sm:max-w-[85%] md:max-w-[75%] items-end'}`}>
                          {showAvatar && (
                            <span className="text-[11px] font-medium mb-1 text-green-600 px-1">
                              Admin
                            </span>
                          )}
                          <div className={`rounded-2xl overflow-hidden ${
                            !msg.text && !msg.audioUrl && msg.attachments && msg.attachments.length > 0
                              ? 'p-0 bg-transparent shadow-none'
                              : 'bg-gradient-to-br from-green-400 via-green-500 to-emerald-500 text-white rounded-br-md shadow-[0_2px_8px_rgba(34,197,94,0.25)] px-2 py-1.5 sm:px-2.5 sm:py-2 md:px-3.5 md:py-2'
                          }`}
                          onContextMenu={(e) => {
                            if (msg.senderId === user?.uid && msg.type === "admin") {
                              handleContextMenu(e, msg.id);
                            }
                          }}
                          onTouchStart={(e) => {
                            if (msg.senderId === user?.uid && msg.type === "admin") {
                              handleLongPress(e, msg.id);
                            }
                          }}
                          onTouchEnd={handleTouchEnd}
                          onTouchCancel={handleTouchEnd}
                          >
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className={`grid grid-cols-2 gap-2 ${msg.text || msg.audioUrl ? 'mb-2' : ''}`}>
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
                            {editingMessageId === msg.id && msg.type === "admin" ? (
                              <div className="flex items-center gap-2 w-full">
                                <input
                                  type="text"
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      saveEdit();
                                    } else if (e.key === "Escape") {
                                      cancelEdit();
                                    }
                                  }}
                                  className="flex-1 px-3 py-2 rounded-lg border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                  autoFocus
                                />
                                <button
                                  onClick={saveEdit}
                                  className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs"
                                >
                                  Kaydet
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-xs"
                                >
                                  İptal
                                </button>
                              </div>
                            ) : (
                              <>
                                {msg.audioUrl ? (
                                  <VoiceMessage 
                                    audioUrl={msg.audioUrl} 
                                    isOwnMessage={msg.type === "admin" && msg.senderId === user?.uid}
                                  />
                                ) : (
                                  <>
                                    {msg.text && (
                                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-all min-w-0">
                                        {msg.text}
                                        {msg.edited && (
                                          <span className="text-xs opacity-70 ml-1 italic">(düzenlendi)</span>
                                        )}
                                      </p>
                                    )}
                                  </>
                                )}
                                {msg.type === "admin" && msg.senderId === user?.uid && !editingMessageId && (
                                  <button
                                    onClick={() => startEditMessage(msg)}
                                    className="mt-1 text-xs opacity-75 hover:opacity-100 self-end"
                                  >
                                    Düzenle
                                  </button>
                                )}
                              </>
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
                  <div className="flex flex-col gap-2 relative flex-shrink-0">
                    {!replyText.trim() && selectedFiles.length === 0 ? (
                      <button
                        ref={voiceButtonRef}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          startVoiceRecording();
                        }}
                        onMouseUp={(e) => {
                          e.preventDefault();
                          stopVoiceRecording();
                        }}
                        onMouseLeave={() => {
                          if (isRecording) {
                            stopVoiceRecording();
                          }
                        }}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          startVoiceRecording();
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          stopVoiceRecording();
                        }}
                        onTouchCancel={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          stopVoiceRecording();
                        }}
                        disabled={replying || uploadingFiles}
                        style={{ touchAction: 'none', WebkitTapHighlightColor: 'transparent' }}
                        className={`flex-shrink-0 w-11 h-11 ${isRecording ? 'bg-red-500' : 'bg-gradient-to-br from-blue-500 to-indigo-600'} text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 ${isRecording ? 'animate-pulse' : ''}`}
                      >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={(!replyText.trim() && selectedFiles.length === 0) || replying || uploadingFiles}
                        className="flex-shrink-0 w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                      >
                        {replying ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                  {isRecording && (
                    <div className="fixed inset-0 bg-gradient-to-br from-black/60 via-black/50 to-black/60 backdrop-blur-md z-[9999] flex items-center justify-center pointer-events-none">
                      <div className="bg-gradient-to-br from-white via-white/95 to-white/90 backdrop-blur-2xl rounded-[2.5rem] p-6 md:p-10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)] border border-white/20 max-w-sm w-full mx-4 pointer-events-auto relative overflow-hidden">
                        {/* Decorative background elements */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-400/10 to-red-600/5 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-red-300/10 to-red-500/5 rounded-full blur-2xl"></div>
                        
                        <div className="flex flex-col items-center gap-6 md:gap-8 relative z-10">
                          {/* Animated microphone icon */}
                          <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-600 rounded-full blur-xl opacity-50 animate-pulse"></div>
                            <div className="relative w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-red-500 via-red-600 to-red-700 rounded-full flex items-center justify-center shadow-[0_10px_40px_rgba(239,68,68,0.4)] animate-pulse">
                              <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-red-600 to-red-700 rounded-full flex items-center justify-center shadow-inner">
                                <svg className="w-10 h-10 md:w-12 md:h-12 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                                </svg>
                              </div>
                            </div>
                            {/* Pulse rings */}
                            <div className="absolute inset-0 rounded-full border-2 border-red-400/50 animate-ping"></div>
                            <div className="absolute inset-0 rounded-full border-2 border-red-400/30 animate-ping" style={{ animationDelay: '0.5s' }}></div>
                          </div>

                          {/* Timer and status text */}
                          <div className="text-center space-y-2">
                            <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-red-600 via-red-500 to-red-600 bg-clip-text text-transparent tracking-tight mb-1">
                              {Math.floor(recordingTime / 10)}:{(Math.floor(recordingTime) % 10).toString().padStart(2, "0")}
                            </div>
                            <p className="text-base md:text-lg text-gray-700 font-semibold">Kaydediliyor</p>
                            <p className="text-xs md:text-sm text-gray-500 mt-1">Bırakmak için parmağınızı kaldırın</p>
                          </div>

                          {/* Audio waveform visualization */}
                          <div className="w-full px-4">
                            <div className="flex items-end justify-center gap-1 md:gap-1.5 h-16 md:h-20 w-full">
                              {[...Array(20)].map((_, i) => (
                                <div
                                  key={i}
                                  className="w-1.5 md:w-2 bg-gradient-to-t from-red-600 via-red-500 to-red-400 rounded-full shadow-sm"
                                  style={{
                                    height: `${Math.random() * 50 + 30}%`,
                                    animation: `waveform 0.6s ease-in-out infinite`,
                                    animationDelay: `${i * 0.03}s`,
                                    minHeight: '8px',
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      <style jsx>{`
                        @keyframes waveform {
                          0%, 100% { 
                            transform: scaleY(0.3);
                            opacity: 0.7;
                          }
                          50% { 
                            transform: scaleY(1);
                            opacity: 1;
                          }
                        }
                      `}</style>
                    </div>
                  )}
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
              className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-[#f0f2f5] min-w-0"
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
                      <div className={`flex flex-col ${!msg.text && !msg.audioUrl && msg.attachments && msg.attachments.length > 0 ? 'mr-auto' : 'max-w-[85%] sm:max-w-[80%] md:max-w-[75%]'}`}>
                        {showAvatar && (
                          <span className="text-[11px] font-medium mb-1 text-gray-500 px-1">
                            {selectedConversation.userName}
                          </span>
                        )}
                        <div className={`rounded-2xl overflow-hidden ${
                          !msg.text && !msg.audioUrl && msg.attachments && msg.attachments.length > 0
                            ? 'p-0 bg-transparent shadow-none'
                            : 'bg-white rounded-bl-md shadow-sm px-2 py-1.5 sm:px-2.5 sm:py-2 md:px-4 md:py-2.5'
                        }`}
                        onContextMenu={(e) => {
                          if (msg.senderId === user?.uid && msg.type === "admin" && !msg.audioUrl) {
                            handleContextMenu(e, msg.id);
                          }
                        }}
                        onTouchStart={(e) => {
                          if (msg.senderId === user?.uid && msg.type === "admin" && !msg.audioUrl) {
                            handleLongPress(e, msg.id);
                          }
                        }}
                        onTouchEnd={handleTouchEnd}
                        onTouchCancel={handleTouchEnd}
                        >
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className={`grid grid-cols-2 gap-2 ${msg.text || msg.audioUrl ? 'mb-2' : ''}`}>
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
                            <p className="text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap break-all min-w-0">
                              {msg.text}
                            </p>
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
                      <div className={`flex flex-col ${!msg.text && !msg.audioUrl && msg.attachments && msg.attachments.length > 0 ? 'ml-auto items-end' : 'max-w-[90%] sm:max-w-[85%] md:max-w-[75%] items-end'}`}>
                        {showAvatar && (
                          <span className="text-[11px] font-medium mb-1 text-green-600 px-1">
                            Admin
                          </span>
                        )}
                        <div className={`rounded-2xl overflow-hidden ${
                          !msg.text && !msg.audioUrl && msg.attachments && msg.attachments.length > 0
                            ? 'p-0 bg-transparent shadow-none'
                            : 'bg-gradient-to-br from-green-400 via-green-500 to-emerald-500 text-white rounded-br-md shadow-[0_2px_8px_rgba(34,197,94,0.25)] px-2 py-1.5 sm:px-2.5 sm:py-2 md:px-4 md:py-2.5'
                        }`}
                        onContextMenu={(e) => {
                          if (msg.senderId === user?.uid && msg.type === "admin" && !msg.audioUrl) {
                            handleContextMenu(e, msg.id);
                          }
                        }}
                        onTouchStart={(e) => {
                          if (msg.senderId === user?.uid && msg.type === "admin" && !msg.audioUrl) {
                            handleLongPress(e, msg.id);
                          }
                        }}
                        onTouchEnd={handleTouchEnd}
                        onTouchCancel={handleTouchEnd}
                        >
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className={`grid grid-cols-2 gap-2 ${msg.text || msg.audioUrl ? 'mb-2' : ''}`}>
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
                            <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-all min-w-0">
                              {msg.text}
                            </p>
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

      {/* Context Menu */}
      <MessageContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={closeContextMenu}
        onEdit={() => {
          if (contextMenu.messageId) {
            const message = kullaniciMesajlari.find(m => m.id === contextMenu.messageId);
            if (message) {
              startEditMessage(message);
            }
          }
        }}
        onDelete={() => {
          if (contextMenu.messageId) {
            deleteMessage(contextMenu.messageId);
          }
        }}
        canEdit={contextMenu.messageId ? (kullaniciMesajlari.find(m => m.id === contextMenu.messageId)?.senderId === user?.uid && kullaniciMesajlari.find(m => m.id === contextMenu.messageId)?.type === "admin" && !kullaniciMesajlari.find(m => m.id === contextMenu.messageId)?.audioUrl) : false}
        canDelete={contextMenu.messageId ? (kullaniciMesajlari.find(m => m.id === contextMenu.messageId)?.senderId === user?.uid && kullaniciMesajlari.find(m => m.id === contextMenu.messageId)?.type === "admin") : false}
      />
    </div>
  );
}
