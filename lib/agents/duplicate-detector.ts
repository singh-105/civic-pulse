import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateIssue?: any;
}

/**
 * Checks if a similar issue (same category) has been reported within 100 meters in the past 7 days.
 */
export async function detectDuplicateIssue(
  latitude: number,
  longitude: number,
  category: string
): Promise<DuplicateCheckResult> {
  try {
    const issuesRef = collection(db, "issues");
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Query active issues of the same category in the last 7 days
    const q = query(
      issuesRef,
      where("category", "==", category),
      where("status", "in", ["Reported", "Verified", "Escalated", "Assigned"]),
      where("createdAt", ">=", Timestamp.fromDate(sevenDaysAgo))
    );

    const querySnapshot = await getDocs(q);
    
    for (const doc of querySnapshot.docs) {
      const issueData = doc.data();
      if (issueData.latitude && issueData.longitude) {
        const distance = getHaversineDistance(
          latitude,
          longitude,
          issueData.latitude,
          issueData.longitude
        );

        if (distance <= 100) {
          return {
            isDuplicate: true,
            duplicateIssue: { id: doc.id, ...issueData },
          };
        }
      }
    }

    return { isDuplicate: false };
  } catch (error) {
    console.error("Error during duplicate detection:", error);
    return { isDuplicate: false };
  }
}
