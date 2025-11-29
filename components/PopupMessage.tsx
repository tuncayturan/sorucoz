"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useUserData } from "@/hooks/useUserData";

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
  const { userData } = useUserData();
  const [popup, setPopup] = useState<PopupMesaj | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Sadece öğrenci rolündeki kullanıcılara göster
    if (!userData || userData.role !== "student") return;

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
  }, [userData]);

  const handleClose = () => {
    setShow(false);
    
    // "Sadece Bir Kez Göster" aktifse localStorage'a kaydet
    if (popup?.showOnce) {
      localStorage.setItem("popupMessageClosed", "true");
    }
  };

  if (!show || !popup) return null;

  const buttonColorClasses = {
    green: "from-green-500 to-emerald-600",
    blue: "from-blue-500 to-indigo-600",
    red: "from-red-500 to-rose-600",
    purple: "from-purple-500 to-violet-600",
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full animate-slideUp max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          {popup.title ? (
            <h3 className="text-xl font-bold text-gray-900">{popup.title}</h3>
          ) : (
            <div></div>
          )}
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {popup.imageUrl && (
          <div className="mb-4 rounded-xl overflow-hidden">
            <img
              src={popup.imageUrl}
              alt="Popup resmi"
              className="w-full h-auto object-cover"
            />
          </div>
        )}
        {popup.message && (
          <p className="text-gray-700 mb-6 whitespace-pre-wrap">{popup.message}</p>
        )}
        {popup.buttonText && (
          <button
            onClick={handleClose}
            className={`w-full px-4 py-2 bg-gradient-to-r ${buttonColorClasses[popup.buttonColor as keyof typeof buttonColorClasses] || buttonColorClasses.green} text-white rounded-lg font-semibold hover:shadow-lg transition`}
          >
            {popup.buttonText}
          </button>
        )}
        {!popup.buttonText && (
          <button
            onClick={handleClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition"
          >
            Kapat
          </button>
        )}
      </div>
    </div>
  );
}

