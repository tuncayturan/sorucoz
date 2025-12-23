/**
 * Firebase Admin SDK initialization
 * Server-side only - for sending push notifications
 */

import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getMessaging, Messaging } from "firebase-admin/messaging";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import {
  separateTokens,
  sendExpoPushNotifications,
  extractInvalidTokensFromExpoErrors,
} from "@/lib/notificationUtils";

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
    
    if (serviceAccount) {      // Parse JSON string from environment variable
      const serviceAccountJson = JSON.parse(serviceAccount);
      adminApp = initializeApp({
        credential: cert(serviceAccountJson),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });    } else {
      // Fallback: Try to use default credentials (for Firebase hosting/Cloud Functions)
      // Or use project ID only (limited functionality)
      adminApp = initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });    }

    return adminApp;
  } catch (error) {    throw error;
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
 * Now supports both FCM (web) and Expo Push (mobile) tokens
 * Automatically separates and sends to appropriate service
 */
export async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
  icon?: string,
  sound?: string
): Promise<{
  fcmSent: number;
  expoSent: number;
  fcmFailed: number;
  expoFailed: number;
}> {
  const results = {
    fcmSent: 0,
    expoSent: 0,
    fcmFailed: 0,
    expoFailed: 0,
  };
  try {
    if (tokens.length === 0) {      return results;
    }

    // Token deduplication - remove duplicate tokens
    const uniqueTokens = [...new Set(tokens)];
    
    if (uniqueTokens.length !== tokens.length) {
    }

    // Separate FCM and Expo tokens
    const { fcmTokens, expoTokens, invalidTokens } = separateTokens(uniqueTokens);
    
    if (invalidTokens.length > 0) {
    }    const adminMessaging = getAdminMessaging();
    
    // Send Expo Push Notifications (mobile)
    if (expoTokens.length > 0) {
      try {
        const expoResults = await sendExpoPushNotifications(
          expoTokens,
          title,
          body,
          data,
          sound
        );
        
        results.expoSent = expoResults.successCount;
        results.expoFailed = expoResults.failureCount;        // Extract invalid tokens for cleanup (optional - can be handled separately)
        if (expoResults.errors.length > 0) {
          const invalidExpoTokens = extractInvalidTokensFromExpoErrors(expoResults.errors);
          if (invalidExpoTokens.length > 0) {
          }
        }
      } catch (expoError: any) {        results.expoFailed = expoTokens.length;
      }
    }

    // Send FCM Push Notifications (web)
    if (fcmTokens.length > 0) {
      // Split tokens into batches of 500 (FCM limit)
      const batchSize = 500;
      for (let i = 0; i < fcmTokens.length; i += batchSize) {
        const batch = fcmTokens.slice(i, i + batchSize);

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
          results.fcmSent += response.successCount;
          results.fcmFailed += response.failureCount;          // Log failures for debugging
          if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
              if (!resp.success) {
              }
            });
          }
        } catch (error: any) {          results.fcmFailed += batch.length;
        }
      }
    }    return results;
  } catch (error: any) {    // Don't throw - notification sending failure shouldn't break the main flow
    return results;
  }
}

