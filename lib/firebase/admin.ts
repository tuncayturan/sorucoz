/**
 * Firebase Admin SDK initialization
 * Server-side only - for sending push notifications
 */

import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getMessaging, Messaging } from "firebase-admin/messaging";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let adminApp: App | null = null;
let messaging: Messaging | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;

/**
 * Initialize Firebase Admin SDK
 * Only works on server-side (Next.js API routes)
 */
export function getAdminApp(): App {
  if (adminApp) {
    return adminApp;
  }

  // Check if already initialized
  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }

  // Initialize with service account credentials
  // For production, use environment variable with service account JSON
  // For development, you can use a service account key file
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (serviceAccount) {
      console.log("[Firebase Admin] Service account key found, parsing...");
      // Parse JSON string from environment variable
      const serviceAccountJson = JSON.parse(serviceAccount);
      adminApp = initializeApp({
        credential: cert(serviceAccountJson),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
      console.log("[Firebase Admin] Initialized successfully with service account");
    } else {
      console.warn("[Firebase Admin] No service account key found, using project ID only (limited functionality)");
      // Fallback: Try to use default credentials (for Firebase hosting/Cloud Functions)
      // Or use project ID only (limited functionality)
      adminApp = initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
      console.log("[Firebase Admin] Initialized with project ID only");
    }

    return adminApp;
  } catch (error) {
    console.error("[Firebase Admin] Initialization error:", error);
    throw error;
  }
}

/**
 * Get Firebase Admin Messaging instance
 */
export function getAdminMessaging(): Messaging {
  if (messaging) {
    return messaging;
  }

  const app = getAdminApp();
  messaging = getMessaging(app);
  return messaging;
}

/**
 * Get Firebase Admin Auth instance
 */
export function getAdminAuth(): Auth {
  if (auth) {
    return auth;
  }

  const app = getAdminApp();
  auth = getAuth(app);
  return auth;
}

/**
 * Get Firebase Admin Firestore instance
 */
export function getAdminFirestore(): Firestore {
  if (firestore) {
    return firestore;
  }

  const app = getAdminApp();
  firestore = getFirestore(app);
  return firestore;
}

/**
 * Send push notification to multiple tokens
 */
export async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
  icon?: string,
  sound?: string
): Promise<void> {
  try {
    if (tokens.length === 0) {
      console.log("[Push Notification] No tokens to send to");
      return;
    }

    // Token deduplication - remove duplicate tokens
    const uniqueTokens = [...new Set(tokens)];
    
    if (uniqueTokens.length !== tokens.length) {
      console.log(`[Push Notification] ⚠️ Removed ${tokens.length - uniqueTokens.length} duplicate token(s)`);
    }

    console.log(`[Push Notification] Preparing to send to ${uniqueTokens.length} unique token(s)`);
    console.log(`[Push Notification] Title: ${title}, Body: ${body}, Icon: ${icon || 'default'}, Sound: ${sound || 'default'}`);
    
    const adminMessaging = getAdminMessaging();

    // Split tokens into batches of 500 (FCM limit)
    const batchSize = 500;
    for (let i = 0; i < uniqueTokens.length; i += batchSize) {
      const batch = uniqueTokens.slice(i, i + batchSize);

      // Prepare data payload - icon ve sound data'da olmalı, notification'da değil
      const messageData: Record<string, string> = { ...(data || {}) };
      if (icon) {
        messageData.icon = icon;
      }
      if (sound) {
        messageData.sound = sound;
      }

      const message: any = {
        notification: {
          title,
          body,
          // CRITICAL: Icon'u notification objesine de ekle ki web push'ta çalışsın
          ...(icon ? { icon: icon } : {}),
        },
        data: messageData,
        tokens: batch,
        // Android specific configuration
        android: {
          notification: {
            sound: sound || 'default',
            channelId: 'default',
            imageUrl: icon, // Android için image
          },
        },
        // Apple specific configuration
        apns: {
          payload: {
            aps: {
              sound: sound || 'default',
              badge: 1,
            },
          },
          fcm_options: icon ? {
            image: icon, // iOS için image
          } : undefined,
        },
        // Web push configuration
        webpush: icon ? {
          notification: {
            icon: icon,
            badge: icon,
            vibrate: [200, 100, 200],
            requireInteraction: false,
          },
          fcm_options: {
            link: '/',
          },
        } : {
          notification: {
            vibrate: [200, 100, 200],
            requireInteraction: false,
          },
          fcm_options: {
            link: '/',
          },
        },
      };

      try {
        const response = await adminMessaging.sendEachForMulticast(message);
        console.log(`[Push Notification] Sent to ${response.successCount} devices, ${response.failureCount} failed`);
        
        // Log failures for debugging
        if (response.failureCount > 0) {
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              console.error(`[Push Notification] Failed for token ${batch[idx]}:`, resp.error);
            }
          });
        }
      } catch (error) {
        console.error("[Push Notification] Error sending batch:", error);
      }
    }
  } catch (error) {
    console.error("[Push Notification] Error:", error);
    // Don't throw - notification sending failure shouldn't break the main flow
  }
}

