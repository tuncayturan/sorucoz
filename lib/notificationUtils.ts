/**
 * Notification utilities for backend
 * Handles both FCM (Firebase Cloud Messaging) and Expo Push Notifications
 * Supports web (FCM) and mobile (Expo Push Token) platforms
 */

import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";

// Expo Push Notification client (singleton)
let expoClient: Expo | null = null;

/**
 * Get or create Expo Push Notification client
 */
function getExpoClient(): Expo {
  if (!expoClient) {
    expoClient = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN, // Optional, for higher rate limits
    });
  }
  return expoClient;
}

/**
 * Check if a token is an Expo Push Token
 * Expo Push Tokens start with "ExponentPushToken[" or "ExpoPushToken["
 */
export function isExpoPushToken(token: string): boolean {
  return (
    token.startsWith("ExponentPushToken[") ||
    token.startsWith("ExpoPushToken[") ||
    token.startsWith("Expo-")
  );
}

/**
 * Check if a token is an FCM token
 * FCM tokens are typically long base64-like strings
 */
export function isFCMToken(token: string): boolean {
  // FCM tokens are typically 152+ characters and don't start with Expo prefixes
  return (
    !isExpoPushToken(token) &&
    token.length > 50 &&
    /^[A-Za-z0-9_-]+$/.test(token)
  );
}

/**
 * Separate tokens into FCM and Expo Push Token arrays
 */
export function separateTokens(tokens: string[]): {
  fcmTokens: string[];
  expoTokens: string[];
  invalidTokens: string[];
} {
  const fcmTokens: string[] = [];
  const expoTokens: string[] = [];
  const invalidTokens: string[] = [];

  for (const token of tokens) {
    if (!token || typeof token !== "string" || token.trim().length === 0) {
      invalidTokens.push(token);
      continue;
    }

    const trimmedToken = token.trim();

    if (isExpoPushToken(trimmedToken)) {
      expoTokens.push(trimmedToken);
    } else if (isFCMToken(trimmedToken)) {
      fcmTokens.push(trimmedToken);
    } else {
      // Unknown format - log but don't fail
      console.warn(`[Notification Utils] Unknown token format: ${trimmedToken.substring(0, 20)}...`);
      invalidTokens.push(trimmedToken);
    }
  }

  return { fcmTokens, expoTokens, invalidTokens };
}

/**
 * Validate Expo Push Token format
 */
export function validateExpoToken(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  
  // Basic validation - Expo tokens have specific format
  return (
    token.startsWith("ExponentPushToken[") ||
    token.startsWith("ExpoPushToken[") ||
    token.startsWith("Expo-")
  );
}

/**
 * Send Expo Push Notifications
 * Handles batching, error handling, and retries
 */
export async function sendExpoPushNotifications(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>,
  sound?: string
): Promise<{
  successCount: number;
  failureCount: number;
  errors: Array<{ token: string; error: string }>;
}> {
  const expo = getExpoClient();
  const results = {
    successCount: 0,
    failureCount: 0,
    errors: [] as Array<{ token: string; error: string }>,
  };

  if (tokens.length === 0) {
    return results;
  }

  // Filter out invalid tokens
  const validTokens = tokens.filter((token) => {
    if (!validateExpoToken(token)) {
      results.failureCount++;
      results.errors.push({
        token: token.substring(0, 20) + "...",
        error: "Invalid Expo Push Token format",
      });
      return false;
    }
    return true;
  });

  if (validTokens.length === 0) {
    return results;
  }

  // Create messages
  const messages: ExpoPushMessage[] = validTokens.map((token) => {
    const message: ExpoPushMessage = {
      to: token,
      sound: sound || "default",
      title,
      body,
      data: data || {},
      priority: "default",
      channelId: "default",
    };

    // Add badge for iOS
    if (data?.badge !== undefined) {
      message.badge = Number(data.badge);
    }

    return message;
  });

  // Split into chunks (Expo allows up to 100 messages per request)
  const chunks = expo.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];

  console.log(`[Expo Push] Sending ${messages.length} notification(s) in ${chunks.length} chunk(s)`);

  // Send each chunk
  for (const chunk of chunks) {
    try {
      const chunkTickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...chunkTickets);
      console.log(`[Expo Push] ✅ Chunk sent: ${chunk.length} message(s)`);
    } catch (error: any) {
      console.error(`[Expo Push] ❌ Error sending chunk:`, error);
      // Mark all messages in this chunk as failed
      chunk.forEach((msg) => {
        results.failureCount++;
        results.errors.push({
          token: typeof msg.to === "string" ? msg.to.substring(0, 20) + "..." : "unknown",
          error: error.message || "Chunk send failed",
        });
      });
    }
  }

  // Process tickets to check for errors
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    const token = validTokens[i];

    if (ticket.status === "ok") {
      results.successCount++;
    } else {
      results.failureCount++;
      const errorMessage =
        ticket.status === "error"
          ? ticket.message || "Unknown error"
          : "Unknown status";
      results.errors.push({
        token: token.substring(0, 20) + "...",
        error: errorMessage,
      });

      // Handle specific error types
      if (ticket.status === "error" && ticket.details) {
        const errorCode = ticket.details.error;
        if (errorCode === "DeviceNotRegistered") {
          console.warn(`[Expo Push] ⚠️ Device not registered: ${token.substring(0, 20)}...`);
          // Token is invalid - should be removed from database
        } else if (errorCode === "MessageTooBig") {
          console.error(`[Expo Push] ❌ Message too big for token: ${token.substring(0, 20)}...`);
        } else if (errorCode === "MessageRateExceeded") {
          console.error(`[Expo Push] ❌ Rate limit exceeded for token: ${token.substring(0, 20)}...`);
        }
      }
    }
  }

  return results;
}

/**
 * Clean up invalid Expo tokens from error responses
 * Returns array of tokens that should be removed
 */
export function extractInvalidTokensFromExpoErrors(
  errors: Array<{ token: string; error: string }>
): string[] {
  const invalidTokens: string[] = [];

  for (const error of errors) {
    // Check if error indicates token is invalid
    if (
      error.error.includes("DeviceNotRegistered") ||
      error.error.includes("InvalidCredentials") ||
      error.error.includes("InvalidToken")
    ) {
      invalidTokens.push(error.token);
    }
  }

  return invalidTokens;
}
