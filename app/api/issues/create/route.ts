import { NextRequest, NextResponse } from "next/server";
import { collection, doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { detectAndTriggerCrisis } from "@/lib/agents/crisis-detector";
import { updateStreetMemory } from "@/lib/agents/street-memory";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const {
      title,
      description,
      image,
      category,
      subcategory,
      severity,
      rootCause,
      affectedPopulation,
      latitude,
      longitude,
      address,
      anonymous,
      reporterId,
      reporterName,
      reporterPhone,
      streetName,
      ward
    } = payload;

    if (!title || !description || !image || !category || !reporterId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const issueId = "iss_" + Math.random().toString(36).substring(2, 11);
    
    // Construct dynamic issueDNA parameters
    const urgency = Number(severity) >= 8 ? "critical" : Number(severity) >= 5 ? "high" : Number(severity) >= 3 ? "medium" : "low";
    const affectedAreaStr = affectedPopulation ? `${affectedPopulation} residents` : "Local residents";
    const recommendedFixStr = `Repair/resolve ${category} issue on ${streetName || "street"}`;

    // Create new issue object matching requested schema + compatibility fields
    const newIssue = {
      id: issueId,
      title,
      description,
      category,
      subcategory: subcategory || "General",
      severity: Number(severity) || 5,
      status: "reported", // lowercase
      location: {
        lat: Number(latitude) || 0,
        lng: Number(longitude) || 0,
        address: address || "Unknown Address"
      },
      imageBase64: image || "", // base64 string
      reportedBy: reporterId || "", // uid
      reporterPhone: reporterPhone || "",
      isAnonymous: Boolean(anonymous),
      upvotes: 0,
      upvotedBy: [],
      createdAt: Timestamp.now(),
      issueDNA: {
        rootCause: rootCause || "Under investigation",
        affectedArea: affectedAreaStr,
        recommendedFix: recommendedFixStr,
        urgency: urgency
      },
      streetName: streetName || "Main Street",
      wardNumber: ward || "Ward 12",

      // Backward compatibility root-level fields:
      latitude: Number(latitude) || 0,
      longitude: Number(longitude) || 0,
      address: address || "Unknown Address",
      image: image || "",
      reporterId: reporterId || "",
      anonymous: Boolean(anonymous),
      ward: ward || "Ward 12",
      timeline: [
        {
          status: "reported",
          updatedBy: anonymous ? "Anonymous Citizen" : reporterName || "Citizen",
          updatedAt: Timestamp.now(),
          comment: "Issue logged in CivicPulse portal."
        }
      ],
      negotiationLog: []
    };

    // Save to Firestore
    const docRef = doc(db, "issues", issueId);
    await setDoc(docRef, newIssue);

    // 1. Update Temporal Street Memory
    // Execute asynchronously to not block client response
    updateStreetMemory(newIssue.streetName, newIssue.category).catch((err) =>
      console.error("Failed to update street memory asynchronously:", err)
    );

    // 2. Trigger Crisis Detector
    let crisisId: string | null = null;
    try {
      crisisId = await detectAndTriggerCrisis({
        ...newIssue,
        createdAt: Timestamp.now()
      });
    } catch (err) {
      console.error("Failed to check crisis asynchronously:", err);
    }

    return NextResponse.json({
      success: true,
      issueId,
      crisisTriggered: !!crisisId,
      crisisId
    });
  } catch (error: any) {
    console.error("API Issue Create Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create issue" },
      { status: 500 }
    );
  }
}
