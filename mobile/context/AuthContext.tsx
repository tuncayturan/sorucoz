import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthInstance } from "@/lib/firebase";

const AuthContext = createContext<{
  user: any;
  loading: boolean;
} | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    
    const initAuth = async () => {
      try {
        const authInstance = getAuthInstance();
        
        if (!authInstance) {
          console.error("Firebase auth instance not available");
          setLoading(false);
          return;
        }
        
        if (typeof onAuthStateChanged === 'function' && authInstance) {
          unsub = onAuthStateChanged(authInstance, async (u) => {
            setUser(u);
            setLoading(false);
            
            if (u) {
              console.log("[AuthContext] 🔐 User authenticated:", u.email);
            }
          });
        } else {
          console.error("onAuthStateChanged is not available or authInstance is invalid");
          setLoading(false);
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      if (unsub) {
        unsub();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
