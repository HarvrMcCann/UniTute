"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ProgressContextValue = {
  /** Signed-in user's id, or null when browsing signed out (nothing is saved). */
  userId: string | null;
  completed: Set<string>;
  markCompleted: (lessonKey: string) => void;
};

const ProgressContext = createContext<ProgressContextValue>({
  userId: null,
  completed: new Set(),
  markCompleted: () => {},
});

export function ProgressProvider({
  userId,
  initialCompleted,
  children,
}: {
  userId: string | null;
  initialCompleted: string[];
  children: React.ReactNode;
}) {
  const [completed, setCompleted] = useState(() => new Set(initialCompleted));

  const markCompleted = useCallback((lessonKey: string) => {
    setCompleted((prev) => (prev.has(lessonKey) ? prev : new Set(prev).add(lessonKey)));
  }, []);

  const value = useMemo(() => ({ userId, completed, markCompleted }), [userId, completed, markCompleted]);
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export const useProgress = () => useContext(ProgressContext);
