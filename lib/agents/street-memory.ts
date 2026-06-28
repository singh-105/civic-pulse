import { doc, getDoc, setDoc, collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateText } from "@/lib/gemini";

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

    // 2. Query Gemini for Temporal insight paragraph
    const historySummary = issuesList
      .map((i) => `- [Date: ${i.createdAt?.toDate ? i.createdAt.toDate().toLocaleDateString() : new Date(i.createdAt).toLocaleDateString()}] ${i.category}: ${i.description}`)
      .join("\n");

    const systemPrompt = `You are the CivicPulse Temporal Street Memory AI. Your role is to examine a street's entire history of civic reports and describe any recurring patterns in 2-3 sentences.`;

    const prompt = `Analyze the civic issues reported on "${streetName}". Here is the history of reports:
    ${historySummary}

    Identify if there are recurring patterns (e.g. repetitive water logging, constant streetlight failures, seasonal pothole erosion).
    Generate a concise summary paragraph (max 45 words) describing the street's infrastructure health history and patterns. Keep it professional.`;

    let insight = "First issue logged. Building street health profile...";
    if (totalIssues > 1) {
      try {
        insight = await generateText(prompt, systemPrompt);
      } catch (err) {
        console.error("Gemini failed to generate street insight:", err);
        insight = `Ongoing reports regarding ${categories.join(" and ")}. Primary stressors include active unresolved issues.`;
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
