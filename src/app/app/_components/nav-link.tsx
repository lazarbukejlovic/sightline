"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * App nav link with an active state. Exact match for the feed root; prefix
 * match for sub-sections.
 */
export function NavLink({
  href,
  exact = false,
  children,
}: {
  href: Route;
  exact?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-1.5 py-1 transition-colors hover:text-foreground",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {children}
      <span
        className={cn(
          "absolute -bottom-[21px] left-0 right-0 h-0.5 rounded-full bg-signal transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
      />
    </Link>
  );
}
