/**
 * Tab Coordination System
 * Prevents multiple tabs from sending duplicate notifications
 * Uses BroadcastChannel API for cross-tab communication
 */

const CHANNEL_NAME = 'notification-coordination';
const SEND_LOCK_TIMEOUT = 3000; // 3 saniye içinde aynı mesaj için sadece 1 tab bildirim gönderebilir

class TabCoordinator {
  private channel: BroadcastChannel | null = null;
  private recentSends = new Map<string, number>();
  private isLeader = false;
  
  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.setupListeners();
      this.electLeader();
    }
  }
  
  private setupListeners() {
    if (!this.channel) return;
    
    this.channel.onmessage = (event) => {
      const { type, key, timestamp } = event.data;
      
      if (type === 'notification-sent') {
        // Başka bir tab bildirim gönderdi, bunu kaydet        this.recentSends.set(key, timestamp);
        
        // Timeout sonra temizle
        setTimeout(() => {
          this.recentSends.delete(key);
        }, SEND_LOCK_TIMEOUT);
      }
    };
  }
  
  private electLeader() {
    // İlk açılan tab leader olur
    // Leader olma durumu şimdilik basit - ilk initialize olan
    this.isLeader = true;  }
  
  /**
   * Bildirim göndermeyi dene
   * Eğer başka bir tab yakın zamanda gönderdiyse false döner
   */
  canSendNotification(conversationId: string, messageText: string): boolean {
    const key = `${conversationId}-${messageText.substring(0, 50)}`;
    const lastSendTime = this.recentSends.get(key);
    const now = Date.now();
    
    if (lastSendTime && (now - lastSendTime) < SEND_LOCK_TIMEOUT) {      return false;
    }
    
    // Bu tabın gönderebileceğini işaretle
    this.recentSends.set(key, now);
    
    // Diğer tablara bildir
    if (this.channel) {
      this.channel.postMessage({
        type: 'notification-sent',
        key,
        timestamp: now,
      });
    }    return true;
  }
  
  /**
   * Cleanup
   */
  destroy() {
    if (this.channel) {
      this.channel.close();
    }
  }
}

// Singleton instance
let coordinator: TabCoordinator | null = null;

export function getTabCoordinator(): TabCoordinator {
  if (!coordinator) {
    coordinator = new TabCoordinator();
  }
  return coordinator;
}


