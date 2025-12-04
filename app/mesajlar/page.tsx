"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  setDoc,
  deleteDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import HomeHeader from "@/components/HomeHeader";
import SideMenu from "@/components/SideMenu";
import Toast from "@/components/ui/Toast";
import Image from "next/image";
import StudentFooter from "@/components/StudentFooter";
import { shouldRedirectToPremium } from "@/lib/subscriptionGuard";
import EmojiPicker from "@/components/EmojiPicker";
import VoiceMessage from "@/components/ui/VoiceMessage";
import MessageContextMenu from "@/components/ui/MessageContextMenu";
import { requestNotificationPermission, saveFCMTokenToUser } from "@/lib/fcmUtils";

interface Mesaj {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string | null;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  read: boolean;
  type: "user" | "coach" | "admin";
  attachments?: string[];
  readByCoach?: boolean;
  readByStudent?: boolean;
  edited?: boolean;
  audioUrl?: string;
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

function MesajlarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const messagesContainerRefDesktop = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
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
  const voiceButtonRef = useRef<HTMLButtonElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimeRef = useRef<number>(0);

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
      router.replace("/landing");
    }
  }, [user, authLoading, router]);

  // Abonelik süresi dolmuşsa premium sayfasına yönlendir
  useEffect(() => {
    if (!authLoading && !userDataLoading && user && userData && userData.role === "student") {
      if (shouldRedirectToPremium(userData)) {
        router.replace("/premium");
      }
    }
  }, [user, userData, authLoading, userDataLoading, router]);

  // FCM Token alma - Her sayfa yüklendiğinde kontrol et
  useEffect(() => {
    if (!user) return;
    
    // Notification izni durumunu kontrol et
    if (typeof window === "undefined" || !("Notification" in window)) {
      console.log("[Student Messages] Notifications not supported");
      return;
    }
    
    // Eğer izin verilmişse token al, verilmemişse iste
    if (Notification.permission === "granted") {
      console.log("[Student Messages] Notification permission already granted, getting token...");
      requestNotificationPermission()
        .then((token) => {
          if (token) {
            console.log("[Student Messages] FCM token received, saving...");
            return saveFCMTokenToUser(user.uid, token);
          }
        })
        .catch((err) => console.error("[Student Messages] FCM token error:", err));
    } else if (Notification.permission === "default") {
      // İlk ziyarette otomatik izin isteme (sadece 1 kere)
      const hasAskedBefore = localStorage.getItem("fcm_permission_asked");
      if (!hasAskedBefore) {
        console.log("[Student Messages] Requesting notification permission...");
        localStorage.setItem("fcm_permission_asked", "true");
        requestNotificationPermission()
          .then((token) => {
            if (token) {
              console.log("[Student Messages] FCM token received after permission grant");
              return saveFCMTokenToUser(user.uid, token);
            }
          })
          .catch((err) => console.error("[Student Messages] Permission request error:", err));
      }
    }
  }, [user]);

  // URL parametrelerinden conversation seçimi (bildirimden geldiğinde)
  useEffect(() => {
    const conversationId = searchParams.get('conversationId');
    
    if (conversationId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === conversationId);
      if (conv) {
        console.log('[Student Messages] Opening conversation from notification:', conversationId);
        setSelectedConversation(conv);
        
        // URL'yi temizle
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.delete('conversationId');
          window.history.replaceState({}, '', url.pathname);
        }
      }
    }
  }, [conversations]);

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
            coachName: coachData.name || "Eğitim Koçu",
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
    requestAnimationFrame(() => {
      const containers = [
        messagesContainerRef.current,
        messagesContainerRefDesktop.current
      ].filter(Boolean) as HTMLDivElement[];
      
      containers.forEach(container => {
        container.scrollTop = container.scrollHeight;
      });
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 5) {
      showToast("Maksimum 5 dosya seçebilirsiniz", "error");
      return;
    }
    
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
      setYeniMesaj(prev => prev + emoji);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  // Mesaj düzenleme
  const startEditMessage = (message: Mesaj) => {
    if (message.senderId === user?.uid) {
      setEditingMessageId(message.id);
      setEditingText(message.text);
    }
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  const saveEdit = async () => {
    if (!editingMessageId || !selectedConversation || !editingText.trim()) return;

    try {
      const messageRef = doc(db, "conversations", selectedConversation.id, "messages", editingMessageId);
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
    if (!selectedConversation || !user) return;

    if (!confirm("Bu mesajı silmek istediğinize emin misiniz?")) return;

    try {
      const messageRef = doc(db, "conversations", selectedConversation.id, "messages", messageId);
      await deleteDoc(messageRef);
    } catch (error) {
      console.error("Mesaj silinirken hata:", error);
      showToast("Mesaj silinirken bir hata oluştu.", "error");
    }
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, messageId: string) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      messageId,
    });
  };

  const handleLongPress = (e: React.TouchEvent, messageId: string) => {
    e.preventDefault();
    longPressTimerRef.current = setTimeout(() => {
      const touch = e.touches[0];
      setContextMenu({
        isOpen: true,
        position: { x: touch.clientX, y: touch.clientY },
        messageId,
      });
    }, 500); // 500ms basılı tutma
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
    if (isRecording || !user || !selectedConversation) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4"
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log("Audio chunk alındı, boyut:", event.data.size, "toplam chunks:", audioChunksRef.current.length);
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

      // Timer
      recordingTimerRef.current = setInterval(() => {
        recordingTimeRef.current += 0.1;
        setRecordingTime(recordingTimeRef.current);
      }, 100);
    } catch (error) {
      console.error("Ses kaydı başlatılırken hata:", error);
      showToast("Mikrofon erişimi reddedildi. Lütfen izin verin.", "error");
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
    if (!user || !selectedConversation) {
      console.error("Kullanıcı veya konuşma bulunamadı");
      return;
    }

    if (!audioBlob || audioBlob.size === 0) {
      console.error("Ses dosyası geçersiz veya boş");
      showToast("Ses kaydı boş. Lütfen tekrar deneyin.", "error");
      return;
    }

    try {
      setGonderiliyor(true);
      console.log("Ses dosyası yükleniyor, boyut:", audioBlob.size);
      
      // Upload audio file
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

      // Ensure conversation exists
      await getOrCreateConversation(
        selectedConversation.coachId,
        selectedConversation.coachName,
        selectedConversation.coachPhoto
      );

      const messagesRef = collection(db, "conversations", selectedConversation.id, "messages");
      
      await addDoc(messagesRef, {
        text: "🎤 Ses mesajı",
        senderId: user.uid,
        senderName: userData?.name || user?.displayName || "Öğrenci",
        senderPhoto: userData?.photoURL || user?.photoURL || null,
        createdAt: serverTimestamp(),
        read: false,
        readByStudent: true,
        readByCoach: false,
        type: "user",
        audioUrl: audioUrl,
      });

      // Update conversation
      const conversationRef = doc(db, "conversations", selectedConversation.id);
      await updateDoc(conversationRef, {
        updatedAt: serverTimestamp(),
      });

      // Send notification
      // THROTTLE: Ses mesajı için localStorage kontrolü
      const voiceNow = Date.now();
      const voiceThrottleKey = `last_notification_${selectedConversation.id}`;
      const voiceLastNotificationStr = localStorage.getItem(voiceThrottleKey);
      const voiceLastNotificationTime = voiceLastNotificationStr ? parseInt(voiceLastNotificationStr) : 0;
      const voiceTimeSince = voiceNow - voiceLastNotificationTime;
      
      if (voiceTimeSince > 10000 || voiceLastNotificationTime === 0) {
        console.log("[Student Messages] 📤 ✅ SENDING voice notification...");
        localStorage.setItem(voiceThrottleKey, voiceNow.toString());
        
        fetch("/api/admin/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: selectedConversation.coachId,
            title: "Yeni Ses Mesajı",
            body: `${userData?.name || "Öğrenci"} ses mesajı gönderdi`,
            data: {
              type: "message",
              conversationId: selectedConversation.id,
              userId: user.uid,
            },
          }),
        })
        .then(res => res.json())
        .then(data => console.log("[Student Messages] ✅ Voice notification response:", data))
        .catch(error => console.error("[Student Messages] ❌ Voice notification error:", error));
      } else {
        console.log(`[Student Messages] 🚫🚫🚫 VOICE THROTTLED: ${voiceTimeSince}ms önce, ${10000 - voiceTimeSince}ms sonra tekrar`);
      }

      setTimeout(() => scrollToBottom(), 100);
    } catch (error) {
      console.error("Ses mesajı gönderilirken hata:", error);
      showToast("Ses mesajı gönderilirken bir hata oluştu.", "error");
    } finally {
      setGonderiliyor(false);
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

  const handleGonder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedConversation || (!yeniMesaj.trim() && selectedFiles.length === 0) || gonderiliyor) return;

    // Aggressive double submit prevention
    if (gonderiliyor) {
      console.log("[Student Messages] ⚠️ Already sending, prevented duplicate");
      return;
    }
    
    console.log("[Student Messages] 🚀 Sending message...");

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

      // THROTTLE: localStorage kullanarak kalıcı kontrol
      const now = Date.now();
      const throttleKey = `last_notification_${selectedConversation.id}`;
      const lastNotificationStr = localStorage.getItem(throttleKey);
      const lastNotificationTime = lastNotificationStr ? parseInt(lastNotificationStr) : 0;
      const timeSinceLastNotification = now - lastNotificationTime;
      
      console.log(`[Student Messages] 🔍 Throttle Check:`, {
        conversationId: selectedConversation.id,
        lastNotificationTime: lastNotificationTime,
        now: now,
        timeSince: timeSinceLastNotification,
        threshold: 10000,
        willSend: timeSinceLastNotification > 10000 || lastNotificationTime === 0
      });
      console.log(`[Student Messages] LocalStorage value:`, localStorage.getItem(throttleKey));
      
      // 10 saniyede max 1 bildirim
      if (timeSinceLastNotification > 10000 || lastNotificationTime === 0) {
        console.log("[Student Messages] 📤 ✅ SENDING notification to coach...");
        localStorage.setItem(throttleKey, now.toString());
        
        // Send FCM notification (non-blocking)
        fetch("/api/admin/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: selectedConversation.coachId,
            title: "Yeni Öğrenci Mesajı",
            body: `${userData?.name || "Öğrenci"}: ${yeniMesaj.trim() || "Dosya gönderildi"}`,
            data: {
              type: "message",
              conversationId: selectedConversation.id,
              userId: user.uid,
            },
          }),
        })
        .then(res => res.json())
        .then(data => {
          console.log("[Student Messages] ✅ Notification response:", data);
        })
        .catch(error => console.error("[Student Messages] ❌ Notification error:", error));

        // WhatsApp notification (optional, non-blocking)
        fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: selectedConversation.coachId,
            message: `📨 Yeni Mesaj\n\n${userData?.name || "Öğrenci"}: ${yeniMesaj.trim() || "Dosya gönderildi"}\n\nMesajı görüntülemek için uygulamaya giriş yapın.`,
          }),
        })
        .then(() => console.log("[Student Messages] ✅ WhatsApp sent"))
        .catch(() => console.log("[Student Messages] ℹ️ WhatsApp skipped"));
      } else {
        console.log(`[Student Messages] 🚫🚫🚫 THROTTLED: Son bildirim ${timeSinceLastNotification}ms önce, ${10000 - timeSinceLastNotification}ms sonra tekrar deneyin`);
      }

      setYeniMesaj("");
      setSelectedFiles([]);
      setFilePreviews([]);
      
      // Mesaj gönderildikten sonra scroll yap (sadece bir kez)
      setTimeout(() => scrollToBottom(), 100);
    } catch (error) {
      console.error("Mesaj gönderilirken hata:", error);
      showToast("Mesaj gönderilirken bir hata oluştu. Lütfen tekrar deneyin.", "error");
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

      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-4 md:py-6">
        <div className="bg-white/90 backdrop-blur-2xl rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-white/70 overflow-hidden w-full">
          <div className="flex h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)] relative">
            {/* Conversations List */}
            <div className={`absolute md:relative inset-0 md:inset-auto w-full md:w-80 border-r border-gray-200/50 flex flex-col bg-white/90 backdrop-blur-2xl z-10 md:z-auto transition-transform duration-300 ${selectedConversation ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
              <div className="p-4 border-b border-gray-200/50">
                <h2 className="text-xl font-bold text-gray-900">Eğitim Koçları</h2>
              </div>
              <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-gray-500 text-sm">Henüz eğitim koçu bulunmuyor</p>
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
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const name = conv.coachName.charAt(0).toUpperCase();
                                e.currentTarget.parentElement!.innerHTML = `<div class="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center border-2 border-white shadow-sm"><span class="text-white font-bold text-lg">${name}</span></div>`;
                              }}
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

            {/* Messages Area - Desktop */}
            <div className={`hidden md:flex flex-1 flex flex-col min-w-0 bg-white/90 backdrop-blur-2xl ${selectedConversation ? '' : ''}`} style={{ overflow: 'visible' }}>
              {!selectedConversation ? (
                <div className="flex-1 flex items-center justify-center bg-[#f0f2f5]"
                  style={{
                    backgroundImage: "radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.03) 0%, transparent 50%)"
                  }}
                >
                  <div className="text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Bir eğitim koçu seçin</h3>
                    <p className="text-sm text-gray-600">Mesajlaşmaya başlamak için sol panelden bir eğitim koçu seçin</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-gray-200/50 flex items-center gap-3">
                    <button
                      onClick={() => setSelectedConversation(null)}
                      className="md:hidden flex-shrink-0 w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full transition"
                    >
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    {selectedConversation.coachPhoto ? (
                      <img
                        src={selectedConversation.coachPhoto}
                        alt={selectedConversation.coachName}
                        className="w-10 h-10 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const name = selectedConversation.coachName.charAt(0).toUpperCase();
                          e.currentTarget.parentElement!.innerHTML = `<div class="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center"><span class="text-white font-bold text-sm">${name}</span></div>`;
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {selectedConversation.coachName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{selectedConversation.coachName}</h3>
                      {selectedConversation.coachTitle ? (
                        <p className="text-xs text-green-600 font-medium truncate">{selectedConversation.coachTitle}</p>
                      ) : (
                        <p className="text-xs text-gray-500">Eğitim Koçu</p>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  <div
                    ref={messagesContainerRefDesktop}
                    className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 bg-[#f0f2f5] min-w-0"
                    style={{
                      backgroundImage: "radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.03) 0%, transparent 50%)"
                    }}
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
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    const target = e.currentTarget;
                                    target.style.display = 'none';
                                  }}
                                />
                                  ) : (
                                <div className={`w-full h-full bg-gradient-to-br ${isUser ? "from-green-400 to-emerald-500" : "from-blue-400 to-indigo-500"} flex items-center justify-center`}>
                                  <span className="text-white font-semibold text-sm">
                                    {mesaj.senderName.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                  )}
                        </div>
                      )}
                      <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} ${!mesaj.text && !mesaj.audioUrl && mesaj.attachments && mesaj.attachments.length > 0 ? (isUser ? "ml-auto" : "mr-auto") : isUser ? "max-w-[90%] sm:max-w-[85%] md:max-w-[75%]" : "max-w-[85%] sm:max-w-[80%] md:max-w-[75%]"} ${!showAvatar ? (isUser ? "mr-1 sm:mr-2 md:mr-12" : "ml-1 sm:ml-2 md:ml-12") : ""}`}>
                        {showAvatar && (
                          <span className={`text-xs font-medium mb-1 ${isUser ? "text-green-600" : "text-blue-600"}`}>
                            {mesaj.senderName}
                          </span>
                        )}
                        <div
                          className={`rounded-2xl overflow-hidden ${
                            !mesaj.text && !mesaj.audioUrl && mesaj.attachments && mesaj.attachments.length > 0
                              ? 'p-0 bg-transparent shadow-none'
                              : isUser
                              ? "bg-gradient-to-br from-green-400 via-green-500 to-emerald-500 text-white rounded-br-sm shadow-[0_2px_8px_rgba(34,197,94,0.25)] px-2 py-1.5 sm:px-2.5 sm:py-2 md:px-3.5 md:py-2.5 shadow-sm backdrop-blur-sm"
                              : "bg-white/95 backdrop-blur-md text-gray-900 rounded-bl-sm shadow-gray-200/30 border border-gray-100/50 px-2 py-1.5 sm:px-2.5 sm:py-2 md:px-3.5 md:py-2.5 shadow-sm"
                          }`}
                          onContextMenu={(e) => {
                            if (mesaj.senderId === user?.uid) {
                              handleContextMenu(e, mesaj.id);
                            }
                          }}
                          onTouchStart={(e) => {
                            if (mesaj.senderId === user?.uid) {
                              handleLongPress(e, mesaj.id);
                            }
                          }}
                          onTouchEnd={handleTouchEnd}
                          onTouchCancel={handleTouchEnd}
                        >
                          {mesaj.attachments && mesaj.attachments.length > 0 && (
                            <div className={`grid grid-cols-2 gap-2 ${mesaj.text || mesaj.audioUrl ? 'mb-2' : ''}`}>
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
                                              className={`rounded-lg ${(!mesaj.text && !mesaj.audioUrl && mesaj.attachments && mesaj.attachments.length > 0) || !isUser ? 'bg-red-50 border border-red-200' : 'bg-white/10 border border-white/20'} p-4 flex items-center justify-center hover:opacity-90 transition cursor-pointer w-full`}
                                    >
                                      <div className="text-center">
                                        <svg className={`w-8 h-8 ${(!mesaj.text && !mesaj.audioUrl && mesaj.attachments && mesaj.attachments.length > 0) || !isUser ? 'text-red-600' : 'text-white'} mx-auto mb-1`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                                <p className={`text-xs ${(!mesaj.text && !mesaj.audioUrl && mesaj.attachments && mesaj.attachments.length > 0) || !isUser ? 'text-red-700' : 'text-white'} font-medium`}>PDF Aç</p>
                                      </div>
                                            </button>
                                          );
                                        }
                                        return null;
                              })}
                            </div>
                          )}
                          {editingMessageId === mesaj.id ? (
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
                                className="flex-1 px-3 py-2 rounded-lg border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                              {mesaj.audioUrl ? (
                                <VoiceMessage 
                                  audioUrl={mesaj.audioUrl} 
                                  isOwnMessage={isUser}
                                />
                              ) : (
                                <>
                              {mesaj.text && (
                                <p className="text-sm leading-relaxed whitespace-pre-wrap break-all min-w-0">
                                  {mesaj.text}
                                  {mesaj.edited && (
                                    <span className="text-xs opacity-70 ml-1 italic">(düzenlendi)</span>
                                  )}
                                </p>
                              )}
                                  {isUser && !editingMessageId && (
                                    <button
                                      onClick={() => startEditMessage(mesaj)}
                                      className="mt-1 text-xs text-gray-400 hover:text-gray-600 self-end"
                                    >
                                      Düzenle
                                    </button>
                                  )}
                                </>
                              )}
                            </>
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
                  <form onSubmit={handleGonder} className="p-2 md:p-4 border-t border-gray-200/50 overflow-visible">
                    <div className="bg-white/90 backdrop-blur-2xl rounded-[2rem] p-2 md:p-4 shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-white/50 overflow-visible">
              {filePreviews.length > 0 && (
                <div className="mb-2 flex gap-2 flex-wrap">
                  {filePreviews.map((preview, idx) => (
                    <div key={idx} className="relative">
                      {preview ? (
                        <img
                          src={preview}
                          alt={`Preview ${idx + 1}`}
                          className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg"
                        />
                      ) : (
                                <div className="w-16 h-16 md:w-20 md:h-20 bg-red-50 rounded-lg flex items-center justify-center border border-red-200">
                                  <div className="text-center">
                                    <svg className="w-6 h-6 md:w-8 md:h-8 text-red-600 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                                    <p className="text-[8px] md:text-[10px] text-red-600 font-medium">PDF</p>
                                  </div>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="absolute -top-1 -right-1 md:-top-2 md:-right-2 w-5 h-5 md:w-6 md:h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2 md:gap-3 overflow-visible relative min-w-0">
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
                  className="flex-shrink-0 w-10 h-10 md:w-11 md:h-11 bg-gray-100/80 hover:bg-gray-200/80 backdrop-blur-sm rounded-[1rem] flex items-center justify-center transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow-sm"
                >
                  <svg className="w-4 h-4 md:w-5 md:h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
                <div className="flex-1 relative min-w-0 max-w-full overflow-visible">
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
                    className="w-full max-w-full px-3 py-2 md:px-4 md:py-3 pr-10 md:pr-20 rounded-[1.25rem] border border-gray-200/80 bg-white/90 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300/50 transition-all resize-none shadow-sm hover:shadow-md text-sm overflow-visible"
                    style={{ minHeight: "44px", maxHeight: "120px" }}
                  />
                  {/* Emoji Button - Desktop Only */}
                  <button
                    ref={emojiButtonRef}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('[Öğrenci Mesaj] Emoji butonu tıklandı, showEmojiPicker:', !showEmojiPicker);
                      setShowEmojiPicker(!showEmojiPicker);
                    }}
                    className="hidden md:flex absolute right-3 bottom-3 w-8 h-8 items-center justify-center hover:bg-gray-100 rounded-full transition text-gray-500 hover:text-gray-700 z-10 pointer-events-auto"
                    style={{ visibility: 'visible' }}
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm10 0c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm-5 6c2.21 0 4-1.79 4-4h-8c0 2.21 1.79 4 4 4z"/>
                    </svg>
                  </button>
                  {/* Emoji Picker Component - Desktop Only */}
                  {showEmojiPicker && (
                    <div className="absolute bottom-14 right-0 z-[9999]" style={{ display: 'block', visibility: 'visible' }}>
                      <EmojiPicker
                        isOpen={true}
                        buttonRef={emojiButtonRef}
                        onClose={() => {
                          console.log('[Öğrenci Mesaj] Emoji picker kapatılıyor');
                          setShowEmojiPicker(false);
                        }}
                        onEmojiSelect={(emoji) => {
                          console.log('[Öğrenci Mesaj] Emoji seçildi:', emoji);
                          console.log('[Öğrenci Mesaj] Mevcut yeniMesaj:', yeniMesaj);
                          
                          // Hem state'i hem de direkt textarea'yı güncelle
                          const newText = yeniMesaj + emoji;
                          console.log('[Öğrenci Mesaj] Yeni text olacak:', newText);
                          
                          setYeniMesaj(newText);
                          
                          // Textarea'yı da direkt güncelle
                          if (textareaRef.current) {
                            textareaRef.current.value = newText;
                            textareaRef.current.focus();
                            // Cursor'u sona taşı
                            const length = newText.length;
                            textareaRef.current.setSelectionRange(length, length);
                          }
                          
                          console.log('[Öğrenci Mesaj] State ve textarea güncellendi');
                        }}
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 relative flex-shrink-0">
                  {!yeniMesaj.trim() && selectedFiles.length === 0 ? (
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
                      disabled={gonderiliyor || uploadingFiles}
                      style={{ touchAction: 'none', WebkitTapHighlightColor: 'transparent' }}
                      className={`flex-shrink-0 w-10 h-10 md:w-12 md:h-12 ${isRecording ? 'bg-red-500' : 'bg-gradient-to-br from-green-500 to-emerald-600'} text-white rounded-[1.25rem] flex items-center justify-center shadow-[0_4px_20px_rgba(34,197,94,0.4)] hover:shadow-[0_6px_25px_rgba(34,197,94,0.5)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 ${isRecording ? 'animate-pulse' : ''}`}
                    >
                      <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={(!yeniMesaj.trim() && selectedFiles.length === 0) || gonderiliyor || uploadingFiles}
                      className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-green-400 via-green-500 to-emerald-500 text-white rounded-[1.25rem] flex items-center justify-center shadow-[0_4px_20px_rgba(34,197,94,0.4)] hover:shadow-[0_6px_25px_rgba(34,197,94,0.5)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                    >
                      {gonderiliyor || uploadingFiles ? (
                        <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      )}
                    </button>
                  )}
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
              </div>
                    </div>
                  </form>
                </>
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
                {selectedConversation.coachPhoto ? (
                  <img
                    src={selectedConversation.coachPhoto}
                    alt={selectedConversation.coachName}
                    className="w-10 h-10 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const name = selectedConversation.coachName.charAt(0).toUpperCase();
                      e.currentTarget.parentElement!.innerHTML = `<div class="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-green-500 to-emerald-600"><span class="text-white font-bold text-sm">${name}</span></div>`;
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-green-500 to-emerald-600">
                    <span className="text-white font-bold text-sm">
                      {selectedConversation.coachName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedConversation.coachName}</h3>
                  {selectedConversation.coachTitle && (
                    <p className="text-xs text-green-600">{selectedConversation.coachTitle}</p>
                  )}
                </div>
              </div>

              {/* Mobile Messages Container */}
              <div 
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-[#f0f2f5] min-w-0"
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

                      if (isUser) {
                        return (
                          <div key={mesaj.id} className="flex items-end gap-2 mb-3 flex-row-reverse">
                            {showAvatar ? (
                              mesaj.senderPhoto ? (
                                <img
                                  src={mesaj.senderPhoto}
                                  alt={mesaj.senderName}
                                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => e.currentTarget.style.display = 'none'}
                                />
                              ) : (
                                <div className={`flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br ${isUser ? "from-blue-400 to-indigo-500" : "from-blue-400 to-indigo-500"} flex items-center justify-center`}>
                                  <span className="text-white font-semibold text-xs">
                                    {mesaj.senderName.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )
                            ) : (
                              <div className="w-8 flex-shrink-0" />
                            )}
                            <div className={`flex flex-col ${!mesaj.text && !mesaj.audioUrl && mesaj.attachments && mesaj.attachments.length > 0 ? 'ml-auto items-end' : 'max-w-[90%] sm:max-w-[85%] md:max-w-[75%] items-end'}`}>
                              <div className={`rounded-2xl overflow-hidden ${
                                !mesaj.text && !mesaj.audioUrl && mesaj.attachments && mesaj.attachments.length > 0
                                  ? 'p-0 bg-transparent shadow-none'
                                  : 'bg-gradient-to-br from-green-400 via-green-500 to-emerald-500 text-white rounded-br-md shadow-[0_2px_8px_rgba(34,197,94,0.25)] px-2 py-1.5 sm:px-2.5 sm:py-2 md:px-4 md:py-2.5'
                              }`}
                              onContextMenu={(e) => {
                                if (mesaj.senderId === user?.uid) {
                                  handleContextMenu(e, mesaj.id);
                                }
                              }}
                              onTouchStart={(e) => {
                                if (mesaj.senderId === user?.uid) {
                                  handleLongPress(e, mesaj.id);
                                }
                              }}
                              onTouchEnd={handleTouchEnd}
                              onTouchCancel={handleTouchEnd}
                              >
                                {mesaj.attachments && mesaj.attachments.length > 0 && (
                                  <div className={`grid grid-cols-2 gap-2 ${mesaj.text || mesaj.audioUrl ? 'mb-2' : ''}`}>
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
                                {mesaj.audioUrl ? (
                                  <VoiceMessage 
                                    audioUrl={mesaj.audioUrl} 
                                    isOwnMessage={isUser}
                                  />
                                ) : (
                                  <>
                                    {mesaj.text && (
                                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-all min-w-0">
                                        {mesaj.text}
                                        {mesaj.edited && (
                                          <span className="text-xs opacity-70 ml-1 italic">(düzenlendi)</span>
                                        )}
                                      </p>
                                    )}
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-1 mt-1 px-1 justify-end">
                                <span className="text-[11px] text-gray-500">
                                  {formatTime(mesaj.createdAt)}
                                </span>
                                {mesaj.readByCoach ? (
                                  <span className="text-[12px] text-blue-500">✓✓</span>
                                ) : (
                                  <span className="text-[12px] text-gray-400">✓</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div key={mesaj.id} className="flex items-end gap-2 mb-3">
                            {showAvatar ? (
                              mesaj.senderPhoto ? (
                                <img
                                  src={mesaj.senderPhoto}
                                  alt={mesaj.senderName}
                                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => e.currentTarget.style.display = 'none'}
                                />
                              ) : (
                                <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                                  <span className="text-white font-semibold text-xs">
                                    {mesaj.senderName.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )
                            ) : (
                              <div className="w-8 flex-shrink-0" />
                            )}
                            <div className={`flex flex-col ${!mesaj.text && !mesaj.audioUrl && mesaj.attachments && mesaj.attachments.length > 0 ? 'mr-auto' : 'max-w-[85%] sm:max-w-[80%] md:max-w-[75%]'}`}>
                              {showAvatar && (
                                <span className="text-[11px] font-medium mb-1 text-blue-600 px-1">
                                  {mesaj.senderName}
                                </span>
                              )}
                              <div className={`rounded-2xl overflow-hidden ${
                                !mesaj.text && !mesaj.audioUrl && mesaj.attachments && mesaj.attachments.length > 0
                                  ? 'p-0 bg-transparent shadow-none'
                                  : 'bg-white rounded-bl-md shadow-sm px-2.5 py-2 md:px-4 md:py-2.5'
                              }`}
                              onContextMenu={(e) => {
                                if (mesaj.senderId === user?.uid) {
                                  handleContextMenu(e, mesaj.id);
                                }
                              }}
                              onTouchStart={(e) => {
                                if (mesaj.senderId === user?.uid) {
                                  handleLongPress(e, mesaj.id);
                                }
                              }}
                              onTouchEnd={handleTouchEnd}
                              onTouchCancel={handleTouchEnd}
                              >
                                {mesaj.attachments && mesaj.attachments.length > 0 && (
                                  <div className={`grid grid-cols-2 gap-2 ${mesaj.text || mesaj.audioUrl ? 'mb-2' : ''}`}>
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
                                        return (
                                          <a
                                            key={idx}
                                            href={`/api/pdf/view?url=${encodeURIComponent(url)}`}
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
                                {mesaj.audioUrl ? (
                                  <VoiceMessage 
                                    audioUrl={mesaj.audioUrl} 
                                    isOwnMessage={isUser}
                                  />
                                ) : (
                                  <>
                                    {mesaj.text && (
                                      <p className="text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap break-all min-w-0">
                                        {mesaj.text}
                                        {mesaj.edited && (
                                          <span className="text-xs opacity-70 ml-1 italic">(düzenlendi)</span>
                                        )}
                                      </p>
                                    )}
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-1 mt-1 px-1">
                                <span className="text-[11px] text-gray-500">
                                  {formatTime(mesaj.createdAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    })}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Mobile Input */}
              <form onSubmit={handleGonder} className="p-3 border-t border-gray-200 bg-white">
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
                    className="w-10 h-10 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition disabled:opacity-50 disabled:cursor-not-allowed"
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
                      className="w-full px-3 py-2 pr-10 rounded-[1.25rem] border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                      style={{ minHeight: "44px", maxHeight: "120px" }}
                    />
                  </div>
                  {!yeniMesaj.trim() && selectedFiles.length === 0 ? (
                    <button
                      ref={voiceButtonRef}
                      type="button"
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
                      disabled={gonderiliyor || uploadingFiles}
                      style={{ touchAction: 'none', WebkitTapHighlightColor: 'transparent' }}
                      className={`w-12 h-12 ${isRecording ? 'bg-red-500' : 'bg-gradient-to-br from-green-500 to-emerald-600'} text-white rounded-full flex items-center justify-center transition disabled:opacity-50 disabled:cursor-not-allowed ${isRecording ? 'animate-pulse' : ''}`}
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={(!yeniMesaj.trim() && selectedFiles.length === 0) || gonderiliyor || uploadingFiles}
                      className="w-12 h-12 bg-gradient-to-br from-green-400 via-green-500 to-emerald-500 text-white rounded-full flex items-center justify-center transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {gonderiliyor || uploadingFiles ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
                {isRecording && (
                  <div className="fixed inset-0 bg-gradient-to-br from-black/60 via-black/50 to-black/60 backdrop-blur-md z-[9999] flex items-center justify-center pointer-events-none">
                    <div className="bg-gradient-to-br from-white via-white/95 to-white/90 backdrop-blur-2xl rounded-[2.5rem] p-10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.4)] border border-white/20 max-w-sm w-full mx-4 pointer-events-auto relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-400/10 to-red-600/5 rounded-full blur-3xl"></div>
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-red-300/10 to-red-500/5 rounded-full blur-2xl"></div>
                      <div className="flex flex-col items-center gap-8 relative z-10">
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-600 rounded-full blur-xl opacity-50 animate-pulse"></div>
                          <div className="relative w-24 h-24 bg-gradient-to-br from-red-500 via-red-600 to-red-700 rounded-full flex items-center justify-center shadow-[0_10px_40px_rgba(239,68,68,0.4)] animate-pulse">
                            <div className="w-20 h-20 bg-gradient-to-br from-red-600 to-red-700 rounded-full flex items-center justify-center shadow-inner">
                              <svg className="w-12 h-12 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                              </svg>
                            </div>
                          </div>
                          <div className="absolute inset-0 rounded-full border-2 border-red-400/50 animate-ping"></div>
                          <div className="absolute inset-0 rounded-full border-2 border-red-400/30 animate-ping" style={{ animationDelay: '0.5s' }}></div>
                        </div>
                        <div className="text-center space-y-2">
                          <div className="text-6xl font-bold bg-gradient-to-r from-red-600 via-red-500 to-red-600 bg-clip-text text-transparent tracking-tight mb-1">
                            {Math.floor(recordingTime / 10)}:{(Math.floor(recordingTime) % 10).toString().padStart(2, "0")}
                          </div>
                          <p className="text-lg text-gray-700 font-semibold">Kaydediliyor</p>
                          <p className="text-sm text-gray-500 mt-1">Bırakmak için parmağınızı kaldırın</p>
                        </div>
                        <div className="w-full px-4">
                          <div className="flex items-end justify-center gap-1.5 h-20 w-full">
                            {[...Array(20)].map((_, i) => (
                              <div
                                key={i}
                                className="w-2 bg-gradient-to-t from-red-600 via-red-500 to-red-400 rounded-full shadow-sm"
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
                  </div>
                )}
              </form>
            </div>
          )}
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

      {/* Context Menu */}
      <MessageContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={closeContextMenu}
        onEdit={() => {
          if (contextMenu.messageId) {
            const message = mesajlar.find(m => m.id === contextMenu.messageId);
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
        canEdit={contextMenu.messageId ? (mesajlar.find(m => m.id === contextMenu.messageId)?.senderId === user?.uid && !mesajlar.find(m => m.id === contextMenu.messageId)?.audioUrl) : false}
        canDelete={contextMenu.messageId ? (mesajlar.find(m => m.id === contextMenu.messageId)?.senderId === user?.uid) : false}
      />
    </div>
  );
}

export default function MesajlarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    }>
      <MesajlarContent />
    </Suspense>
  );
}
