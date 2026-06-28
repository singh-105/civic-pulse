# 🏆 Google Hackathon Submission Proposal: CivicPulse

**Project Name**: CivicPulse  
**Theme**: Hyperlocal Smart Cities & AI for Social Good (Civic Tech)  
**Target Zonal Area**: Municipal Infrastructure Triage & Citizen Advocacy  

---

## 1. Problem Statement Selected
Municipal administration in rapidly expanding urban centers (e.g., Indian metro cities) faces a severe "redressal gap." This problem breaks down into three core friction points:
1. **The Citizen-Municipal Void**: Citizens report issues (such as potholes, open sewage, garbage dumps, or broken streetlights) that are frequently ignored due to a lack of structured tracking, public pressure, or direct communication channels.
2. **Administrative Overhead & Spam**: Municipal ward offices are overwhelmed by disorganized, duplicate, or unverified citizen reports. Triaging these complaints takes days, slowing down PWD response rates.
3. **The Escalation Blackhole**: Even when issues are reported, citizens lack the legal or administrative expertise to construct formal complaint letters to push municipal boards (e.g., BMC, PWD, or Electricity Boards) for resolution.

---

## 2. Solution Overview
**CivicPulse** is an AI-driven, hyperlocal municipal ledger and automated citizen advocacy engine. It bridges the gap between citizens and municipal authorities using a three-tiered approach:
- **Instant AI Verification**: A mobile-responsive web app where citizens snap photos of civic issues. Using **Google Gemini Vision AI**, the platform instantly categorizes the issue, determines its severity, and diagnoses the root cause.
- **Crowd-Verified Spatial Ledger**: Integrated with **Google Maps Platform**, the platform reverse-geocodes GPS telemetry, checks for duplicates within 50 meters, and populates a real-time civic ledger. Citizens can verify and upvote nearby issues, earning gamified trust points.
- **Automated AI Advocacy**: If an issue remains unresolved beyond 48 hours, citizens can trigger the **AI Negotiation Console**. Powered by **Google Gemini**, the console synthesizes raw telemetry data, citizen votes, and severity logs into a formal legal escalation letter drafted to local zonal heads.

---

## 3. Key Features

### Citizen Portal Features
*   **Multimodal AI Image Diagnostics (Gemini 1.5 Flash)**: Ingests base64 citizen photo uploads to auto-categorize failures and populate technical diagnostic data (estimated population affected, cause analysis, and severity rating out of 10).
*   **Spatial haversine Duplicate Detection**: Checks reports against database entries within 50 meters. If a duplicate exists, it halts submission and prompts the user to upvote and verify the existing ticket (+5 points) to keep database collections clean.
*   **AI Zonal Negotiation Console**: Gathers issue logs and upvotes, compiling them into a professional complaint letter targeting ward authorities.
*   **Gamified Civic Reputation Index**: Citizen profiles track reputation logs in Firestore. Submitting reports (+10 pts) and upvoting (+5 pts) unlocks regional badges like *Civic Pioneer*.

### Moderator Panel (War Room) Features
*   **Zonal Triage Dashboard**: Command center displaying real-time metrics (Pending verification, active issues, resolutions made today).
*   **onSnapshot Triage Queue**: Issues update in real-time, allowing moderators to Approve (verifying and awarding points to the citizen) or Reject invalid entries.
*   **Shadow Government Performance Grid**: Evaluates local agencies (BMC Roads, Sewage Board, Sanitation, Parks Dept) by calculating actual resolution rates from Firestore entries.

---

## 4. Google Technologies Utilized

### A. Google Gemini API
- **Gemini 1.5 Flash (Vision Analysis)**: Analyzes citizen photo uploads to extract metadata (Category, Severity, DNA Diagnostics) and formats it into structured JSON.
- **Gemini 1.5 Pro (Text Generation)**: Synthesizes formal complaint letters from issue data logs.

### B. Google Maps Platform
- **Maps SDK for JavaScript**: Controls the Live Spatial Grid overlays and interactive map selectors.
- **Geocoding API**: Resolves GPS coordinates into street addresses.

### C. Firebase & Google Cloud Platform
- **Firebase Authentication**: Google Sign-In and Phone Auth with SMS OTP verification.
- **Cloud Firestore**: Serverless real-time database syncing active ward metrics.
- **Firebase Storage**: Secure file hosting for citizen photo uploads.

---

## 5. System Architecture & Lifecycle

```
[Citizen UI] 
   │
   ├─► 1. Capture Photo ─────────► [Gemini 1.5 Flash Vision] (Extract Category/Severity)
   ├─► 2. Telemetry (GPS) ───────► [Google Maps Geocoding API] (Reverse Address Resolution)
   └─► 3. Haversine Check ───────► [Duplicate Detection Filter] (Check within 50m radius)
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
         [Duplicate Found]                              [No Duplicate Found]
                  │                                               │
    Redirect user to upvote ticket                   Write new issue to Firestore
    (+5 Trust Points awarded)                        (+10 Trust Points awarded)
                                                                  │
                                                                  ▼
                                                      [Cloud Firestore Sync]
                                                                  │
                                          ┌───────────────────────┴───────────────────────┐
                                          ▼                                               ▼
                                 [Zonal War Room]                               [Citizen Portal]
                                          │                                               │
                          Moderator triages / verifies                    If unresolved after 48h
                                          │                                               │
                                          ▼                                               ▼
                           Update status in database                    [Gemini AI Letter Gen]
                           (+25 points to citizen)                              │
                                                                                ▼
                                                                     Dispatch to Ward Head
```

---

## 6. Screenshots Guide (For Google Doc Submission)

*When pasting this proposal into your Google Doc, insert your screenshot graphics at the designated blocks below:*

### Screenshot 1: Login & Google Identity Auth
> **Description**: The landing page displaying the unified Google Sign-In card, Citizen/Moderator selection grid, and Demo credentials block.
> **Placement**: *Insert under Section 2 (Solution Overview).*

### Screenshot 2: Citizen Dashboard & Reporting Map
> **Description**: The Citizen dashboard, displaying active reports list, current user points, and map picker page with geotagging.
> **Placement**: *Insert under Section 3 (Citizen Portal Features).*

### Screenshot 3: AI Diagnostic Output
> **Description**: The screen showing Gemini's vision output on a submitted image, automatically filling category, severity, and cause hypothesis.
> **Placement**: *Insert under Section 3 (Multimodal AI Image Diagnostics).*

### Screenshot 4: Issue Detail Page & AI Negotiation Console
> **Description**: The issue details page, showing the timeline log thread, upvote button, and the AI escalation letter modal popup containing the generated text.
> **Placement**: *Insert under Section 3 (AI Zonal Negotiation Console).*

### Screenshot 5: Zonal War Room (Moderator Panel)
> **Description**: Zonal War Room dashboard displaying active incident lists, the spatial ward grid map, and the municipal department rating table.
> **Placement**: *Insert under Section 3 (Moderator Panel Features).*

---

## 7. Setup & Run Instructions

### Prerequisites
- Node.js (v18+)
- A Firebase project with Firestore, Auth (Google & Phone enabled), and Storage.
- A Google Cloud Console project with Geocoding, Maps JavaScript, and Gemini APIs enabled.

### Run Locally
1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/singh-105/civic-pulse.git
   cd civic-pulse
   npm install
   ```
2. Setup environment variables in a `.env.local` file (using the template in the README).
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
4. Access the portal at `http://localhost:3000`.
