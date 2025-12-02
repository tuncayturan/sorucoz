"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, query, getDocs, orderBy, doc, updateDoc, addDoc, Timestamp, onSnapshot, getDoc, where, serverTimestamp, setDoc, limit, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import Toast from "@/components/ui/Toast";
import EmojiPicker from "@/components/EmojiPicker";
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
  updatedAt?: Timestamp;
  read: boolean;
  type: "user" | "coach";
  attachments?: string[];
  readByCoach?: boolean;
  readByStudent?: boolean;
  edited?: boolean;
  audioUrl?: string;
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
  const startEditMessage = (message: ConversationMessage) => {
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
      showToast("Mesaj silindi.", "success");
    } catch (error) {
      console.error("Mesaj silinirken hata:", error);
      showToast("Mesaj silinirken bir hata oluştu.", "error");
    }
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, messageId: string) => {
    e.preventDefault();
    const message = conversationMessages.find(m => m.id === messageId);
    if (message && message.senderId === user?.uid && !message.audioUrl) {
      setContextMenu({
        isOpen: true,
        position: { x: e.clientX, y: e.clientY },
        messageId,
      });
    }
  };

  const handleLongPress = (e: React.TouchEvent, messageId: string) => {
    e.preventDefault();
    const message = conversationMessages.find(m => m.id === messageId);
    if (message && message.senderId === user?.uid && !message.audioUrl) {
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

      const messagesRef = collection(db, "conversations", selectedConversation.id, "messages");
      
      await addDoc(messagesRef, {
        text: "🎤 Ses mesajı",
        senderId: user.uid,
        senderName: userData?.name || "Coach",
        senderPhoto: userData?.photoURL || user?.photoURL || null,
        createdAt: serverTimestamp(),
        read: false,
        readByStudent: false,
        readByCoach: true,
        type: "coach",
        audioUrl: audioUrl,
      });

      const conversationRef = doc(db, "conversations", selectedConversation.id);
      await updateDoc(conversationRef, {
        updatedAt: serverTimestamp(),
      });

      // THROTTLE: Ses mesajı için localStorage kontrolü
      const voiceNow = Date.now();
      const voiceThrottleKey = `last_notification_${selectedConversation.id}`;
      const voiceLastNotificationStr = localStorage.getItem(voiceThrottleKey);
      const voiceLastNotificationTime = voiceLastNotificationStr ? parseInt(voiceLastNotificationStr) : 0;
      const voiceTimeSince = voiceNow - voiceLastNotificationTime;
      
      if (voiceTimeSince > 10000 || voiceLastNotificationTime === 0) {
        console.log("[Coach Chat] 📤 ✅ SENDING voice notification...");
        localStorage.setItem(voiceThrottleKey, voiceNow.toString());
        
        fetch("/api/admin/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: selectedConversation.studentId,
            title: "Yeni Ses Mesajı",
            body: `${userData?.name || "Coach"} ses mesajı gönderdi`,
            data: {
              type: "message",
              conversationId: selectedConversation.id,
              userId: selectedConversation.studentId,
            },
          }),
        })
        .then(res => res.json())
        .then(data => console.log("[Coach Chat] ✅ Voice notification response:", data))
        .catch(error => console.error("[Coach Chat] ❌ Voice notification error:", error));
      } else {
        console.log(`[Coach Chat] 🚫🚫🚫 VOICE THROTTLED: ${voiceTimeSince}ms önce, ${10000 - voiceTimeSince}ms sonra`);
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
    if (!selectedConversation || (!replyText.trim() && selectedFiles.length === 0) || !user) return;

    // Double submit prevention
    if (replying) {
      console.log("[Coach Chat] ⚠️ Already sending, preventing duplicate");
      return;
    }
    
    console.log("[Coach Chat] 🚀 Sending message...");

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

      // THROTTLE: localStorage ile kalıcı kontrol
      const now = Date.now();
      const throttleKey = `last_notification_${selectedConversation.id}`;
      const lastNotificationStr = localStorage.getItem(throttleKey);
      const lastNotificationTime = lastNotificationStr ? parseInt(lastNotificationStr) : 0;
      const timeSince = now - lastNotificationTime;
      
      console.log(`[Coach Chat] 🔍 Throttle Check:`, {
        conversationId: selectedConversation.id,
        timeSince,
        threshold: 10000,
        willSend: timeSince > 10000 || lastNotificationTime === 0
      });
      
      if (timeSince > 10000 || lastNotificationTime === 0) {
        console.log("[Coach Chat] 📤 ✅ SENDING notification to student...");
        localStorage.setItem(throttleKey, now.toString());
        
        fetch("/api/admin/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: selectedConversation.studentId,
            title: "Yeni Coach Mesajı",
            body: `${userData?.name || "Coach"}: ${replyText.trim() || "Dosya gönderildi"}`,
            data: {
              type: "message",
              conversationId: selectedConversation.id,
              userId: selectedConversation.studentId,
            },
          }),
        })
        .then(res => res.json())
        .then(data => console.log("[Coach Chat] ✅ Notification response:", data))
        .catch(notifError => console.error("[Coach Chat] ❌ Notification error:", notifError));
      } else {
        console.log(`[Coach Chat] 🚫🚫🚫 THROTTLED: ${timeSince}ms önce, ${10000 - timeSince}ms sonra tekrar`);
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
    const conversationId = searchParams.get('conversationId');
    
    if (conversations.length > 0) {
      let conv = null;
      
      // Önce conversationId ile ara
      if (conversationId) {
        conv = conversations.find(c => c.id === conversationId);
      }
      
      // conversationId yoksa userId ile ara
      if (!conv && userId) {
        conv = conversations.find(c => c.studentId === userId);
      }
      
      if (conv) {
        setSelectedConversation(conv);
        console.log('[Coach Chat] Bildirimden conversation açıldı:', conv.id);
        
        // URL'yi temizle
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.delete('userId');
          url.searchParams.delete('conversationId');
          window.history.replaceState({}, '', url.pathname);
        }
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
                              referrerPolicy="no-referrer"
                              onError={(e) => e.currentTarget.style.display = 'none'}
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
                        referrerPolicy="no-referrer"
                        onError={(e) => e.currentTarget.style.display = 'none'}
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
                  className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-[#f0f2f5] min-w-0"
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
                                referrerPolicy="no-referrer"
                                onError={(e) => e.currentTarget.style.display = 'none'}
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
                          <div className={`flex flex-col ${!msg.text && !msg.audioUrl && msg.attachments && msg.attachments.length > 0 ? 'mr-auto' : 'max-w-[85%] sm:max-w-[80%] md:max-w-[75%]'}`}>
                            {showAvatar && (
                              <span className="text-[11px] font-medium mb-1 text-gray-500 px-1">
                                {selectedConversation.studentName}
                              </span>
                            )}
                            <div className={`rounded-2xl overflow-hidden ${
                              !msg.text && !msg.audioUrl && msg.attachments && msg.attachments.length > 0
                                ? 'p-0 bg-transparent shadow-none'
                                : 'bg-white rounded-bl-md shadow-sm px-2 py-1.5 sm:px-2.5 sm:py-2 md:px-3.5 md:py-2'
                            }`}
                            onContextMenu={(e) => {
                              if (msg.senderId === user?.uid) {
                                handleContextMenu(e, msg.id);
                              }
                            }}
                            onTouchStart={(e) => {
                              if (msg.senderId === user?.uid) {
                                handleLongPress(e, msg.id);
                              }
                            }}
                            onTouchEnd={handleTouchEnd}
                            onTouchCancel={handleTouchEnd}
                            >
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div className={`grid grid-cols-2 gap-2 ${msg.text || msg.audioUrl ? 'mb-2' : ''}`}>
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
                              {editingMessageId === msg.id && msg.type === "user" ? (
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
                                    className="flex-1 px-3 py-2 rounded-lg border border-green-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                                    autoFocus
                                  />
                                  <button
                                    onClick={saveEdit}
                                    className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-xs"
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
                                      isOwnMessage={msg.type === "user" && msg.senderId === user?.uid}
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
                                      {!msg.text && msg.attachments && msg.attachments.length > 0 && (
                                        <p className="text-[15px] text-gray-500 italic">Dosya gönderildi</p>
                                      )}
                                    </>
                                  )}
                                  {!msg.audioUrl && msg.type === "user" && msg.senderId === user?.uid && !editingMessageId && (
                                    <button
                                      onClick={() => startEditMessage(msg)}
                                      className="mt-1 text-xs text-gray-400 hover:text-gray-600 self-start"
                                    >
                                      Düzenle
                                    </button>
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
                                referrerPolicy="no-referrer"
                                onError={(e) => e.currentTarget.style.display = 'none'}
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
                          <div className={`flex flex-col ${!msg.text && !msg.audioUrl && msg.attachments && msg.attachments.length > 0 ? 'ml-auto items-end' : 'max-w-[90%] sm:max-w-[85%] md:max-w-[75%] items-end'}`}>
                            {showAvatar && (
                              <span className="text-[11px] font-medium mb-1 text-green-600 px-1">
                                {msg.senderName || "Coach"}
                              </span>
                            )}
                            <div className={`rounded-2xl overflow-hidden ${
                              !msg.text && !msg.audioUrl && msg.attachments && msg.attachments.length > 0
                                ? 'p-0 bg-transparent shadow-none'
                                : 'bg-gradient-to-br from-green-400 via-green-500 to-emerald-500 text-white rounded-br-md shadow-[0_2px_8px_rgba(34,197,94,0.25)] px-2 py-1.5 sm:px-2.5 sm:py-2 md:px-3.5 md:py-2'
                            }`}
                            onContextMenu={(e) => {
                              if (msg.senderId === user?.uid) {
                                handleContextMenu(e, msg.id);
                              }
                            }}
                            onTouchStart={(e) => {
                              if (msg.senderId === user?.uid) {
                                handleLongPress(e, msg.id);
                              }
                            }}
                            onTouchEnd={handleTouchEnd}
                            onTouchCancel={handleTouchEnd}
                            >
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div className={`grid grid-cols-2 gap-2 ${msg.text || msg.audioUrl ? 'mb-2' : ''}`}>
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
                              {editingMessageId === msg.id && msg.type === "coach" ? (
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
                                    className="flex-1 px-3 py-2 rounded-lg border border-green-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                                    autoFocus
                                  />
                                  <button
                                    onClick={saveEdit}
                                    className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-xs"
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
                                      isOwnMessage={msg.type === "coach" && msg.senderId === user?.uid}
                                    />
                                  ) : (
                                    <>
                                      {msg.text && (
                                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-all min-w-0">
                                          {msg.text}
                                          {msg.edited && (
                                            <span className="text-xs opacity-75 ml-1 italic">(düzenlendi)</span>
                                          )}
                                        </p>
                                      )}
                                    </>
                                  )}
                                  {!msg.audioUrl && msg.type === "coach" && msg.senderId === user?.uid && !editingMessageId && (
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
                        className="w-full px-4 py-3 pr-20 rounded-2xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition resize-none shadow-sm hover:shadow-md text-sm overflow-visible"
                        style={{ minHeight: "48px", maxHeight: "120px" }}
                      />
                      {/* Emoji Button - Desktop Only */}
                      <button
                        ref={emojiButtonRef}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('[Coach Mesaj] Emoji butonu tıklandı, showEmojiPicker:', !showEmojiPicker);
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
                              console.log('[Coach Mesaj] Emoji picker kapatılıyor');
                              setShowEmojiPicker(false);
                            }}
                            onEmojiSelect={(emoji) => {
                              console.log('[Coach Mesaj] Emoji seçildi:', emoji);
                              console.log('[Coach Mesaj] Mevcut replyText:', replyText);
                              
                              // Hem state'i hem de direkt textarea'yı güncelle
                              const newText = replyText + emoji;
                              console.log('[Coach Mesaj] Yeni text olacak:', newText);
                              
                              setReplyText(newText);
                              
                              // Textarea'yı da direkt güncelle
                              if (textareaRef.current) {
                                textareaRef.current.value = newText;
                                textareaRef.current.focus();
                                // Cursor'u sona taşı
                                const length = newText.length;
                                textareaRef.current.setSelectionRange(length, length);
                              }
                              
                              console.log('[Coach Mesaj] State ve textarea güncellendi');
                            }}
                          />
                        </div>
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
                          className={`flex-shrink-0 w-11 h-11 ${isRecording ? 'bg-red-500' : 'bg-gradient-to-br from-green-500 to-emerald-600'} text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 ${isRecording ? 'animate-pulse' : ''}`}
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
                          className="flex-shrink-0 w-11 h-11 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                        >
                          {replying || uploadingFiles ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
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
                    referrerPolicy="no-referrer"
                    onError={(e) => e.currentTarget.style.display = 'none'}
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
                className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-[#f0f2f5] min-w-0"
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
                              referrerPolicy="no-referrer"
                              onError={(e) => e.currentTarget.style.display = 'none'}
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
                        <div className={`flex flex-col ${!msg.text && !msg.audioUrl && msg.attachments && msg.attachments.length > 0 ? 'mr-auto' : 'max-w-[85%] sm:max-w-[80%] md:max-w-[75%]'}`}>
                          <div className={`rounded-2xl overflow-hidden ${
                            !msg.text && !msg.audioUrl && msg.attachments && msg.attachments.length > 0
                              ? 'p-0 bg-transparent shadow-none'
                              : 'bg-white rounded-bl-md shadow-sm px-2 py-1.5 sm:px-2.5 sm:py-2 md:px-4 md:py-2.5'
                          }`}
                          onContextMenu={(e) => {
                            if (msg.senderId === user?.uid && !msg.audioUrl) {
                              handleContextMenu(e, msg.id);
                            }
                          }}
                          onTouchStart={(e) => {
                            if (msg.senderId === user?.uid && !msg.audioUrl) {
                              handleLongPress(e, msg.id);
                            }
                          }}
                          onTouchEnd={handleTouchEnd}
                          onTouchCancel={handleTouchEnd}
                          >
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className={`grid grid-cols-2 gap-2 ${msg.text || msg.audioUrl ? 'mb-2' : ''}`}>
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
                            {msg.audioUrl ? (
                              <VoiceMessage 
                                audioUrl={msg.audioUrl} 
                                isOwnMessage={false}
                              />
                            ) : (
                              <>
                                {msg.text && (
                                  <p className="text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap break-all min-w-0">
                                    {msg.text}
                                  </p>
                                )}
                                {!msg.text && msg.attachments && msg.attachments.length > 0 && (
                                  <p className="text-[15px] text-gray-500 italic">Dosya gönderildi</p>
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
                    const messageCoachPhoto = msg.senderPhoto || coachPhotoURL;
                    return (
                      <div key={msg.id} className="flex items-end gap-2 mb-3 flex-row-reverse">
                        {showAvatar ? (
                          messageCoachPhoto ? (
                            <img
                              src={messageCoachPhoto}
                              alt={msg.senderName || "Coach"}
                              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                              referrerPolicy="no-referrer"
                              onError={(e) => e.currentTarget.style.display = 'none'}
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
                        <div className={`flex flex-col ${!msg.text && !msg.audioUrl && msg.attachments && msg.attachments.length > 0 ? 'ml-auto items-end' : 'max-w-[90%] sm:max-w-[85%] md:max-w-[75%] items-end'}`}>
                          {showAvatar && (
                            <span className="text-[11px] font-medium mb-1 text-green-600 px-1">
                              {msg.senderName || "Coach"}
                            </span>
                          )}
                          <div className={`rounded-2xl overflow-hidden ${
                            !msg.text && !msg.audioUrl && msg.attachments && msg.attachments.length > 0
                              ? 'p-0 bg-transparent shadow-none'
                              : 'bg-gradient-to-br from-green-400 via-green-500 to-emerald-500 text-white rounded-br-md shadow-[0_2px_8px_rgba(34,197,94,0.25)] px-2 py-1.5 sm:px-2.5 sm:py-2 md:px-4 md:py-2.5'
                          }`}
                          onContextMenu={(e) => {
                            if (msg.senderId === user?.uid && !msg.audioUrl) {
                              handleContextMenu(e, msg.id);
                            }
                          }}
                          onTouchStart={(e) => {
                            if (msg.senderId === user?.uid && !msg.audioUrl) {
                              handleLongPress(e, msg.id);
                            }
                          }}
                          onTouchEnd={handleTouchEnd}
                          onTouchCancel={handleTouchEnd}
                          >
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className={`grid grid-cols-2 gap-2 ${msg.text || msg.audioUrl ? 'mb-2' : ''}`}>
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
                            {msg.audioUrl ? (
                              <VoiceMessage 
                                audioUrl={msg.audioUrl} 
                                isOwnMessage={msg.type === "coach" && msg.senderId === user?.uid}
                              />
                            ) : (
                              <>
                                {msg.text && (
                                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-all min-w-0">
                                    {msg.text}
                                  </p>
                                )}
                                {!msg.text && msg.attachments && msg.attachments.length > 0 && (
                                  <p className="text-[15px] italic opacity-90">Dosya gönderildi</p>
                                )}
                              </>
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
                      className="w-full px-4 py-3 pr-20 rounded-2xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition resize-none shadow-sm hover:shadow-md text-sm overflow-visible"
                      style={{ minHeight: "48px", maxHeight: "120px" }}
                    />
                    {/* Emoji Button - Desktop Only */}
                    <button
                      ref={emojiButtonRef}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('[Coach Mesaj Mobile] Emoji butonu tıklandı, showEmojiPicker:', !showEmojiPicker);
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
                            console.log('[Coach Mesaj Mobile] Emoji picker kapatılıyor');
                            setShowEmojiPicker(false);
                          }}
                          onEmojiSelect={(emoji) => {
                            console.log('[Coach Mesaj Mobile] Emoji seçildi:', emoji);
                            console.log('[Coach Mesaj Mobile] Mevcut replyText:', replyText);
                            
                            // Hem state'i hem de direkt textarea'yı güncelle
                            const newText = replyText + emoji;
                            console.log('[Coach Mesaj Mobile] Yeni text olacak:', newText);
                            
                            setReplyText(newText);
                            
                            // Textarea'yı da direkt güncelle
                            if (textareaRef.current) {
                              textareaRef.current.value = newText;
                              textareaRef.current.focus();
                              // Cursor'u sona taşı
                              const length = newText.length;
                              textareaRef.current.setSelectionRange(length, length);
                            }
                            
                            console.log('[Coach Mesaj Mobile] State ve textarea güncellendi');
                          }}
                        />
                      </div>
                    )}
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

      {/* Context Menu */}
      <MessageContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={closeContextMenu}
        onEdit={() => {
          if (contextMenu.messageId) {
            const message = conversationMessages.find(m => m.id === contextMenu.messageId);
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
        canEdit={contextMenu.messageId ? (conversationMessages.find(m => m.id === contextMenu.messageId)?.senderId === user?.uid && !conversationMessages.find(m => m.id === contextMenu.messageId)?.audioUrl) : false}
        canDelete={contextMenu.messageId ? (conversationMessages.find(m => m.id === contextMenu.messageId)?.senderId === user?.uid) : false}
      />
    </div>
  );
}

