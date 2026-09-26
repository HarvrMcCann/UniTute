import type { SupabaseClient } from "@supabase/supabase-js";
import { courseToRows, type CourseMeta } from "./rows";
import type { Course } from "./schema";

/*
 * Writes a whole course with the admin (secret-key) client. Rows are upserted on
 * (course_id, key), so re-saving keeps existing UUIDs and learners' progress stays
 * attached. Rows whose key disappeared from the course are deleted.
 * No "server-only" import: scripts run this outside Next.js.
 */

type IdRow = { id: string; key: string };

function check<T>(label: string, result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

function idMap(rows: IdRow[]): Map<string, string> {
  return new Map(rows.map((r) => [r.key, r.id]));
}

export async function saveCourse(admin: SupabaseClient, course: Course, meta: CourseMeta): Promise<void> {
  const rows = courseToRows(course, meta);
  const course_id = course.id;

  check("course", await admin.from("courses").upsert({ ...rows.course, updated_at: new Date().toISOString() }));

  const [unitIds, conceptIds] = await Promise.all([
    admin
      .from("units")
      .upsert(rows.units.map((u) => ({ ...u, course_id })), { onConflict: "course_id,key" })
      .select("id, key")
      .then((r) => idMap(check("units", r) ?? [])),
    admin
      .from("concepts")
      .upsert(rows.concepts.map((c) => ({ ...c, course_id })), { onConflict: "course_id,key" })
      .select("id, key")
      .then((r) => idMap(check("concepts", r) ?? [])),
  ]);

  const lessonIds = idMap(
    check(
      "lessons",
      await admin
        .from("lessons")
        .upsert(
          rows.lessons.map(({ unit_key, ...l }) => ({ ...l, course_id, unit_id: unitIds.get(unit_key)! })),
          { onConflict: "course_id,key" },
        )
        .select("id, key"),
    ) ?? [],
  );

  check(
    "questions",
    await admin.from("questions").upsert(
      rows.questions.map(({ lesson_key, concept_key, ...q }) => ({
        ...q,
        course_id,
        lesson_id: lessonIds.get(lesson_key)!,
        concept_id: conceptIds.get(concept_key)!,
      })),
      { onConflict: "course_id,key" },
    ),
  );

  // Lesson-concept links: replace wholesale for this course's lessons.
  check("lesson_concepts (clear)", await admin.from("lesson_concepts").delete().in("lesson_id", [...lessonIds.values()]));
  check(
    "lesson_concepts",
    await admin.from("lesson_concepts").insert(
      rows.lessonConcepts.map((lc) => ({
        lesson_id: lessonIds.get(lc.lesson_key)!,
        concept_id: conceptIds.get(lc.concept_key)!,
        position: lc.position,
      })),
    ),
  );

  // Remove anything no longer in the course (children first).
  await deleteStale(admin, "questions", course_id, new Set(rows.questions.map((q) => q.key)));
  await deleteStale(admin, "lessons", course_id, new Set(lessonIds.keys()));
  await deleteStale(admin, "units", course_id, new Set(unitIds.keys()));
  await deleteStale(admin, "concepts", course_id, new Set(conceptIds.keys()));
}

async function deleteStale(admin: SupabaseClient, table: string, courseId: string, keep: Set<string>) {
  const existing = check(table, await admin.from(table).select("id, key").eq("course_id", courseId)) as IdRow[];
  const stale = existing.filter((r) => !keep.has(r.key)).map((r) => r.id);
  if (stale.length) check(`${table} (stale)`, await admin.from(table).delete().in("id", stale));
}
