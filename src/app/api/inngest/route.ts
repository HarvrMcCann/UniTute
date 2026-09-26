import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { extractCourseFiles } from "@/inngest/extractCourseFiles";

// Inngest calls this endpoint to run each step of our background functions.
export const { GET, POST, PUT } = serve({ client: inngest, functions: [extractCourseFiles] });

// Parsing a big PDF can take a while; give each step room (Vercel Hobby allows up to 300s).
export const maxDuration = 300;
