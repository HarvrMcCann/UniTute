/** Placeholder shapes shown the instant a lesson is tapped, while its content loads. */
export function LessonSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading lesson" className="mx-auto max-w-[720px] animate-pulse px-4 pt-6 sm:px-6 sm:pt-10">
      <div className="h-4 w-40 rounded-full bg-hover" />
      <div className="mt-4 h-9 w-4/5 rounded-xl bg-hover" />
      <div className="mt-4 h-5 w-full rounded-full bg-hover" />
      <div className="mt-2 h-5 w-2/3 rounded-full bg-hover" />
      <div className="mt-10 space-y-3">
        {[100, 96, 88, 94, 60].map((w, i) => (
          <div key={i} className="h-4 rounded-full bg-hover" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="mt-8 h-32 rounded-2xl border border-line bg-panel" />
      <div className="mt-8 space-y-3">
        {[92, 100, 78].map((w, i) => (
          <div key={i} className="h-4 rounded-full bg-hover" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

/** Whole-classroom placeholder for opening a course (sidebars aren't loaded yet either). */
export function ClassroomSkeleton() {
  return (
    <div className="flex h-dvh flex-col">
      <div className="h-14 shrink-0" />
      <div className="flex min-h-0 flex-1 gap-3 sm:px-3 sm:pb-3">
        <div className="hidden w-[280px] shrink-0 animate-pulse rounded-2xl border border-line bg-panel p-4 lg:block">
          <div className="h-4 w-24 rounded-full bg-hover" />
          <div className="mt-3 h-6 w-48 rounded-lg bg-hover" />
          <div className="mt-8 space-y-4">
            {[70, 85, 60, 75, 80, 65].map((w, i) => (
              <div key={i} className="h-4 rounded-full bg-hover" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <LessonSkeleton />
        </div>
      </div>
    </div>
  );
}
