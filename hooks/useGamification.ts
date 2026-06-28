"use client";

import { doc, getDoc, updateDoc, arrayUnion, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface GamificationActions {
  action: "report" | "verify" | "resolve" | "first_report";
}

// Global standalone helper
export const addPoints = async (uid: string, points: number, reason: string) => {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    points: increment(points),
    pointHistory: arrayUnion({
      points,
      reason,
      timestamp: new Date()
    })
  });
};

export function useGamification() {
  const pointsMap = {
    report: 10,
    verify: 5,
    resolve: 25,
    first_report: 15
  };

  /**
   * Awards points to a user profile and recalculates their civic impact scores.
   * Returns newly awarded badges if any are triggered.
   */
  const awardPointsAndBadges = async (
    userId: string,
    actionType: "report" | "verify" | "resolve" | "first_report",
    isCrisisContext: boolean = false
  ): Promise<{ pointsAdded: number; newBadges: string[] }> => {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        return { pointsAdded: 0, newBadges: [] };
      }

      const userData = userSnap.data();
      const currentPoints = userData.points || 0;
      const currentBadges = userData.badges || [];
      const pointsToAdd = pointsMap[actionType];
      
      const nextPoints = currentPoints + pointsToAdd;
      const nextImpact = Math.round(nextPoints * 3.5);
      const newBadges: string[] = [];

      // Check badge rules
      if (actionType === "report" && !currentBadges.includes("First Reporter")) {
        newBadges.push("First Reporter");
      }
      
      if (actionType === "report") {
        if (nextPoints >= 50 && !currentBadges.includes("Ward Guardian")) {
          newBadges.push("Ward Guardian");
        }
      }

      if (isCrisisContext && !currentBadges.includes("Crisis Responder")) {
        newBadges.push("Crisis Responder");
      }

      if (actionType === "resolve" && !currentBadges.includes("Street Healer")) {
        newBadges.push("Street Healer");
      }

      // Update trust score: +2 for report, +1 for verify, +5 for resolve
      let trustBoost = 2;
      if (actionType === "verify") trustBoost = 1;
      if (actionType === "resolve") trustBoost = 5;

      const currentTrust = userData.trustScore || 50;
      const nextTrust = Math.min(100, currentTrust + trustBoost);

      const updates: any = {
        points: nextPoints,
        civicImpactScore: nextImpact,
        trustScore: nextTrust,
      };

      if (newBadges.length > 0) {
        updates.badges = arrayUnion(...newBadges);
      }

      await updateDoc(userRef, updates);

      // Also add to pointHistory to align with BUG 1
      await updateDoc(userRef, {
        pointHistory: arrayUnion({
          points: pointsToAdd,
          reason: `Action: ${actionType}`,
          timestamp: new Date()
        })
      });

      return {
        pointsAdded: pointsToAdd,
        newBadges: newBadges
      };
    } catch (error) {
      console.error("Error processing gamification logic:", error);
      return { pointsAdded: 0, newBadges: [] };
    }
  };

  return {
    awardPointsAndBadges,
    pointsMap,
    addPoints
  };
}
