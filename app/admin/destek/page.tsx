"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { collection, query, getDocs, orderBy, doc, updateDoc, deleteDoc, Timestamp, limit, getDoc, arrayUnion, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import Toast from "@/components/ui/Toast";

interface DestekMesaji {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  konu: string;
  mesaj: string;
  createdAt: Timestamp;
  status: "pending" | "answered" | "closed";
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
  viewedByAdmin?: boolean; // Admin tarafından görüntülendi mi
  viewedByAdminAt?: Timestamp; // Admin tarafından görüntülenme tarihi
}

interface UserProfile {
  photoURL?: string | null;
  name?: string | null;
}

export default function AdminDestekPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [destekMesajlari, setDestekMesajlari] = useState<DestekMesaji[]>([]);
  const [userProfiles, setUserProfiles] = useState<{ [userId: string]: UserProfile }>({});
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<DestekMesaji | null>(null);
  const [replyText, setReplyText] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"pending" | "answered" | "closed">("answered");
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
    fetchDestekMesajlari();
    
    // Set up real-time listeners for all users' support messages
    const unsubscribeFunctions: (() => void)[] = [];
    
    const setupRealtimeListeners = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        
        usersSnapshot.docs.forEach((userDoc) => {
          const userId = userDoc.id;
          const destekRef = collection(db, "users", userId, "destek");
          const q = query(destekRef, orderBy("createdAt", "desc"));
          
          const unsubscribe = onSnapshot(q, (snapshot) => {
            // Update messages in real-time
            setDestekMesajlari(prev => {
              const updatedMessages = [...prev];
              
              snapshot.forEach((doc) => {
                const data = doc.data();
                const existingIndex = updatedMessages.findIndex(
                  m => m.id === doc.id && m.userId === userId
                );
                
                const newMessage: DestekMesaji = {
                  ...data,
                  id: doc.id,
                  userId,
                } as DestekMesaji;
                
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
                } as DestekMesaji;
                // Scroll to bottom after real-time update
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
    const supportId = searchParams.get('supportId');
    
    if (userId && supportId && destekMesajlari.length > 0) {
      const message = destekMesajlari.find(m => m.userId === userId && m.id === supportId);
      if (message) {
        setSelectedMessage(message);
        
        // Mark message as viewed when opened (for notification tracking and read receipts)
        const markMessageAsViewed = async () => {
          try {
            const destekRef = doc(db, "users", userId, "destek", supportId);
            const destekSnap = await getDoc(destekRef);
            
            if (destekSnap.exists()) {
              const data = destekSnap.data();
              // CRITICAL: Mark as viewed immediately to remove notification
              // This will trigger the real-time listener in layout.tsx to remove the notification
              if (data.status === "pending" && !data.viewedByAdmin) {
                await updateDoc(destekRef, { 
                  viewedByAdmin: true, 
                  viewedByAdminAt: Timestamp.now() 
                });
                console.log("✅ [ADMIN] Marked message as viewed - notification should disappear");
              }
              
              // Mark initial user message as read by admin
              if (!data.readByAdmin) {
                await updateDoc(destekRef, { readByAdmin: true });
              }
              
              // Mark student replies as read by admin
              if (data.ogrenciYanitlar && Array.isArray(data.ogrenciYanitlar)) {
                const updatedOgrenciYanitlar = data.ogrenciYanitlar.map((yanit: any) => ({
                  ...yanit,
                  readByAdmin: yanit.readByAdmin || true, // Mark as read
                }));
                await updateDoc(destekRef, { ogrenciYanitlar: updatedOgrenciYanitlar });
              }
            }
          } catch (error) {
            console.error("Mesaj görüntüleme hatası:", error);
          }
        };
        
        markMessageAsViewed();
        
        // Scroll to bottom after selecting message
        setTimeout(() => scrollToBottom(), 300);
        setTimeout(() => scrollToBottom(), 600);
        setTimeout(() => scrollToBottom(), 900);
      }
    }
  }, [destekMesajlari, searchParams]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [replyText]);

  const scrollToBottom = () => {
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      // Try both mobile and desktop containers
      const containers = [
        messagesContainerRef.current, // Mobile
        messagesContainerRefDesktop.current // Desktop
      ].filter(Boolean) as HTMLDivElement[];
      
      containers.forEach(container => {
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
      });
      
      // Also try scrollIntoView as fallback
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "auto", block: "end" });
      }
    });
  };

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  const handleDeleteConversation = async (conversation: typeof conversationList[0], e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the conversation when clicking delete
    
    if (!confirm(`"${conversation.latestMessage.konu || conversation.userName}" konulu destek mesajını silmek istediğinize emin misiniz?`)) {
      return;
    }

    try {
      const destekRef = doc(db, "users", conversation.userId, "destek", conversation.supportId);
      await deleteDoc(destekRef);
      
      // If this was the selected message, clear selection
      if (selectedMessage?.id === conversation.supportId) {
        setSelectedMessage(null);
        setReplyText("");
      }
      
      showToast("Destek mesajı başarıyla silindi.", "success");
    } catch (error) {
      console.error("Destek mesajı silme hatası:", error);
      showToast("Destek mesajı silinirken bir hata oluştu.", "error");
    }
  };

  const fetchUserProfile = async (userId: string): Promise<UserProfile> => {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        return {
          photoURL: data.photoURL || null,
          name: data.name || null,
        };
      }
    } catch (error) {
      console.error("Kullanıcı profili yüklenirken hata:", error);
    }
    return { photoURL: null, name: null };
  };

  const fetchDestekMesajlari = async () => {
    try {
      setLoading(true);
      const allMessages: DestekMesaji[] = [];
      const profiles: { [userId: string]: UserProfile } = {};
      const usersSnapshot = await getDocs(collection(db, "users"));

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const destekRef = collection(db, "users", userId, "destek");
        const q = query(destekRef, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        snapshot.forEach((doc) => {
          allMessages.push({
            id: doc.id,
            userId,
            ...doc.data(),
          } as DestekMesaji);
        });

        // Fetch user profile
        const profile = await fetchUserProfile(userId);
        profiles[userId] = profile;
      }

      allMessages.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
        const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });

      setDestekMesajlari(allMessages);
      setUserProfiles(profiles);
    } catch (error) {
      console.error("Destek mesajları yüklenirken hata:", error);
      showToast("Destek mesajları yüklenirken bir hata oluştu.", "error");
    } finally {
      setLoading(false);
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

  const handleStatusChange = async (newStatus: "pending" | "answered" | "closed") => {
    if (!selectedMessage || !user) return;
    
    try {
      const destekRef = doc(db, "users", selectedMessage.userId, "destek", selectedMessage.id);
      await updateDoc(destekRef, {
        status: newStatus,
      });
      
      // Update local state
      const updatedMessage = {
        ...selectedMessage,
        status: newStatus,
      };
      setSelectedMessage(updatedMessage);
      setDestekMesajlari(prev => 
        prev.map(msg => 
          msg.id === selectedMessage.id && msg.userId === selectedMessage.userId
            ? updatedMessage
            : msg
        )
      );
      
      console.log(`✅ Status updated to: ${newStatus}`);
    } catch (error) {
      console.error("Status güncelleme hatası:", error);
      showToast("Durum güncellenirken bir hata oluştu.", "error");
    }
  };

  const handleDestekYanit = async (e?: React.FormEvent) => {
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

      const destekRef = doc(db, "users", selectedMessage.userId, "destek", selectedMessage.id);
      
      // LOG: Before update - selectedMessage state
      console.log("🔵 [ADMIN REPLY] BEFORE UPDATE - selectedMessage state:");
      console.log("  - selectedMessage.ogrenciYanitlar:", selectedMessage.ogrenciYanitlar);
      console.log("  - selectedMessage.ogrenciYanit:", selectedMessage.ogrenciYanit);
      console.log("  - selectedMessage.yanitlar:", selectedMessage.yanitlar);
      console.log("  - selectedMessage.yanit:", selectedMessage.yanit);
      
      // First, get the current document to preserve all existing data
      const destekSnap = await getDoc(destekRef);
      if (!destekSnap.exists()) {
        throw new Error("Destek mesajı bulunamadı");
      }
      
      const currentData = destekSnap.data();
      
      // LOG: Current data from Firestore
      console.log("🟢 [ADMIN REPLY] CURRENT FIRESTORE DATA:");
      console.log("  - currentData.ogrenciYanitlar:", currentData.ogrenciYanitlar);
      console.log("  - currentData.ogrenciYanit:", currentData.ogrenciYanit);
      console.log("  - currentData.ogrenciYanitTarihi:", currentData.ogrenciYanitTarihi);
      console.log("  - currentData.ogrenciYanitAttachments:", currentData.ogrenciYanitAttachments);
      console.log("  - currentData.yanitlar:", currentData.yanitlar);
      console.log("  - currentData.yanit:", currentData.yanit);
      
      // Create new reply object for Firestore
      const newReplyObj = {
        content: replyText.trim() || "",
        timestamp: Timestamp.now(),
        attachments: uploadedUrls.length > 0 ? uploadedUrls : [],
        readByStudent: false, // Öğrenci henüz okumadı
      };
      
      // Preserve existing yanitlar array and add new reply
      const existingYanitlar = currentData.yanitlar || [];
      const updatedYanitlar = [...existingYanitlar, newReplyObj];
      
      // LOG: What we're preserving
      console.log("🟡 [ADMIN REPLY] PRESERVING DATA:");
      console.log("  - existingYanitlar count:", existingYanitlar.length);
      console.log("  - updatedYanitlar count:", updatedYanitlar.length);
      console.log("  - preserving ogrenciYanitlar:", currentData.ogrenciYanitlar || []);
      console.log("  - preserving ogrenciYanit:", currentData.ogrenciYanit || "");
      
      // Preserve all existing data, especially ogrenciYanitlar
      const updateData: any = {
        yanitlar: updatedYanitlar, // Use full array instead of arrayUnion to ensure we preserve everything
        status: selectedStatus,
        // Preserve ogrenciYanitlar - don't touch it
        ogrenciYanitlar: currentData.ogrenciYanitlar || [],
        ogrenciYanit: currentData.ogrenciYanit || "",
        ogrenciYanitTarihi: currentData.ogrenciYanitTarihi || null,
        ogrenciYanitAttachments: currentData.ogrenciYanitAttachments || [],
        // Preserve all other fields
        mesaj: currentData.mesaj || "",
        konu: currentData.konu || "",
        attachments: currentData.attachments || [],
        createdAt: currentData.createdAt || Timestamp.now(),
        userName: currentData.userName || "",
        userEmail: currentData.userEmail || "",
        readByAdmin: currentData.readByAdmin || false,
        viewedByAdmin: currentData.viewedByAdmin || false,
      };
      
      // Also update legacy single yanit field for backward compatibility
      updateData.yanit = replyText.trim() || "";
      updateData.yanitTarihi = Timestamp.now();
      if (uploadedUrls.length > 0) {
        updateData.yanitAttachments = uploadedUrls;
      }
      
      // LOG: What we're sending to Firestore
      console.log("🟠 [ADMIN REPLY] SENDING TO FIRESTORE:");
      console.log("  - updateData.ogrenciYanitlar:", updateData.ogrenciYanitlar);
      console.log("  - updateData.ogrenciYanit:", updateData.ogrenciYanit);
      console.log("  - updateData.yanitlar count:", updateData.yanitlar.length);
      console.log("  - updateData.yanit:", updateData.yanit);
      
      await updateDoc(destekRef, updateData);
      
      // LOG: After update - verify what was saved
      const verifySnap = await getDoc(destekRef);
      const verifyData = verifySnap.data();
      console.log("🔴 [ADMIN REPLY] AFTER UPDATE - VERIFIED FIRESTORE DATA:");
      console.log("  - verifyData.ogrenciYanitlar:", verifyData?.ogrenciYanitlar);
      console.log("  - verifyData.ogrenciYanit:", verifyData?.ogrenciYanit);
      console.log("  - verifyData.ogrenciYanitTarihi:", verifyData?.ogrenciYanitTarihi);
      console.log("  - verifyData.ogrenciYanitAttachments:", verifyData?.ogrenciYanitAttachments);
      console.log("  - verifyData.yanitlar count:", verifyData?.yanitlar?.length || 0);

      // Bildirim gönder
      try {
        await fetch("/api/admin/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: selectedMessage.userId,
            title: "Destek Mesajınıza Yanıt",
            body: `"${selectedMessage.konu}" konulu destek mesajınıza yanıt verildi.`,
            data: {
              type: "support_reply",
              supportId: selectedMessage.id,
            },
          }),
        });
      } catch (notifError) {
        console.error("Bildirim gönderme hatası:", notifError);
      }

      // WhatsApp style: Update immediately without toast
      const replyTextCopy = replyText.trim();
      const yanitTarihi = Timestamp.now();
      setReplyText("");
      setSelectedFiles([]);
      setFilePreviews([]);
      
      // LOG: Before local state update
      console.log("🟣 [ADMIN REPLY] BEFORE LOCAL STATE UPDATE:");
      console.log("  - selectedMessage.ogrenciYanitlar:", selectedMessage.ogrenciYanitlar);
      console.log("  - selectedMessage.ogrenciYanit:", selectedMessage.ogrenciYanit);
      
      // Update selected message immediately
      const updatedMessage: DestekMesaji = { 
        ...selectedMessage, 
        status: selectedStatus,
      };
      
      // Add to yanitlar array or create new array
      const newReplyForState = {
        content: replyTextCopy,
        timestamp: yanitTarihi,
        attachments: uploadedUrls.length > 0 ? uploadedUrls : [],
        readByStudent: false, // Öğrenci henüz okumadı
      };
      
      // Preserve existing yanitlar and add new reply
      if (selectedMessage.yanitlar && Array.isArray(selectedMessage.yanitlar)) {
        updatedMessage.yanitlar = [...selectedMessage.yanitlar, newReplyForState];
      } else {
        updatedMessage.yanitlar = [newReplyForState];
      }
      
      // CRITICAL: Preserve ogrenciYanitlar - don't lose student messages
      // Use the data we just verified from Firestore
      const verifySnapForState = await getDoc(destekRef);
      const verifyDataForState = verifySnapForState.data();
      
      if (verifyDataForState?.ogrenciYanitlar && Array.isArray(verifyDataForState.ogrenciYanitlar) && verifyDataForState.ogrenciYanitlar.length > 0) {
        // Use the verified data from Firestore
        updatedMessage.ogrenciYanitlar = [...verifyDataForState.ogrenciYanitlar];
        console.log("✅ [ADMIN REPLY] Using ogrenciYanitlar from Firestore:", updatedMessage.ogrenciYanitlar.length, "messages");
      } else if (selectedMessage.ogrenciYanitlar && Array.isArray(selectedMessage.ogrenciYanitlar)) {
        // Fallback to selectedMessage state
        updatedMessage.ogrenciYanitlar = [...selectedMessage.ogrenciYanitlar];
        console.log("⚠️ [ADMIN REPLY] Using ogrenciYanitlar from selectedMessage state:", updatedMessage.ogrenciYanitlar.length, "messages");
      } else if (selectedMessage.ogrenciYanit || verifyDataForState?.ogrenciYanit) {
        // Convert legacy single field to array
        const ogrenciYanitContent = selectedMessage.ogrenciYanit || verifyDataForState?.ogrenciYanit || "";
        const ogrenciYanitTarihi = selectedMessage.ogrenciYanitTarihi || verifyDataForState?.ogrenciYanitTarihi || selectedMessage.createdAt;
        const ogrenciYanitAttachments = selectedMessage.ogrenciYanitAttachments || verifyDataForState?.ogrenciYanitAttachments || [];
        
        updatedMessage.ogrenciYanitlar = [{
          content: ogrenciYanitContent,
          timestamp: ogrenciYanitTarihi,
          attachments: ogrenciYanitAttachments,
          readByAdmin: false,
        }];
        console.log("🔄 [ADMIN REPLY] Converted legacy ogrenciYanit to array:", updatedMessage.ogrenciYanitlar.length, "message");
      } else {
        updatedMessage.ogrenciYanitlar = [];
        console.log("❌ [ADMIN REPLY] No ogrenciYanit found, setting empty array");
      }
      
      // Also update legacy fields for backward compatibility
      updatedMessage.yanit = replyTextCopy;
      updatedMessage.yanitTarihi = yanitTarihi;
      if (uploadedUrls.length > 0) {
        updatedMessage.yanitAttachments = uploadedUrls;
      }
      
      // Preserve legacy ogrenciYanit fields from verified Firestore data
      updatedMessage.ogrenciYanit = verifyDataForState?.ogrenciYanit || selectedMessage.ogrenciYanit || "";
      updatedMessage.ogrenciYanitTarihi = verifyDataForState?.ogrenciYanitTarihi || selectedMessage.ogrenciYanitTarihi || undefined;
      updatedMessage.ogrenciYanitAttachments = verifyDataForState?.ogrenciYanitAttachments || selectedMessage.ogrenciYanitAttachments || [];
      
      // LOG: After local state update
      console.log("🟪 [ADMIN REPLY] AFTER LOCAL STATE UPDATE:");
      console.log("  - updatedMessage.ogrenciYanitlar:", updatedMessage.ogrenciYanitlar);
      console.log("  - updatedMessage.ogrenciYanit:", updatedMessage.ogrenciYanit);
      console.log("  - updatedMessage.yanitlar count:", updatedMessage.yanitlar?.length || 0);
      
      // Update messages list first
      const updatedDestekMesajlari = destekMesajlari.map(msg => 
        msg.id === selectedMessage.id && msg.userId === selectedMessage.userId
          ? updatedMessage
          : msg
      );
      setDestekMesajlari(updatedDestekMesajlari);
      
      // Then update selected message to trigger re-render with updated conversation
      setSelectedMessage(updatedMessage);
      
      // Scroll to bottom to show new message
      setTimeout(() => scrollToBottom(), 300);
      setTimeout(() => scrollToBottom(), 600);
    } catch (error) {
      console.error("Yanıt gönderme hatası:", error);
      // Only show error toast, not success
      showToast("Yanıt gönderilirken bir hata oluştu.", "error");
    } finally {
      setReplying(false);
      setUploadingFiles(false);
    }
  };

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

  // Each support message is a separate conversation
  const conversationList = destekMesajlari.map((mesaj) => {
    const profile = userProfiles[mesaj.userId] || {};
    const unreadCount = mesaj.status === "pending" && !mesaj.viewedByAdmin ? 1 : 0;
    
    // For chat view, we'll show this single message and its replies
    const messages = [mesaj];
    
    return {
      userId: mesaj.userId,
      supportId: mesaj.id, // Unique ID for this conversation
      userName: mesaj.userName || profile.name || mesaj.userEmail || "Kullanıcı",
      userEmail: mesaj.userEmail,
      photoURL: profile.photoURL,
      latestMessage: mesaj,
      unreadCount,
      messages: messages, // Single message as conversation
    };
  }).sort((a, b) => {
    const aTime = a.latestMessage.createdAt?.toDate?.()?.getTime() || 0;
    const bTime = b.latestMessage.createdAt?.toDate?.()?.getTime() || 0;
    return bTime - aTime; // Newest first
  });

  const selectedConversation = selectedMessage 
    ? conversationList.find(c => c.supportId === selectedMessage.id)
    : null;

  // Auto-scroll to bottom when new message or selectedMessage changes
  useEffect(() => {
    if (selectedMessage && selectedConversation) {
      // Wait for messages to render, then scroll - use more aggressive approach
      const scroll = () => {
        // Try both mobile and desktop containers
        const containers = [
          messagesContainerRef.current, // Mobile
          messagesContainerRefDesktop.current // Desktop
        ].filter(Boolean) as HTMLDivElement[];
        
        containers.forEach(container => {
          // Check if container is visible and has content
          if (container.offsetHeight > 0 && container.scrollHeight > 0) {
            container.scrollTop = container.scrollHeight;
          }
        });
      };
      // Use longer delays to ensure container is fully rendered
      setTimeout(scroll, 200);
      setTimeout(scroll, 400);
      setTimeout(scroll, 600);
      setTimeout(scroll, 800);
      setTimeout(scroll, 1000);
      setTimeout(scroll, 1200);
    }
  }, [selectedMessage, selectedConversation, replyText]);

  const adminPhotoURL = user?.photoURL || null;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="bg-white/90 backdrop-blur-2xl rounded-3xl p-12 shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-white/50 text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const pendingCount = destekMesajlari.filter(m => m.status === "pending").length;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Destek Mesajları</h1>
        <p className="text-gray-600">
          {pendingCount > 0 && (
            <span className="text-red-600 font-semibold">{pendingCount} bekleyen mesaj</span>
          )}
          {pendingCount === 0 && "Tüm destek mesajları"}
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
            <p className="text-gray-500 font-medium">Henüz destek mesajı yok</p>
          </div>
        ) : (
              conversationList.map((conversation) => {
                const isSelected = selectedMessage?.id === conversation.supportId;
                const latestMsg = conversation.latestMessage;

            return (
              <div
                    key={conversation.supportId}
                    onClick={async () => {
                      setSelectedMessage(latestMsg);
                      setReplyText("");
                      setSelectedStatus(latestMsg.status || "answered");
                      
                      // Mark this specific support message as viewed
                      if (latestMsg.status === "pending" && !latestMsg.viewedByAdmin) {
                        try {
                          const destekRef = doc(db, "users", conversation.userId, "destek", latestMsg.id);
                          const destekSnap = await getDoc(destekRef);
                          
                          if (destekSnap.exists()) {
                            const data = destekSnap.data();
                            if (data.status === "pending" && !data.viewedByAdmin) {
                              await updateDoc(destekRef, { 
                                viewedByAdmin: true, 
                                viewedByAdminAt: Timestamp.now() 
                              });
                            }
                          }
                        } catch (error) {
                          console.error("Destek mesajı görüntüleme hatası:", error);
                        }
                      }
                    }}
                    className={`p-4 border-b border-gray-100/50 cursor-pointer transition-all relative group ${
                      isSelected 
                        ? "bg-blue-50/60 border-l-4 border-l-blue-500 backdrop-blur-sm" 
                        : "hover:bg-white/60 active:bg-gray-50/60"
                    }`}
                  >
                    {/* Delete Button */}
                    <button
                      onClick={(e) => handleDeleteConversation(conversation, e)}
                      className="absolute top-2 right-2 p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      title="Sohbeti Sil"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
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
                          <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${
                            latestMsg.status === "pending" 
                              ? "bg-gradient-to-br from-yellow-400 to-orange-500" 
                              : latestMsg.status === "answered"
                              ? "bg-gradient-to-br from-blue-400 to-cyan-500"
                              : "bg-gradient-to-br from-green-400 to-emerald-500"
                          }`}>
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
                            {latestMsg.konu || conversation.userName}
                          </h3>
                          <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                            {formatTarih(latestMsg.createdAt)}
                          </span>
                        </div>
                        {/* Status Badge */}
                        <div className="mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            latestMsg.status === "pending" 
                              ? "bg-yellow-100 text-yellow-700" 
                              : latestMsg.status === "answered"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                          }`}>
                            {latestMsg.status === "pending" 
                              ? "Beklemede" 
                              : latestMsg.status === "answered"
                              ? "Yanıtlandı"
                              : "Çözüldü"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-600 truncate flex-1">
                            <span className="font-medium">{conversation.userName}:</span>{" "}
                            {latestMsg.mesaj.substring(0, 35)}
                            {latestMsg.mesaj.length > 35 ? "..." : ""}
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
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center ${
                      selectedMessage.status === "pending" 
                        ? "bg-gradient-to-br from-yellow-400 to-orange-500" 
                        : selectedMessage.status === "answered"
                        ? "bg-gradient-to-br from-blue-400 to-cyan-500"
                        : "bg-gradient-to-br from-green-400 to-emerald-500"
                    }`}>
                      <span className="text-white font-bold text-base">
                        {selectedConversation.userName.charAt(0).toUpperCase()}
                    </span>
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900 text-[15px]">{selectedMessage.konu || selectedConversation.userName}</h3>
                    <p className="text-xs text-gray-500">{selectedConversation.userName} • {selectedConversation.userEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${
                    selectedMessage.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                    selectedMessage.status === "answered" ? "bg-blue-100 text-blue-700" :
                    "bg-green-100 text-green-700"
                  }`}>
                    {selectedMessage.status === "pending" ? "Beklemede" : selectedMessage.status === "answered" ? "Yanıtlandı" : "Çözüldü"}
                  </span>
                  {selectedConversation && (
                    <button
                      onClick={async () => {
                        if (!confirm(`"${selectedMessage.konu || selectedConversation.userName}" konulu destek mesajını silmek istediğinize emin misiniz?`)) {
                          return;
                        }
                        try {
                          const destekRef = doc(db, "users", selectedMessage.userId, "destek", selectedMessage.id);
                          await deleteDoc(destekRef);
                          setSelectedMessage(null);
                          setReplyText("");
                          showToast("Destek mesajı başarıyla silindi.", "success");
                        } catch (error) {
                          console.error("Destek mesajı silme hatası:", error);
                          showToast("Destek mesajı silinirken bir hata oluştu.", "error");
                        }
                      }}
                      className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition"
                      title="Sohbeti Sil"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
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
                {(() => {
                  if (!selectedConversation) return null;
                  
                  // Create a flat array of all messages (user messages + admin replies) with timestamps
                  const allMessages: Array<{
                    type: 'user' | 'admin';
                    mesaj: DestekMesaji;
                    timestamp: Timestamp;
                    content: string;
                    attachments?: string[];
                    readByAdmin?: boolean; // Admin tarafından okundu mu (öğrenci mesajları için)
                    readByStudent?: boolean; // Öğrenci tarafından okundu mu (admin mesajları için)
                  }> = [];

                  // Debug: Log all messages
                  console.log("Selected conversation messages:", selectedConversation.messages.length, selectedConversation.messages);

                  selectedConversation.messages.forEach((mesaj) => {
                    // Add user's initial message only if it has content or attachments
                    if (mesaj.mesaj || (mesaj.attachments && mesaj.attachments.length > 0)) {
                      allMessages.push({
                        type: 'user',
                        mesaj,
                        timestamp: mesaj.createdAt,
                        content: mesaj.mesaj || '',
                        attachments: mesaj.attachments,
                        readByAdmin: mesaj.readByAdmin || false, // Admin okudu mu
                      });
                    }

                    // Add admin replies (from array or legacy field)
                    if (mesaj.yanitlar && Array.isArray(mesaj.yanitlar) && mesaj.yanitlar.length > 0) {
                      // New array format
                      mesaj.yanitlar.forEach((yanit: any) => {
                        allMessages.push({
                          type: 'admin',
                          mesaj,
                          timestamp: yanit.timestamp || mesaj.createdAt,
                          content: yanit.content || '',
                          attachments: yanit.attachments || [],
                          readByStudent: yanit.readByStudent || false, // Öğrenci okudu mu
                        });
                      });
                    } else if (mesaj.yanit || (mesaj.yanitAttachments && mesaj.yanitAttachments.length > 0)) {
                      // Legacy single field format
                      allMessages.push({
                        type: 'admin',
                        mesaj,
                        timestamp: mesaj.yanitTarihi || mesaj.createdAt,
                        content: mesaj.yanit || '',
                        attachments: mesaj.yanitAttachments || [],
                        readByStudent: mesaj.readByStudent || false, // Öğrenci okudu mu
                      });
                    }

                    // Add student replies (from array or legacy field)
                    if (mesaj.ogrenciYanitlar && Array.isArray(mesaj.ogrenciYanitlar) && mesaj.ogrenciYanitlar.length > 0) {
                      // New array format
                      mesaj.ogrenciYanitlar.forEach((ogrenciYanit: any) => {
                        allMessages.push({
                          type: 'user',
                          mesaj,
                          timestamp: ogrenciYanit.timestamp || mesaj.createdAt,
                          content: ogrenciYanit.content || '',
                          attachments: ogrenciYanit.attachments || [],
                          readByAdmin: ogrenciYanit.readByAdmin || false, // Admin okudu mu
                        });
                      });
                    } else if (mesaj.ogrenciYanit || (mesaj.ogrenciYanitAttachments && mesaj.ogrenciYanitAttachments.length > 0)) {
                      // Legacy single field format
                      allMessages.push({
                        type: 'user',
                        mesaj,
                        timestamp: mesaj.ogrenciYanitTarihi || mesaj.createdAt,
                        content: mesaj.ogrenciYanit || '',
                        attachments: mesaj.ogrenciYanitAttachments || [],
                        readByAdmin: false, // Admin okudu mu (legacy için varsayılan false)
                      });
                    }
                  });

                  // Remove duplicates based on content, timestamp, and type
                  const uniqueMessages = allMessages.filter((msg, index, self) => {
                    const msgTime = msg.timestamp?.toDate?.()?.getTime() || 0;
                    const msgContent = msg.content || '';
                    const msgKey = `${msg.type}-${msg.mesaj.id}-${msgTime}-${msgContent}`;
                    return index === self.findIndex((m) => {
                      const mTime = m.timestamp?.toDate?.()?.getTime() || 0;
                      const mContent = m.content || '';
                      return `${m.type}-${m.mesaj.id}-${mTime}-${mContent}` === msgKey;
                    });
                  });

                  // Sort all messages chronologically (oldest first)
                  uniqueMessages.sort((a, b) => {
                    const aTime = a.timestamp?.toDate?.()?.getTime() || 0;
                    const bTime = b.timestamp?.toDate?.()?.getTime() || 0;
                    return aTime - bTime;
                  });

                  return uniqueMessages.map((msg, index) => {
                    const prevMsg = index > 0 ? allMessages[index - 1] : null;
                    const showAvatar = !prevMsg || prevMsg.type !== msg.type;
                    const msgTimestamp = msg.timestamp?.toDate?.()?.getTime() || 0;
                    const uniqueKey = `${msg.type}-${msg.mesaj.id}-${msgTimestamp}-${index}`;

                    if (msg.type === 'user') {
                      return (
                        <div key={uniqueKey} className="flex items-end gap-2 mb-3">
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
                              {msg.content && (
                                <p className="text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                                  {msg.content}
                                </p>
                              )}
                              {!msg.content && !msg.attachments && (
                                <p className="text-[15px] text-gray-500 italic">Görsel gönderildi</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mt-1 px-1">
                              <span className="text-[11px] text-gray-500">
                                {formatTarih(msg.timestamp)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      const msgTimestamp = msg.timestamp?.toDate?.()?.getTime() || 0;
                      const uniqueKey = `${msg.type}-${msg.mesaj.id}-${msgTimestamp}-${index}`;
                      return (
                        <div key={uniqueKey} className="flex items-end gap-2 mb-3 flex-row-reverse">
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
                              {msg.content && (
                                <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                                  {msg.content}
                        </p>
                      )}
                            </div>
                            <div className="flex items-center gap-1 mt-1 px-1 justify-end">
                              <span className="text-[11px] text-gray-500">
                                {formatTarih(msg.timestamp)}
                              </span>
                              {/* Read receipt for admin messages */}
                              {msg.type === 'admin' && (
                                <span className={`text-[12px] ${msg.readByStudent ? 'text-blue-500' : 'text-gray-400'}`}>
                                  {msg.readByStudent ? '✓✓' : '✓'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  });
                })()}

                <div ref={messagesEndRef} />
              </div>

              {/* iOS Style Message Input */}
              <form onSubmit={handleDestekYanit} className="p-3 border-t border-gray-200/30 bg-white/90 backdrop-blur-xl">
                  {/* Status Selector */}
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-600">Durum:</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          setSelectedStatus("pending");
                          if (selectedMessage) {
                            await handleStatusChange("pending");
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                          selectedStatus === "pending"
                            ? "bg-yellow-500 text-white shadow-md"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        Beklemede
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setSelectedStatus("answered");
                          if (selectedMessage) {
                            await handleStatusChange("answered");
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                          selectedStatus === "answered"
                            ? "bg-blue-500 text-white shadow-md"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        Yanıtlandı
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setSelectedStatus("closed");
                          if (selectedMessage) {
                            await handleStatusChange("closed");
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                          selectedStatus === "closed"
                            ? "bg-green-500 text-white shadow-md"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        Çözüldü
                      </button>
                    </div>
                  </div>
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
                            handleDestekYanit(e);
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
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Bir konuşma seçin</h3>
                <p className="text-sm text-gray-600 font-medium">Sol panelden bir destek mesajı seçerek başlayın</p>
              </div>
            </div>
        )}
        </div>
      </div>

      {/* Mobile View - iOS Premium Style */}
      {selectedMessage && selectedConversation && (
        <div className="md:hidden fixed inset-0 z-50 bg-white flex flex-col">
          {/* iOS Style Mobile Header */}
          <div className="p-4 border-b border-gray-200/30 bg-white/95 backdrop-blur-xl flex items-center gap-3 shadow-sm">
                <button
              onClick={() => setSelectedMessage(null)}
              className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
            {selectedConversation.photoURL ? (
              <img
                src={selectedConversation.photoURL}
                alt={selectedConversation.userName}
                className="w-10 h-10 rounded-full object-cover border border-gray-200"
              />
            ) : (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                selectedMessage.status === "pending" 
                  ? "bg-gradient-to-br from-yellow-400 to-orange-500" 
                  : selectedMessage.status === "answered"
                  ? "bg-gradient-to-br from-blue-400 to-cyan-500"
                  : "bg-gradient-to-br from-green-400 to-emerald-500"
              }`}>
                <span className="text-white font-bold text-sm">
                  {selectedConversation.userName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 text-[15px]">{selectedMessage.konu || selectedConversation.userName}</h3>
              <p className="text-xs text-gray-500">{selectedConversation.userName} • {selectedConversation.userEmail}</p>
            </div>
            <button
              onClick={async () => {
                if (!confirm(`"${selectedMessage.konu || selectedConversation.userName}" konulu destek mesajını silmek istediğinize emin misiniz?`)) {
                  return;
                }
                try {
                  const destekRef = doc(db, "users", selectedMessage.userId, "destek", selectedMessage.id);
                  await deleteDoc(destekRef);
                  setSelectedMessage(null);
                  setReplyText("");
                  showToast("Destek mesajı başarıyla silindi.", "success");
                } catch (error) {
                  console.error("Destek mesajı silme hatası:", error);
                  showToast("Destek mesajı silinirken bir hata oluştu.", "error");
                }
              }}
              className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition"
              title="Sohbeti Sil"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          {/* iOS Style Mobile Messages */}
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 bg-[#f0f2f5]"
            style={{
              backgroundImage: "radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.03) 0%, transparent 50%)"
            }}
          >
            {/* All Messages - WhatsApp Style Chronological Order */}
            {(() => {
              if (!selectedConversation) return null;
              
              // Create a flat array of all messages (user messages + admin replies) with timestamps
              const allMessages: Array<{
                type: 'user' | 'admin';
                mesaj: DestekMesaji;
                timestamp: Timestamp;
                content: string;
                attachments?: string[];
                readByAdmin?: boolean; // Admin tarafından okundu mu (öğrenci mesajları için)
                readByStudent?: boolean; // Öğrenci tarafından okundu mu (admin mesajları için)
              }> = [];

              selectedConversation.messages.forEach((mesaj) => {
                // Add user's initial message only if it has content or attachments
                if (mesaj.mesaj || (mesaj.attachments && mesaj.attachments.length > 0)) {
                  allMessages.push({
                    type: 'user',
                    mesaj,
                    timestamp: mesaj.createdAt,
                    content: mesaj.mesaj || '',
                    attachments: mesaj.attachments,
                    readByAdmin: mesaj.readByAdmin || false,
                  });
                }

                // Add admin replies (from array or legacy field)
                if (mesaj.yanitlar && Array.isArray(mesaj.yanitlar) && mesaj.yanitlar.length > 0) {
                  // New array format
                  mesaj.yanitlar.forEach((yanit: any) => {
                    allMessages.push({
                      type: 'admin',
                      mesaj,
                      timestamp: yanit.timestamp || mesaj.createdAt,
                      content: yanit.content || '',
                      attachments: yanit.attachments || [],
                      readByStudent: yanit.readByStudent || false,
                    });
                  });
                } else if (mesaj.yanit || (mesaj.yanitAttachments && mesaj.yanitAttachments.length > 0)) {
                  // Legacy single field format
                  allMessages.push({
                    type: 'admin',
                    mesaj,
                    timestamp: mesaj.yanitTarihi || mesaj.createdAt,
                    content: mesaj.yanit || '',
                    attachments: mesaj.yanitAttachments || [],
                    readByStudent: mesaj.readByStudent || false,
                  });
                }

                // Add student replies (from array or legacy field)
                if (mesaj.ogrenciYanitlar && Array.isArray(mesaj.ogrenciYanitlar) && mesaj.ogrenciYanitlar.length > 0) {
                  // New array format
                  mesaj.ogrenciYanitlar.forEach((ogrenciYanit: any) => {
                    allMessages.push({
                      type: 'user',
                      mesaj,
                      timestamp: ogrenciYanit.timestamp || mesaj.createdAt,
                      content: ogrenciYanit.content || '',
                      attachments: ogrenciYanit.attachments || [],
                      readByAdmin: ogrenciYanit.readByAdmin || false,
                    });
                  });
                } else if (mesaj.ogrenciYanit || (mesaj.ogrenciYanitAttachments && mesaj.ogrenciYanitAttachments.length > 0)) {
                  // Legacy single field format
                  allMessages.push({
                    type: 'user',
                    mesaj,
                    timestamp: mesaj.ogrenciYanitTarihi || mesaj.createdAt,
                    content: mesaj.ogrenciYanit || '',
                    attachments: mesaj.ogrenciYanitAttachments || [],
                    readByAdmin: false,
                  });
                }
              });

              // Remove duplicates based on content, timestamp, and type
              const uniqueMessages = allMessages.filter((msg, index, self) => {
                const msgTime = msg.timestamp?.toDate?.()?.getTime() || 0;
                const msgContent = msg.content || '';
                const msgKey = `${msg.type}-${msg.mesaj.id}-${msgTime}-${msgContent}`;
                return index === self.findIndex((m) => {
                  const mTime = m.timestamp?.toDate?.()?.getTime() || 0;
                  const mContent = m.content || '';
                  return `${m.type}-${m.mesaj.id}-${mTime}-${mContent}` === msgKey;
                });
              });

              // Sort all messages chronologically (oldest first)
              uniqueMessages.sort((a, b) => {
                const aTime = a.timestamp?.toDate?.()?.getTime() || 0;
                const bTime = b.timestamp?.toDate?.()?.getTime() || 0;
                return aTime - bTime;
              });

              return uniqueMessages.map((msg, index) => {
                const prevMsg = index > 0 ? uniqueMessages[index - 1] : null;
                const showAvatar = !prevMsg || prevMsg.type !== msg.type;
                const msgTimestamp = msg.timestamp?.toDate?.()?.getTime() || 0;
                const uniqueKey = `${msg.type}-${msg.mesaj.id}-${msgTimestamp}-${index}`;

                if (msg.type === 'user') {
                  return (
                    <div key={uniqueKey} className="flex items-end gap-2 mb-3">
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
                          {msg.content && (
                            <p className="text-[15px] text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                              {msg.content}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-1 px-1">
                          <span className="text-[11px] text-gray-500">
                            {formatTarih(msg.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                } else {
                      const msgTimestamp = msg.timestamp?.toDate?.()?.getTime() || 0;
                      const uniqueKey = `${msg.type}-${msg.mesaj.id}-${msgTimestamp}-${index}`;
                      return (
                        <div key={uniqueKey} className="flex items-end gap-2 mb-3 flex-row-reverse">
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
                          {msg.content && (
                            <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                              {msg.content}
                            </p>
                          )}
                          {!msg.content && !msg.attachments && (
                            <p className="text-[15px] text-white/80 italic">Görsel gönderildi</p>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-500 mt-1 px-1">
                          {formatTarih(msg.timestamp)}
                        </span>
                      </div>
                    </div>
                  );
                }
              });
            })()}

            <div ref={messagesEndRef} />
          </div>

          {/* iOS Style Mobile Input */}
          <form onSubmit={handleDestekYanit} className="p-3 border-t border-gray-200/30 bg-white/95 backdrop-blur-xl safe-area-bottom">
              {/* Status Selector */}
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-medium text-gray-600">Durum:</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedStatus("pending")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      selectedStatus === "pending"
                        ? "bg-yellow-500 text-white shadow-md"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Beklemede
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStatus("answered")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      selectedStatus === "answered"
                        ? "bg-blue-500 text-white shadow-md"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Yanıtlandı
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStatus("closed")}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      selectedStatus === "closed"
                        ? "bg-green-500 text-white shadow-md"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Çözüldü
                  </button>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
              <textarea
                    ref={textareaRef}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleDestekYanit(e);
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
                  {replying || uploadingFiles ? (
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

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />

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
    </div>
  );
}
