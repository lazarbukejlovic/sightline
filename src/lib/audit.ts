import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export interface AuditEntry {
  orgId: string;
  actorId?: string | null;
  /** Dotted action, e.g. "competitor.created", "scan.run", "change.reviewed". */
  action: string;
  /** Human-readable target, e.g. the competitor name or source url. */
  target?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Append an audit-log entry. Best-effort + non-blocking: an audit failure must
 * never break the underlying action. Org-scoped.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        orgId: entry.orgId,
        actorId: entry.actorId ?? null,
        action: entry.action,
        target: entry.target ?? null,
        metadata: entry.metadata,
      },
    });
  } catch (err) {
    console.warn("audit log write failed (non-fatal):", err);
  }
}
