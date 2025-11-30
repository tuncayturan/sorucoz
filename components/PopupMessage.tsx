"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useUserData } from "@/hooks/useUserData";
import { useAuth } from "@/context/AuthContext";

interface PopupMesaj {
  enabled: boolean;
  title: string;
  message: string;
  buttonText: string;
  buttonColor: string;
  showOnce: boolean;
  imageUrl?: string;
}

export default function PopupMessage() {
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();
  const [popup, setPopup] = useState<PopupMesaj | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Auth ve userData yüklenene kadar bekle
    if (authLoading || userDataLoading) {
      setPopup(null);
      setShow(false);
      return () => {}; // Cleanup function her zaman return edilmeli
    }
    
    // Sadece login yapmış öğrenci rolündeki kullanıcılara göster
    if (!user || !userData || userData.role !== "student") {
      setPopup(null);
      setShow(false);
      return () => {}; // Cleanup function her zaman return edilmeli
    }

    const popupRef = doc(db, "adminSettings", "popupMessage");

    const unsubscribe = onSnapshot(popupRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as PopupMesaj;
        
        // Popup aktif değilse gösterme
        if (!data.enabled) {
          setPopup(null);
          setShow(false);
          return;
        }

        // "Sadece Bir Kez Göster" aktifse ve daha önce kapatıldıysa gösterme
        if (data.showOnce) {
          const popupClosed = localStorage.getItem("popupMessageClosed");
          if (popupClosed === "true") {
            setPopup(null);
            setShow(false);
            return;
          }
        }

        setPopup(data);
        setShow(true);
      } else {
        setPopup(null);
        setShow(false);
      }
    });

    return () => unsubscribe();
  }, [user, userData, authLoading, userDataLoading]);

  const handleClose = () => {
    setShow(false);
    
    // "Sadece Bir Kez Göster" aktifse localStorage'a kaydet
    if (popup?.showOnce) {
      localStorage.setItem("popupMessageClosed", "true");
    }
  };

  if (!show || !popup) return null;

  return (
    <>
      <style jsx global>{`
        @keyframes popupFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popupSlideUpScale {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .popup-backdrop {
          animation: popupFadeIn 0.3s ease-out;
        }
        .popup-content {
          animation: popupSlideUpScale 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>
      <div 
        className="popup-backdrop fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <div 
          className="popup-content bg-gradient-to-br from-white via-white to-gray-50/80 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_25px_80px_rgba(0,0,0,0.25)] p-8 max-w-md w-full max-h-[90vh] overflow-y-auto border border-white/80 relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button - iOS Style */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-100/80 hover:bg-gray-200/80 flex items-center justify-center transition-all transform active:scale-95 shadow-sm z-10"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Content */}
          <div className="pr-8">
            {popup.title && (
              <h3 className="text-2xl font-bold text-gray-900 tracking-tight mb-4 pr-4">
                {popup.title}
              </h3>
            )}
            
            {popup.imageUrl && (
              <div className="mb-6 rounded-2xl overflow-hidden shadow-lg">
                <img
                  src={popup.imageUrl}
                  alt="Popup resmi"
                  className="w-full h-auto object-cover"
                />
              </div>
            )}
            
            {popup.message && (
              <p className="text-gray-700 mb-6 whitespace-pre-wrap text-base leading-relaxed font-medium">
                {popup.message}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
