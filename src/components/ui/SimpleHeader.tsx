import Link from "next/link";
import { AccountMenu, type Account } from "@/components/auth/AccountMenu";
import { ThemeToggle } from "./ThemeToggle";

/** Top bar for pages outside the classroom (home, upload, sign-in). */
export function SimpleHeader({ account }: { account?: Account | null }) {
  return (
    <header className="flex items-center justify-between gap-2 py-4">
      <Link href="/" className="flex-1 font-display text-xl font-semibold tracking-tight">
        UniTute
      </Link>
      <ThemeToggle />
      {account !== undefined && <AccountMenu account={account} />}
    </header>
  );
}
