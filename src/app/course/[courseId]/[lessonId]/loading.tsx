import { LessonSkeleton } from "@/components/classroom/LessonSkeleton";

// Shown instantly when switching lessons; the sidebars stay put.
export default function Loading() {
  return <LessonSkeleton />;
}
