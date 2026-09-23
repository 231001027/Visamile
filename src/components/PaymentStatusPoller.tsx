"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Stripe redirects the browser back before its webhook necessarily lands, so
 * an order can still read PENDING for a second or two. Re-render the server
 * component until it settles instead of showing the customer a dead end.
 */
export function PaymentStatusPoller({ intervalMs = 3000, maxAttempts = 20 }) {
  const router = useRouter();

  useEffect(() => {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (attempts > maxAttempts) {
        clearInterval(timer);
        return;
      }
      router.refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs, maxAttempts]);

  return null;
}
