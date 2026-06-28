"use client";

import { useAuthContext } from "@/app/providers/AuthProvider";

export type { UserProfile } from "@/app/providers/AuthProvider";

export function useAuth() {
  return useAuthContext();
}
