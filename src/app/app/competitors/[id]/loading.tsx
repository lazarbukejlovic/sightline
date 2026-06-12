import { Skeleton } from "@/components/ui/skeleton";
import { ChangeCardSkeleton } from "@/app/app/_components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-lg" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-7 w-32" />
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
          <ChangeCardSkeleton />
        </div>
        <Skeleton className="hidden h-72 w-full rounded-xl lg:block" />
      </div>
    </div>
  );
}
