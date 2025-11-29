/**
 * Firebase Admin SDK initialization
 * Server-side only - for sending push notifications
 */

import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getMessaging, Messaging } from "firebase-admin/messaging";

let adminApp: App | null = null;
let messaging: Messaging | null = null;

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
 * Send push notification to multiple tokens
 */
export async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  try {
    if (tokens.length === 0) {
      console.log("[Push Notification] No tokens to send to");
      return;
    }

    console.log(`[Push Notification] Preparing to send to ${tokens.length} token(s)`);
    console.log(`[Push Notification] Title: ${title}, Body: ${body}`);
    
    const adminMessaging = getAdminMessaging();

    // Split tokens into batches of 500 (FCM limit)
    const batchSize = 500;
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);

      const message = {
        notification: {
          title,
          body,
        },
        data: data || {},
        tokens: batch,
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

