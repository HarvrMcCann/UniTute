import katex from "katex";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/study/PrintButton";
import { getCourse } from "@/lib/course/load";

export async function generateMetadata({ params }: PageProps<"/course/[courseId]/unit/[unitId]/formulas">): Promise<Metadata> {
  const { courseId, unitId } = await params;
  const unit = (await getCourse(courseId))?.course.units.find((u) => u.id === unitId);
  return { title: unit ? `Formula sheet: ${unit.title} · UniTute` : "UniTute" };
}

/** Every formula from the unit's lessons, in the course's notation, grouped by lesson. */
export default async function FormulaSheetPage({ params }: PageProps<"/course/[courseId]/unit/[unitId]/formulas">) {
  const { courseId, unitId } = await params;
  const loaded = await getCourse(courseId);
  const unit = loaded?.course.units.find((u) => u.id === unitId);
  if (!loaded || !unit) notFound();

  const lessons = unit.lessons.filter((l) => l.formulas.length > 0);

  return (
    <article className="mx-auto max-w-[760px] px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            {loaded.course.courseCode && <>{loaded.course.courseCode} · </>}
            {unit.week !== null && <>Week {unit.week} · </>}
            {unit.title}
          </p>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Formula sheet</h1>
        </div>
        <PrintButton />
      </div>

      {lessons.length === 0 && <p className="mt-8 text-muted">No formulas for this unit yet.</p>}

      {lessons.map((lesson) => (
        <section key={lesson.id} className="mt-10 break-inside-avoid">
          <h2 className="text-sm font-medium uppercase tracking-wider text-faint">{lesson.title}</h2>
          <dl className="mt-3 divide-y divide-line rounded-2xl border border-line bg-panel frost">
            {lesson.formulas.map((f, i) => (
              <div key={i} className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-5">
                <dt className="font-medium">{f.name}</dt>
                <dd className="min-w-0">
                  <div
                    className="overflow-x-auto"
                    dangerouslySetInnerHTML={{ __html: katex.renderToString(f.latex, { displayMode: true, throwOnError: false }) }}
                  />
                  {f.note && <p className="mt-1 text-sm text-muted">{f.note}</p>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </article>
  );
}
