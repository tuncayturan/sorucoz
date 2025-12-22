import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  onSnapshot,
  orderBy,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";

interface Conversation {
  id: string;
  studentId: string;
  coachId: string;
  coachName: string;
  coachPhoto?: string | null;
  coachTitle?: string | null;
  lastMessage?: Timestamp;
  lastMessageText?: string;
  unreadCount: number;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string | null;
  createdAt: Timestamp;
  read: boolean;
  readByStudent?: boolean;
  readByCoach?: boolean;
  type: "user" | "coach" | "admin";
  attachments?: string[];
  audioUrl?: string;
}

export default function MesajlarScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);

  // Get or create conversation ID
  const getConversationId = (studentId: string, coachId: string) => {
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
        await updateDoc(conversationRef, {
          studentId: user.uid,
          coachId: coachId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(async () => {
          // If update fails, try setDoc
          await addDoc(collection(db, "conversations"), {
            studentId: user.uid,
            coachId: coachId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
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

  // Fetch conversations
  useEffect(() => {
    if (!user || userData?.role !== "student") return;

    const fetchConversations = async () => {
      try {
        setLoading(true);
        
        const coachesQuery = query(collection(db, "users"), where("role", "==", "coach"));
        const coachesSnapshot = await getDocs(coachesQuery);
        
        const conversationsList: Conversation[] = [];
        
        for (const coachDoc of coachesSnapshot.docs) {
          const coachId = coachDoc.id;
          const coachData = coachDoc.data();
          const conversationId = getConversationId(user.uid, coachId);
          
          const messagesRef = collection(db, "conversations", conversationId, "messages");
          const allMessagesSnapshot = await getDocs(messagesRef);
          const unreadCount = allMessagesSnapshot.docs.filter(doc => {
            const data = doc.data();
            return !data.readByStudent && data.senderId !== user.uid;
          }).length;

          const lastMessageQuery = query(messagesRef, orderBy("createdAt", "desc"), { limit: 1 });
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
            coachTitle: coachData.title || null,
            lastMessage,
            lastMessageText,
            unreadCount,
          });
        }
        
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
  }, [user, userData]);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConversation || !user) return;

    const messagesRef = collection(db, "conversations", selectedConversation.id, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const mesajListesi: Message[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          mesajListesi.push({
            id: doc.id,
            ...data,
          } as Message);
        });
        setMessages(mesajListesi);

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

  const handleSend = async () => {
    if (!user || !selectedConversation || !newMessage.trim() || sending) return;

    try {
      setSending(true);

      await getOrCreateConversation(
        selectedConversation.coachId,
        selectedConversation.coachName,
        selectedConversation.coachPhoto
      );

      const messagesRef = collection(db, "conversations", selectedConversation.id, "messages");
      
      await addDoc(messagesRef, {
        text: newMessage.trim(),
        senderId: user.uid,
        senderName: userData?.name || user?.displayName || "Öğrenci",
        senderPhoto: userData?.photoURL || user?.photoURL || null,
        createdAt: serverTimestamp(),
        read: false,
        readByStudent: true,
        readByCoach: false,
        type: "user",
        attachments: [],
      });

      const conversationRef = doc(db, "conversations", selectedConversation.id);
      await updateDoc(conversationRef, {
        updatedAt: serverTimestamp(),
      });

      setNewMessage("");
    } catch (error) {
      console.error("Mesaj gönderilirken hata:", error);
      Alert.alert("Hata", "Mesaj gönderilirken bir hata oluştu.");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: Timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  };

  if (authLoading || userDataLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (!selectedConversation) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mesajlar</Text>
        </View>
        <ScrollView style={styles.conversationsList}>
          {conversations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Henüz mesajınız yok</Text>
            </View>
          ) : (
            conversations.map((conv) => (
              <TouchableOpacity
                key={conv.id}
                style={styles.conversationItem}
                onPress={() => setSelectedConversation(conv)}
              >
                {conv.coachPhoto ? (
                  <Image source={{ uri: conv.coachPhoto }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>
                      {conv.coachName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.conversationInfo}>
                  <View style={styles.conversationHeader}>
                    <Text style={styles.conversationName}>{conv.coachName}</Text>
                    {conv.unreadCount > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{conv.unreadCount}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {conv.lastMessageText || "Henüz mesaj yok"}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setSelectedConversation(null)}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          {selectedConversation.coachPhoto ? (
            <Image
              source={{ uri: selectedConversation.coachPhoto }}
              style={styles.headerAvatar}
            />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Text style={styles.headerAvatarText}>
                {selectedConversation.coachName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View>
            <Text style={styles.headerName}>{selectedConversation.coachName}</Text>
            {selectedConversation.coachTitle && (
              <Text style={styles.headerTitle}>{selectedConversation.coachTitle}</Text>
            )}
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((msg) => {
          const isMe = msg.senderId === user?.uid;
          return (
            <View
              key={msg.id}
              style={[styles.messageContainer, isMe ? styles.messageRight : styles.messageLeft]}
            >
              {!isMe && (
                msg.senderPhoto ? (
                  <Image source={{ uri: msg.senderPhoto }} style={styles.messageAvatar} />
                ) : (
                  <View style={styles.messageAvatarPlaceholder}>
                    <Text style={styles.messageAvatarText}>
                      {msg.senderName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )
              )}
              <View style={[styles.messageBubble, isMe ? styles.messageBubbleRight : styles.messageBubbleLeft]}>
                {msg.audioUrl ? (
                  <View style={styles.audioMessage}>
                    <Ionicons name="mic" size={20} color={isMe ? "#fff" : "#333"} />
                    <Text style={[styles.audioText, isMe && styles.audioTextRight]}>Ses mesajı</Text>
                  </View>
                ) : (
                  <Text style={[styles.messageText, isMe && styles.messageTextRight]}>
                    {msg.text}
                  </Text>
                )}
                <Text style={[styles.messageTime, isMe && styles.messageTimeRight]}>
                  {formatTime(msg.createdAt)}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Mesaj yazın..."
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, sending && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={sending || !newMessage.trim()}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f7",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f7",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  backButton: {
    marginRight: 12,
  },
  headerInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerAvatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  headerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  conversationsList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: "#999",
  },
  conversationItem: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  conversationInfo: {
    flex: 1,
    justifyContent: "center",
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  badge: {
    backgroundColor: "#4CAF50",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  lastMessage: {
    fontSize: 14,
    color: "#666",
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  messageContainer: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-end",
  },
  messageLeft: {
    justifyContent: "flex-start",
  },
  messageRight: {
    justifyContent: "flex-end",
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  messageAvatarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  messageBubble: {
    maxWidth: "75%",
    padding: 12,
    borderRadius: 16,
  },
  messageBubbleLeft: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
  },
  messageBubbleRight: {
    backgroundColor: "#4CAF50",
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: "#333",
    lineHeight: 20,
  },
  messageTextRight: {
    color: "#fff",
  },
  messageTime: {
    fontSize: 11,
    color: "#999",
    marginTop: 4,
  },
  messageTimeRight: {
    color: "rgba(255,255,255,0.8)",
  },
  audioMessage: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  audioText: {
    fontSize: 14,
    color: "#333",
  },
  audioTextRight: {
    color: "#fff",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
