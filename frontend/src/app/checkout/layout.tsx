"use client";

import { UserProvider } from "@/contexts/UserContext";

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <UserProvider>{children}</UserProvider>;
}
