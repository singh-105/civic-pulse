import { doc, getDoc, setDoc, collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { groqText } from "@/lib/groq";

/**
 * Updates or creates the street memory profile, calculates its health score,
 * and calls Gemini to analyze historical patterns to update the insight text.
 */
export async function updateStreetMemory(streetName: string, newCategoryOrIssue: any): Promise<void> {
  if (!streetName) return;
  
  const newCategory = typeof newCategoryOrIssue === "object" ? (newCategoryOrIssue.category || "OTHER") : newCategoryOrIssue;
  const normalizedStreet = streetName.trim().toLowerCase();
  const streetDocRef = doc(db, "streets", normalizedStreet);

  try {
    // 1. Fetch all issues on this street from Firestore
    const issuesRef = collection(db, "issues");
    const q = query(issuesRef, where("streetName", "==", streetName.trim()));
    const querySnapshot = await getDocs(q);

    const issuesList: any[] = [];
    querySnapshot.forEach((docSnap) => {
      issuesList.push(docSnap.data());
    });

    const totalIssues = issuesList.length;
    const resolvedIssues = issuesList.filter((i) => i.status === "Resolved").length;
    const activeIssues = totalIssues - resolvedIssues;

    // Unique categories
    const categoriesSet = new Set<string>();
    issuesList.forEach((i) => categoriesSet.add(i.category));
    const categories = Array.from(categoriesSet);

    // Calculate category frequency for recurring patterns
    const categoryCounts: Record<string, number> = {};
    issuesList.forEach((i) => {
      categoryCounts[i.category] = (categoryCounts[i.category] || 0) + 1;
    });

    // Determine recurring penalty: -10 for each category with multiple occurrences
    let recurringPenalty = 0;
    Object.values(categoryCounts).forEach((count) => {
      if (count > 1) {
        recurringPenalty += (count - 1) * 10;
      }
    });

    // Health score: 100 - (open issues * 10) - recurring penalty
    const rawScore = 100 - (activeIssues * 10) - recurringPenalty;
    const healthScore = Math.max(0, Math.min(100, rawScore));

    // 2. Query Groq for Temporal insight paragraph
    let insight = "First issue logged. Building street health profile...";
    if (totalIssues > 1) {
      const prompt = `Analyze these civic issues reported on ${streetName}: ${JSON.stringify(issuesList.map(i => ({ category: i.category, date: i.createdAt })))}. Write exactly 2 sentences about recurring patterns and infrastructure health. Be specific and concise.`;
      
      try {
        const resultText = await groqText(prompt);
        insight = resultText || `${streetName} has reported ${totalIssues} civic issues. Regular monitoring and maintenance is recommended for this area.`;
      } catch (err) {
        console.error("Groq failed to generate street insight:", err);
        insight = `${streetName} has reported ${totalIssues} civic issues. Regular monitoring and maintenance is recommended for this area.`;
      }
    } else {
      insight = `Initial civic issue (${newCategory}) logged on this street. Monitoring for recurring patterns.`;
    }

    // 3. Save to Firestore
    await setDoc(streetDocRef, {
      streetName: streetName.trim(),
      totalIssues,
      resolved: resolvedIssues,
      categories,
      lastIssue: Timestamp.now(),
      healthScore,
      insight,
    }, { merge: true });


  } catch (error) {
    console.error("Failed to update street memory:", error);
  }
}
