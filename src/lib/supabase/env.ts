function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name}. Add it to .env.local (see .env.example).`);
  return value;
}

// Written out in full so Next.js can inline the NEXT_PUBLIC_ values into browser code.
export const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_PUBLISHABLE_KEY = required(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
