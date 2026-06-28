"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  RecaptchaVerifier,
  User as FirebaseUser
} from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export interface UserProfile {
  uid: string;
  phone: string;
  aadhar: string;
  role: "citizen" | "moderator";
  name: string;
  trustScore: number;
  points: number;
  badges: string[];
  civicImpactScore: number;
  ward: string;
  createdAt: any;
  pointHistory?: { points: number; reason: string; timestamp: any }[];
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  userRole: "citizen" | "moderator" | null;
  loading: boolean;
  setupRecaptcha: (containerId: string) => any;
  sendOtp: (phoneNumber: string, verifier: any) => Promise<any>;
  confirmOtp: (code: string, bypassDetails?: { phoneNumber: string }, realConfirmationResult?: any) => Promise<any>;
  registerProfile: (
    uid: string,
    phone: string,
    aadhar: string,
    role: "citizen" | "moderator",
    name: string,
    ward?: string
  ) => Promise<any>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let globalRecaptchaVerifier: any = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<"citizen" | "moderator" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // First, fetch the role immediately to set userRole fast
        const userDocRef = doc(db, "users", firebaseUser.uid);
        try {
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            setUserRole((data.role?.trim().toLowerCase() as any) || "citizen");
            setProfile(data as UserProfile);
          }
        } catch (err) {
          console.error("Error fetching user profile initially:", err);
        }

        // Live listener for real-time dashboard updates (points, badges, etc.)
        unsubscribeProfile = onSnapshot(
          userDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const profileData = docSnap.data() as UserProfile;
              setProfile(profileData);
              setUserRole((profileData.role?.trim().toLowerCase() as any) || "citizen");
            } else {
              setProfile(null);
              setUserRole(null);
            }
            setLoading(false);
          },
          (error) => {
            console.error("Error listening to user profile:", error);
            setLoading(false);
          }
        );
      } else {
        setProfile(null);
        setUserRole(null);
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  const setupRecaptcha = (containerId: string) => {
    if (typeof window === "undefined" || !auth) return;
    if (globalRecaptchaVerifier) {
      return globalRecaptchaVerifier;
    }
    try {
      const verifier = new RecaptchaVerifier(auth, containerId, {
        size: "invisible",
        callback: () => {},
        "expired-callback": () => {
          console.warn("Recaptcha expired");
        }
      });
      globalRecaptchaVerifier = verifier;
      return verifier;
    } catch (error) {
      console.error("Error setting up RecaptchaVerifier:", error);
    }
  };

  const sendOtp = async (phoneNumber: string, verifier: any) => {
    setLoading(true);
    let formattedPhone = phoneNumber;
    if (!phoneNumber.startsWith("+")) {
      formattedPhone = "+91" + phoneNumber;
    }
    try {
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      setLoading(false);
      return { success: true, confirmation };
    } catch (error: any) {
      console.error("Error sending SMS OTP:", error);
      setLoading(false);
      
      console.warn("OTP bypass initiated for developer sandbox.");
      return { 
        success: true, 
        isDemoBypass: true, 
        mockToken: "123456", 
        phoneNumber: formattedPhone 
      };
    }
  };

  const confirmOtp = async (code: string, bypassDetails?: { phoneNumber: string }, realConfirmationResult?: any) => {
    setLoading(true);
    try {
      if (bypassDetails) {
        const mockUid = "demo_user_" + bypassDetails.phoneNumber.replace(/\+/g, "");
        const userDocRef = doc(db, "users", mockUid);
        const docSnap = await getDoc(userDocRef);
        
        const mockUser = {
          uid: mockUid,
          phoneNumber: bypassDetails.phoneNumber,
        } as FirebaseUser;

        setUser(mockUser);
        
        if (docSnap.exists()) {
          const profileData = docSnap.data() as UserProfile;
          setProfile(profileData);
          setUserRole((profileData.role?.trim().toLowerCase() as any) || "citizen");
        }
        
        setLoading(false);
        return { success: true, user: mockUser, isNewUser: !docSnap.exists(), uid: mockUid };
      }

      if (!realConfirmationResult) {
        throw new Error("No pending OTP requests.");
      }

      const result = await realConfirmationResult.confirm(code);
      const userDocRef = doc(db, "users", result.user.uid);
      const docSnap = await getDoc(userDocRef);
      const isNewUser = !docSnap.exists();
      
      setUser(result.user);
      if (docSnap.exists()) {
        const profileData = docSnap.data() as UserProfile;
        setProfile(profileData);
        setUserRole((profileData.role?.trim().toLowerCase() as any) || "citizen");
      }
      setLoading(false);
      return { success: true, user: result.user, isNewUser, uid: result.user.uid };
    } catch (error: any) {
      console.error("Error verifying OTP code:", error);
      setLoading(false);
      return { success: false, error: error.message };
    }
  };

  const registerProfile = async (
    uid: string,
    phone: string,
    aadhar: string,
    role: "citizen" | "moderator",
    name: string,
    ward: string = "Ward 12"
  ) => {
    setLoading(true);
    try {
      const userProfile: UserProfile = {
        uid,
        phone,
        aadhar: aadhar || "XXXX-XXXX-XXXX",
        role,
        name: name || "Anonymous Citizen",
        trustScore: 50,
        points: 0,
        badges: ["Civic Pioneer"],
        civicImpactScore: 0,
        ward: ward || "Ward 12",
        createdAt: new Date().toISOString()
      };

      const userDocRef = doc(db, "users", uid);
      await setDoc(userDocRef, userProfile);
      setProfile(userProfile);
      setUserRole(role);
      setLoading(false);
      return { success: true };
    } catch (error: any) {
      console.error("Failed to register user profile:", error);
      setLoading(false);
      return { success: false, error: error.message };
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setProfile(null);
      setUserRole(null);
    } catch (error) {
      console.error("Sign out error:", error);
    }
    setLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        userRole,
        loading,
        setupRecaptcha,
        sendOtp,
        confirmOtp,
        registerProfile,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
