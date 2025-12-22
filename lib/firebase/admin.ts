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
    if (tokens.length === 0) {
      console.log("[Push Notification] No tokens to send to");
      return results;
    }

    // Token deduplication - remove duplicate tokens
    const uniqueTokens = [...new Set(tokens)];
    
    if (uniqueTokens.length !== tokens.length) {
      console.log(`[Push Notification] ⚠️ Removed ${tokens.length - uniqueTokens.length} duplicate token(s)`);
    }

    console.log(`[Push Notification] Preparing to send to ${uniqueTokens.length} unique token(s)`);
    console.log(`[Push Notification] Title: ${title}, Body: ${body}, Icon: ${icon || 'default'}, Sound: ${sound || 'default'}`);
    
    // Separate FCM and Expo tokens
    const { fcmTokens, expoTokens, invalidTokens } = separateTokens(uniqueTokens);
    
    if (invalidTokens.length > 0) {
      console.warn(`[Push Notification] ⚠️ Found ${invalidTokens.length} invalid token(s), skipping...`);
    }
    
    console.log(`[Push Notification] Token breakdown: ${fcmTokens.length} FCM, ${expoTokens.length} Expo, ${invalidTokens.length} invalid`);
    
    const adminMessaging = getAdminMessaging();
    
    // Send Expo Push Notifications (mobile)
    if (expoTokens.length > 0) {
      try {
        console.log(`[Push Notification] 📱 Sending ${expoTokens.length} Expo Push notification(s)...`);
        const expoResults = await sendExpoPushNotifications(
          expoTokens,
          title,
          body,
          data,
          sound
        );
        
        results.expoSent = expoResults.successCount;
        results.expoFailed = expoResults.failureCount;
        
        console.log(`[Push Notification] ✅ Expo: ${expoResults.successCount} sent, ${expoResults.failureCount} failed`);
        
        // Extract invalid tokens for cleanup (optional - can be handled separately)
        if (expoResults.errors.length > 0) {
          const invalidExpoTokens = extractInvalidTokensFromExpoErrors(expoResults.errors);
          if (invalidExpoTokens.length > 0) {
            console.warn(`[Push Notification] ⚠️ ${invalidExpoTokens.length} invalid Expo token(s) detected (should be removed from database)`);
          }
        }
      } catch (expoError: any) {
        console.error(`[Push Notification] ❌ Expo Push error:`, expoError);
        results.expoFailed = expoTokens.length;
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
          results.fcmFailed += response.failureCount;
          
          console.log(`[Push Notification] ✅ FCM batch: ${response.successCount} sent, ${response.failureCount} failed`);
          
          // Log failures for debugging
          if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
              if (!resp.success) {
                console.error(`[Push Notification] ❌ FCM failed for token ${batch[idx].substring(0, 20)}...:`, resp.error?.code || resp.error);
              }
            });
          }
        } catch (error: any) {
          console.error("[Push Notification] ❌ Error sending FCM batch:", error);
          results.fcmFailed += batch.length;
        }
      }
    }
    
    console.log(`[Push Notification] 📊 Final results: FCM ${results.fcmSent}/${fcmTokens.length}, Expo ${results.expoSent}/${expoTokens.length}`);
    
    return results;
  } catch (error: any) {
    console.error("[Push Notification] ❌ Fatal error:", error);
    // Don't throw - notification sending failure shouldn't break the main flow
    return results;
  }
}

