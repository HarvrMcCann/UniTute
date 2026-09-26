import { Inngest } from "inngest";

/** Inngest runs long jobs (text extraction now, course generation in phase 5) in resumable steps. */
export const inngest = new Inngest({ id: "unitute" });

export type FilesUploadedEvent = { name: "course/files.uploaded"; data: { courseId: string } };
