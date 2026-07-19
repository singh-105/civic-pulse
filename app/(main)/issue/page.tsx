"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import IssueDetailClient from "./IssueDetailClient";
import { Loader2 } from "lucide-react";

function IssueDetailLoader() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  const [issue, setIssue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setError("No issue ID provided.");
      setLoading(false);
      return;
    }
    const fetchIssue = async () => {
      try {
        const snap = await getDoc(doc(db, 'issues', id));
        if (snap.exists()) {
          setIssue({ id: snap.id, ...snap.data() });
        } else {
          setError('Issue not found');
        }
      } catch (err) {
        console.error(err);
        setError('Issue not found');
      } finally {
        setLoading(false);
      }
    };
    fetchIssue();
  }, [id]);

  if (loading) {
    return (
      <div className="w-full min-h-[70vh] flex flex-col items-center justify-center gap-2 text-cyan-400">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="text-xs uppercase tracking-widest font-semibold animate-pulse">
          Accessing Secure Issue Log...
        </span>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="text-center py-20 text-white">
        <h2 className="text-xl font-bold mb-4">{error || "Issue not found"}</h2>
        <a href="/dashboard" className="px-4 py-2 bg-cyan-500 text-black text-xs font-bold rounded-lg cursor-pointer">
          Go Back
        </a>
      </div>
    );
  }

  return <IssueDetailClient initialIssue={issue} />;
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="w-full min-h-[70vh] flex flex-col items-center justify-center gap-2 text-cyan-400">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="text-xs uppercase tracking-widest font-semibold animate-pulse">
          Loading Page Shell...
        </span>
      </div>
    }>
      <IssueDetailLoader />
    </Suspense>
  );
}
