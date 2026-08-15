import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface ${className}`}>
      {children}
    </div>
  );
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function DetailSkeleton() {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-5 w-36" />
        <SkeletonBlock className="h-5 w-5 rounded-full" />
      </div>
      <SkeletonBlock className="mt-2 h-3 w-48" />
      <div className="mt-5 flex items-center gap-3">
        <SkeletonBlock className="h-8 w-20 rounded-lg" />
        <SkeletonBlock className="h-3 w-40" />
      </div>
      <SkeletonBlock className="mt-6 h-[180px] w-full" />
      <SkeletonBlock className="mt-6 h-[160px] w-full" />
    </Card>
  );
}

export function ErrorState({ message, hint }: { message: string; hint?: string }) {
  return (
    <Card className="p-6 anim-in">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center
                        rounded-full bg-tier-severe/10 text-tier-severe">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round">
            <path d="M12 8v5m0 3.5v.5M10.3 3.9 2.5 18a1.8 1.8 0 0 0 1.6 2.7h15.8a1.8 1.8 0 0 0 1.6-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{message}</p>
          {hint && <p className="mt-1 text-xs leading-relaxed text-fg-muted">{hint}</p>}
        </div>
      </div>
    </Card>
  );
}

export function EmptyState() {
  return (
    <Card className="p-6 anim-in">
      <div className="mx-auto mt-2 flex h-12 w-12 items-center justify-center
                      rounded-full bg-surface-2 text-accent">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
          <path d="M9 3v15M15 6v15" />
        </svg>
      </div>
      <p className="mt-4 text-center text-sm font-semibold">No district selected</p>
      <p className="mx-auto mt-1 max-w-[280px] text-center text-xs leading-relaxed text-fg-muted">
        Tap a marker on the map or pick a district from the risk list to see its
        72-hour forecast curve, recent rainfall, and outlook.
      </p>
    </Card>
  );
}
