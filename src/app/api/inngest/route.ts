import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { extractCourseFiles } from "@/inngest/extractCourseFiles";
import { generateCourse } from "@/inngest/generateCourse";

// Inngest calls this endpoint to run each step of our background functions.
export const { GET, POST, PUT } = serve({ client: inngest, functions: [extractCourseFiles, generateCourse] });

// Parsing a big PDF or writing a lesson can take a while; give each step room (Vercel Hobby allows up to 300s).
export const maxDuration = 300;
