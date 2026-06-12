import { Skeleton } from "@/components/ui/skeleton";
import { ChangeCardSkeleton } from "../_components/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-prose" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <ChangeCardSkeleton key={i} />
      ))}
    </div>
  );
}
