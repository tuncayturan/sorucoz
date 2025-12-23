"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc, Timestamp, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast from "@/components/ui/Toast";

interface Event {
  id: string;
  title: string;
  description?: string;
  date: Timestamp;
  type: "meeting" | "other";
  zoomLink?: string;
  createdAt: Timestamp;
}

export default function CoachCalendarPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    time: new Date().toTimeString().slice(0, 5),
    type: "meeting" as "meeting" | "other",
    zoomLink: "",
  });
  const [saving, setSaving] = useState(false);
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
        if (userData?.role === "admin") {
          router.replace("/admin");
        } else {
          router.replace("/home");
        }
      }
    }
  }, [user, userData, authLoading, userDataLoading, router]);

  // Fetch events
  useEffect(() => {
    if (!user || userData?.role !== "coach") return;

    const eventsRef = collection(db, "users", user.uid, "events");
    const q = query(eventsRef, orderBy("date", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsList: Event[] = [];
      snapshot.forEach((doc) => {
        eventsList.push({
          id: doc.id,
          ...doc.data(),
        } as Event);
      });
      setEvents(eventsList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, userData]);

  const handleAddEvent = async () => {
    if (!eventForm.title.trim() || !user) return;

    try {
      setSaving(true);

      // Combine date and time
      const [year, month, day] = eventForm.date.split("-").map(Number);
      const [hours, minutes] = eventForm.time.split(":").map(Number);
      const eventDate = new Date(year, month - 1, day, hours, minutes);

      const eventsRef = collection(db, "users", user.uid, "events");
      const newEventRef = await addDoc(eventsRef, {
        title: eventForm.title.trim(),
        description: eventForm.description.trim() || "",
        date: Timestamp.fromDate(eventDate),
        type: eventForm.type,
        zoomLink: eventForm.type === "meeting" ? (eventForm.zoomLink.trim() || "") : "",
        createdAt: Timestamp.now(),
      });

      // Tüm öğrencilere push bildirim gönder (arka planda, kaydı bloklamadan)
      try {
        fetch("/api/admin/send-notification-to-students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Yeni Etkinlik",
            body: `${userData?.name || "Koçunuz"} yeni bir etkinlik ekledi: ${eventForm.title.trim()}`,
            data: {
              type: "event",
              eventId: newEventRef.id,
              coachId: user.uid,
              url: "/etkinlikler",
            },
          }),
        }).catch((err) => {        });
      } catch (notifError) {      }

      setEventForm({
        title: "",
        description: "",
        date: new Date().toISOString().split("T")[0],
        time: new Date().toTimeString().slice(0, 5),
        type: "meeting",
        zoomLink: "",
      });
      setShowAddModal(false);
      showToast("Etkinlik başarıyla eklendi!", "success");
    } catch (error) {      showToast("Etkinlik eklenirken bir hata oluştu.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleEditEvent = (event: Event) => {
    const eventDate = event.date.toDate();
    setEventForm({
      title: event.title,
      description: event.description || "",
      date: eventDate.toISOString().split("T")[0],
      time: eventDate.toTimeString().slice(0, 5),
      type: event.type,
      zoomLink: event.zoomLink || "",
    });
    setEditingEventId(event.id);
    setShowEditModal(true);
  };

  const handleUpdateEvent = async () => {
    if (!eventForm.title.trim() || !user || !editingEventId) return;

    try {
      setSaving(true);

      // Combine date and time
      const [year, month, day] = eventForm.date.split("-").map(Number);
      const [hours, minutes] = eventForm.time.split(":").map(Number);
      const eventDate = new Date(year, month - 1, day, hours, minutes);

      const eventRef = doc(db, "users", user.uid, "events", editingEventId);
      await updateDoc(eventRef, {
        title: eventForm.title.trim(),
        description: eventForm.description.trim() || "",
        date: Timestamp.fromDate(eventDate),
        type: eventForm.type,
        zoomLink: eventForm.type === "meeting" ? (eventForm.zoomLink.trim() || "") : "",
      });

      // Etkinlik güncellendiğinde de isteğe bağlı bildirim gönder (arka planda)
      try {
        fetch("/api/admin/send-notification-to-students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Etkinlik Güncellendi",
            body: `${userData?.name || "Koçunuz"} bir etkinliği güncelledi: ${eventForm.title.trim()}`,
            data: {
              type: "event_update",
              eventId: editingEventId,
              coachId: user.uid,
              url: "/etkinlikler",
            },
          }),
        }).catch((err) => {        });
      } catch (notifError) {      }

      setEventForm({
        title: "",
        description: "",
        date: new Date().toISOString().split("T")[0],
        time: new Date().toTimeString().slice(0, 5),
        type: "meeting",
        zoomLink: "",
      });
      setShowEditModal(false);
      setEditingEventId(null);
      showToast("Etkinlik başarıyla güncellendi!", "success");
    } catch (error) {      showToast("Etkinlik güncellenirken bir hata oluştu.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!user || !confirm("Bu etkinliği silmek istediğinize emin misiniz?")) return;

    try {
      await deleteDoc(doc(db, "users", user.uid, "events", eventId));
      showToast("Etkinlik silindi!", "success");
    } catch (error) {      showToast("Etkinlik silinirken bir hata oluştu.", "error");
    }
  };

  const formatDate = (timestamp: Timestamp) => {
    const date = timestamp.toDate();
    return date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getUpcomingEvents = () => {
    const now = new Date();
    return events
      .filter((event) => event.date.toDate() >= now)
      .sort((a, b) => a.date.toDate().getTime() - b.date.toDate().getTime())
      .slice(0, 5);
  };

  if (authLoading || userDataLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  const upcomingEvents = getUpcomingEvents();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push("/coach/chat")}
            className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Geri Dön
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Takvim</h1>
              <p className="text-gray-600 mt-2">Etkinliklerinizi yönetin</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition"
            >
              + Etkinlik Ekle
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upcoming Events */}
          <div className="lg:col-span-2">
            <div className="bg-white/90 backdrop-blur-2xl rounded-[2rem] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-white/50 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Yaklaşan Etkinlikler</h2>
              {upcomingEvents.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-500">Henüz etkinlik yok</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingEvents.map((event) => (
                    <div
                      key={event.id}
                      className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              event.type === "meeting"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}>
                              {event.type === "meeting" ? "Canlı Toplantı" : "Diğer"}
                            </span>
                          </div>
                          <h3 className="font-semibold text-gray-900 mb-1">{event.title}</h3>
                          {event.description && (
                            <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                          )}
                          <p className="text-xs text-gray-500">{formatDate(event.date)}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleEditEvent(event)}
                            className="text-blue-500 hover:text-blue-700 transition"
                            title="Düzenle"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="text-red-500 hover:text-red-700 transition"
                            title="Sil"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* All Events List */}
          <div>
            <div className="bg-white/90 backdrop-blur-2xl rounded-[2rem] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-white/50 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Tüm Etkinlikler</h2>
              {events.length === 0 ? (
                <p className="text-gray-500 text-sm">Henüz etkinlik yok</p>
              ) : (
                <div className="space-y-3">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="p-3 bg-gray-50 rounded-xl border border-gray-100"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-gray-900 text-sm">{event.title}</h4>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            event.type === "meeting"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}>
                            {event.type === "meeting" ? "Toplantı" : "Diğer"}
                          </span>
                          <button
                            onClick={() => handleEditEvent(event)}
                            className="text-blue-500 hover:text-blue-700 transition"
                            title="Düzenle"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="text-red-500 hover:text-red-700 transition"
                            title="Sil"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">{formatDate(event.date)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Event Modal */}
      {showEditModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowEditModal(false);
            setEditingEventId(null);
          }}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Etkinliği Düzenle</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Başlık</label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Etkinlik başlığı"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama</label>
                <textarea
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Etkinlik açıklaması"
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tarih</label>
                  <input
                    type="date"
                    value={eventForm.date}
                    onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Saat</label>
                  <input
                    type="time"
                    value={eventForm.time}
                    onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Etkinlik Tipi</label>
                <select
                  value={eventForm.type}
                  onChange={(e) => setEventForm({ ...eventForm, type: e.target.value as "meeting" | "other", zoomLink: e.target.value === "other" ? "" : eventForm.zoomLink })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="meeting">Canlı Toplantı</option>
                  <option value="other">Diğer</option>
                </select>
              </div>
              
              {eventForm.type === "meeting" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Zoom Linki <span className="text-gray-500 text-xs">(Opsiyonel)</span>
                  </label>
                  <input
                    type="url"
                    value={eventForm.zoomLink}
                    onChange={(e) => setEventForm({ ...eventForm, zoomLink: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="https://zoom.us/j/..."
                  />
                  <p className="text-xs text-gray-500 mt-1">Öğrenciler bu link ile toplantıya katılabilecek</p>
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUpdateEvent}
                disabled={saving || !eventForm.title.trim()}
                className="flex-1 px-6 py-3 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition disabled:opacity-50"
              >
                {saving ? "Güncelleniyor..." : "Güncelle"}
              </button>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingEventId(null);
                }}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Yeni Etkinlik</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Başlık</label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Etkinlik başlığı"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama</label>
                <textarea
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Etkinlik açıklaması"
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tarih</label>
                  <input
                    type="date"
                    value={eventForm.date}
                    onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Saat</label>
                  <input
                    type="time"
                    value={eventForm.time}
                    onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Etkinlik Tipi</label>
                <select
                  value={eventForm.type}
                  onChange={(e) => setEventForm({ ...eventForm, type: e.target.value as "meeting" | "other", zoomLink: e.target.value === "other" ? "" : eventForm.zoomLink })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="meeting">Canlı Toplantı</option>
                  <option value="other">Diğer</option>
                </select>
              </div>
              
              {eventForm.type === "meeting" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Zoom Linki <span className="text-gray-500 text-xs">(Opsiyonel)</span>
                  </label>
                  <input
                    type="url"
                    value={eventForm.zoomLink}
                    onChange={(e) => setEventForm({ ...eventForm, zoomLink: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="https://zoom.us/j/..."
                  />
                  <p className="text-xs text-gray-500 mt-1">Öğrenciler bu link ile toplantıya katılabilecek</p>
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddEvent}
                disabled={saving || !eventForm.title.trim()}
                className="flex-1 px-6 py-3 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition disabled:opacity-50"
              >
                {saving ? "Ekleniyor..." : "Ekle"}
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition"
              >
                İptal
              </button>
            </div>
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


