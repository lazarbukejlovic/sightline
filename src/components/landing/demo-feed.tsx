"use client";

import { ChangeCard, type ChangeCardData } from "@/components/change-card";

const DEMO_CHANGES: ChangeCardData[] = [
  {
    competitor: "Northwind",
    initials: "NW",
    category: "pricing",
    impact: "high",
    confidence: 0.92,
    summary:
      "Removed the $49 Starter tier and introduced usage-based pricing with a $0 free seat plus metered AI credits.",
    whyItMatters:
      "Their entry point is now free — expect more bottom-up trials competing with our Starter deals.",
    source: "northwind.com/pricing",
    detectedAt: "2m ago",
  },
  {
    competitor: "Halcyon",
    initials: "HL",
    category: "product",
    impact: "medium",
    confidence: 0.78,
    summary:
      "Shipped a native Salesforce sync and a redesigned reporting dashboard, per the latest changelog entry.",
    whyItMatters:
      "Closes a gap RevOps buyers ask us about — update the integrations battlecard.",
    source: "halcyon.io/changelog",
    detectedAt: "1h ago",
  },
  {
    competitor: "Vertex Labs",
    initials: "VL",
    category: "funding",
    impact: "high",
    confidence: 0.64,
    summary:
      "News mentions a possible Series B; figures are unconfirmed across sources.",
    whyItMatters:
      "Low confidence — routed to the Review Queue before it hits a battlecard.",
    source: "techfunding.news",
    detectedAt: "3h ago",
  },
];

export function DemoFeed() {
  return (
    <div className="flex flex-col gap-4">
      {DEMO_CHANGES.map((change, i) => (
        <ChangeCard key={change.competitor} data={change} index={i} />
      ))}
    </div>
  );
}
