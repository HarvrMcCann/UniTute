/**
 * Loads the hand-written sample course into Supabase (safe to re-run; progress is kept).
 * Usage: npm run seed
 */
import sample from "../src/content/sample-course.json";
import { createAdminClient } from "../src/lib/supabase/admin";
import { saveCourse } from "../src/lib/course/save";
import { courseSchema } from "../src/lib/course/schema";

async function main() {
  const course = courseSchema.parse(sample);
  await saveCourse(createAdminClient(), course, { ownerId: null, isSample: true, status: "ready" });
  const lessons = course.units.flatMap((u) => u.lessons).length;
  console.log(`Seeded "${course.title}" (${course.units.length} units, ${lessons} lessons).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
