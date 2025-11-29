"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getFCMToken, requestNotificationPermission, saveFCMTokenToUser } from "@/lib/fcmUtils";

// Service worker'ı manuel olarak kaydet
async function registerServiceWorkerManually() {
  if (!("serviceWorker" in navigator)) {
    return null;
  }
  
  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/firebase-cloud-messaging-push-scope",
    });
    console.log("[Manual] Service Worker registered:", registration);
    return registration;
  } catch (error) {
    console.error("[Manual] Service Worker registration failed:", error);
    return null;
  }
}

export default function DebugNotificationsPage() {
  const { user } = useAuth();
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [firestoreTokens, setFirestoreTokens] = useState<string[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [serviceWorkerStatus, setServiceWorkerStatus] = useState<string>("Checking...");

  useEffect(() => {
    // Check notification permission
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }

    // Check service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        if (registrations.length > 0) {
          setServiceWorkerStatus(`Registered: ${registrations.length} worker(s)`);
        } else {
          setServiceWorkerStatus("Not registered");
        }
      });
    } else {
      setServiceWorkerStatus("Not supported");
    }

    // Get current FCM token
    requestNotificationPermission().then((token) => {
      setFcmToken(token);
    });

    // Get tokens from Firestore
    if (user) {
      getDoc(doc(db, "users", user.uid)).then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setFirestoreTokens(data.fcmTokens || []);
        }
      });
    }
  }, [user]);

  const requestPermission = async () => {
    if ("Notification" in window) {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        const token = await requestNotificationPermission();
        setFcmToken(token);
      }
    }
  };

  const testNotification = () => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Test Bildirimi", {
        body: "Bu bir test bildirimidir",
        icon: "/img/logo.png",
      });
    }
  };

  const saveTokenToFirestore = async () => {
    if (!user || !fcmToken) {
      alert("Lütfen önce giriş yapın ve token alın");
      return;
    }
    try {
      await saveFCMTokenToUser(user.uid, fcmToken);
      alert("Token Firestore'a kaydedildi!");
      // Refresh Firestore tokens
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setFirestoreTokens(data.fcmTokens || []);
      }
    } catch (error) {
      console.error("Error saving token:", error);
      alert("Token kaydedilirken hata oluştu: " + (error as Error).message);
    }
  };

  const registerSW = async () => {
    try {
      const registration = await registerServiceWorkerManually();
      if (registration) {
        alert("Service Worker kaydedildi! Sayfayı yenileyin.");
        // Update service worker status
        if (registration.active) {
          setServiceWorkerStatus(`Registered: Active`);
        } else if (registration.installing) {
          setServiceWorkerStatus(`Registered: Installing...`);
        } else if (registration.waiting) {
          setServiceWorkerStatus(`Registered: Waiting...`);
        }
      } else {
        alert("Service Worker kaydedilemedi!");
      }
    } catch (error) {
      console.error("Error registering service worker:", error);
      alert("Service Worker kaydedilirken hata oluştu: " + (error as Error).message);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Push Notification Debug</h1>

        <div className="space-y-4">
          {/* Notification Permission */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="font-semibold mb-2">Notification Permission</h2>
            <p className="text-gray-600">Status: <span className="font-mono">{permission}</span></p>
            {permission !== "granted" && (
              <button
                onClick={requestPermission}
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Request Permission
              </button>
            )}
          </div>

          {/* Service Worker */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="font-semibold mb-2">Service Worker</h2>
            <p className="text-gray-600 mb-2">{serviceWorkerStatus}</p>
            <button
              onClick={registerSW}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              Register Service Worker
            </button>
          </div>

          {/* FCM Token */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="font-semibold mb-2">Current FCM Token</h2>
            {fcmToken ? (
              <div>
                <p className="text-xs font-mono break-all bg-gray-100 p-2 rounded">
                  {fcmToken}
                </p>
                <p className="text-sm text-gray-500 mt-2">Token length: {fcmToken.length}</p>
                {user && (
                  <button
                    onClick={saveTokenToFirestore}
                    className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Save Token to Firestore
                  </button>
                )}
              </div>
            ) : (
              <p className="text-gray-500">No token available</p>
            )}
          </div>

          {/* Firestore Tokens */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="font-semibold mb-2">Firestore FCM Tokens</h2>
            {firestoreTokens.length > 0 ? (
              <div>
                <p className="text-sm text-gray-600 mb-2">Count: {firestoreTokens.length}</p>
                {firestoreTokens.map((token, idx) => (
                  <div key={idx} className="mb-2">
                    <p className="text-xs font-mono break-all bg-gray-100 p-2 rounded">
                      {token}
                    </p>
                    <p className="text-xs text-gray-500">
                      {token === fcmToken ? "✓ Current token" : "Old token"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No tokens in Firestore</p>
            )}
          </div>

          {/* Test Notification */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="font-semibold mb-2">Test Notification</h2>
            <button
              onClick={testNotification}
              disabled={permission !== "granted"}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Send Test Notification
            </button>
          </div>

          {/* User Info */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="font-semibold mb-2">User Info</h2>
            {user ? (
              <div>
                <p className="text-sm">UID: <span className="font-mono">{user.uid}</span></p>
                <p className="text-sm">Email: {user.email}</p>
              </div>
            ) : (
              <p className="text-gray-500">Not logged in</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

