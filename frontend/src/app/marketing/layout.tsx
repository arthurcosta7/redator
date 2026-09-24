"use client";

import { UserProvider } from "@/contexts/UserContext";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <UserProvider>{children}</UserProvider>;
}
