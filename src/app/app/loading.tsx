import {
  FeedSkeleton,
  SidebarSkeleton,
  PanelSkeleton,
} from "./_components/skeletons";

export default function Loading() {
  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_340px]">
      <SidebarSkeleton />
      <div className="flex flex-col gap-4">
        <div className="h-9" />
        <FeedSkeleton />
      </div>
      <div className="hidden lg:block">
        <PanelSkeleton />
      </div>
    </div>
  );
}
