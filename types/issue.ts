import { Timestamp } from "firebase/firestore";

export interface TimelineItem {
  status: "Reported" | "Verified" | "Escalated" | "Assigned" | "Resolved";
  updatedBy: string;
  updatedAt: string | Timestamp | any;
  comment: string;
}

export interface NegotiationLogItem {
  timestamp: string | Timestamp | any;
  message: string;
  sender: "AI Agent" | "Department" | "System";
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  image: string; // Base64
  afterImage?: string; // Base64
  category: "pothole" | "drain" | "light" | "water" | "garbage" | "construction";
  subcategory: string;
  severity: number; // 1-10
  rootCause: string;
  affectedPopulation: number;
  latitude: number;
  longitude: number;
  address: string;
  anonymous: boolean;
  reporterId: string;
  reporterName: string;
  status: "Reported" | "Verified" | "Escalated" | "Assigned" | "Resolved";
  upvotes: number;
  upvotedBy: string[];
  verifiedBy: string[];
  streetName: string;
  ward: string;
  createdAt: string | Timestamp | any;
  resolvedAt?: string | Timestamp | any;
  lastNegotiationAt?: string | Timestamp | any;
  timeline: TimelineItem[];
  negotiationLog: NegotiationLogItem[];
}
