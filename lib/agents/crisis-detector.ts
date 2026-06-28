import { collection, query, where, getDocs, doc, setDoc, addDoc, updateDoc, Timestamp, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateText } from "@/lib/gemini";

function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // meters
}

/**
 * Checks if the newly reported issue triggers a hyperlocal crisis event.
 * Trigger conditions: 3+ unresolved issues of any category within 500 meters in the last 60 minutes.
 */
export async function detectAndTriggerCrisis(newIssue: any): Promise<string | null> {
  const { latitude, longitude, id: newIssueId, address, category, description } = newIssue;
  if (!latitude || !longitude) return null;

  try {
    const issuesRef = collection(db, "issues");
    const oneHourAgo = new Date();
    oneHourAgo.setMinutes(oneHourAgo.getMinutes() - 60);

    // Get all issues reported in the last 60 minutes
    const q = query(
      issuesRef,
      where("createdAt", ">=", Timestamp.fromDate(oneHourAgo))
    );

    const querySnapshot = await getDocs(q);
    const nearbyIssues: any[] = [];

    querySnapshot.forEach((docSnapshot) => {
      const issue = { id: docSnapshot.id, ...docSnapshot.data() };
      if (issue.id !== newIssueId && issue.latitude && issue.longitude) {
        const dist = getHaversineDistance(latitude, longitude, issue.latitude, issue.longitude);
        if (dist <= 500) {
          nearbyIssues.push(issue);
        }
      }
    });

    // We count this new issue + nearby ones
    const totalNearby = [newIssue, ...nearbyIssues];

    if (totalNearby.length >= 3) {

      // Compile summaries of all issues for Gemini
      const issueBulletList = totalNearby
        .map((iss, idx) => `${idx + 1}. [Category: ${iss.category}] Description: ${iss.description} at Address: ${iss.address}`)
        .join("\n");

      const prompt = `A cluster of ${totalNearby.length} municipal infrastructure issues has been reported in the same 500-meter radius within the last hour.
      Here is the list of active issues:
      ${issueBulletList}

      Summarize this crisis situation in a short, urgent brief (maximum 40 words) for emergency response teams. Do not mention HTML or JSON. Just write the brief summary.`;

      let summary = "Multiple civic issues reported in close proximity indicating local infrastructure failure.";
      try {
        summary = await generateText(prompt, "You are a crisis monitoring coordinator AI. Provide highly concise situation updates.");
      } catch (err) {
        console.error("Gemini failed to generate crisis summary:", err);
      }

      // Check if there is already an active crisis event in this exact 500m radius
      const crisisRef = collection(db, "crisis_events");
      const activeCrisisQuery = query(crisisRef, where("status", "==", "Active"));
      const activeCrisisSnapshot = await getDocs(activeCrisisQuery);
      
      let existingCrisisId: string | null = null;

      for (const crisisDoc of activeCrisisSnapshot.docs) {
        const cData = crisisDoc.data();
        const dist = getHaversineDistance(latitude, longitude, cData.center.lat, cData.center.lng);
        if (dist <= 500) {
          existingCrisisId = crisisDoc.id;
          break;
        }
      }

      const issueIds = totalNearby.map((iss) => iss.id);

      if (existingCrisisId) {
        // Update existing crisis
        const docRef = doc(db, "crisis_events", existingCrisisId);
        await setDoc(
          docRef,
          {
            issuesCount: totalNearby.length,
            issueIds: arrayUnion(...issueIds),
            summary: summary,
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        );

        // Escalating issues
        await escalateIssues(issueIds, "Added to active community crisis event.");
        return existingCrisisId;
      } else {
        // Create new crisis event
        const newCrisis = {
          center: { lat: latitude, lng: longitude },
          radius: 500,
          issuesCount: totalNearby.length,
          issueIds: issueIds,
          status: "Active",
          summary: summary,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

        const docRef = await addDoc(collection(db, "crisis_events"), newCrisis);
        
        // Escalating issues
        await escalateIssues(issueIds, "Crisis trigger met: Local infrastructure failure detected.");
        return docRef.id;
      }
    }
  } catch (error) {
    console.error("Error in crisis detection:", error);
  }

  return null;
}

async function escalateIssues(issueIds: string[], comment: string) {
  const timelineItem = {
    status: "Escalated",
    updatedBy: "AI Crisis Agent",
    updatedAt: Timestamp.now(),
    comment: comment,
  };

  for (const id of issueIds) {
    try {
      const issueDocRef = doc(db, "issues", id);
      await updateDoc(issueDocRef, {
        status: "Escalated",
        timeline: arrayUnion(timelineItem),
      });
    } catch (e) {
      console.error(`Failed to update status for issue ${id}:`, e);
    }
  }
}
