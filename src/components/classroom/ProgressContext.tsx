"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * - "none": not scrolled to the end yet
 * - "read": scrolled to the end, but some checks aren't finished
 * - "done": scrolled to the end and every check finished
 */
export type LessonStatus = "none" | "read" | "done";

type ProgressContextValue = {
  /** Signed-in user's id, or null when browsing signed out (nothing is saved). */
  userId: string | null;
  statusOf: (lessonKey: string) => LessonStatus;
  markScrolled: (lessonKey: string) => void;
  markAnswered: (questionKey: string) => void;
};

const ProgressContext = createContext<ProgressContextValue>({
  userId: null,
  statusOf: () => "none",
  markScrolled: () => {},
  markAnswered: () => {},
});

type ProgressProviderProps = {
  userId: string | null;
  /** Lessons already scrolled to the end. */
  initialScrolled: string[];
  /** Questions already finished. */
  initialAnswered: string[];
  /** Lesson key -> its question keys. */
  lessonQuestions: Record<string, string[]>;
  children: React.ReactNode;
};

const addTo = (key: string) => (prev: Set<string>) => (prev.has(key) ? prev : new Set(prev).add(key));

export function ProgressProvider({
  userId,
  initialScrolled,
  initialAnswered,
  lessonQuestions,
  children,
}: ProgressProviderProps) {
  const [scrolled, setScrolled] = useState(() => new Set(initialScrolled));
  const [answered, setAnswered] = useState(() => new Set(initialAnswered));

  const markScrolled = useCallback((lessonKey: string) => setScrolled(addTo(lessonKey)), []);
  const markAnswered = useCallback((questionKey: string) => setAnswered(addTo(questionKey)), []);

  const statusOf = useCallback(
    (lessonKey: string): LessonStatus => {
      if (!scrolled.has(lessonKey)) return "none";
      return (lessonQuestions[lessonKey] ?? []).every((q) => answered.has(q)) ? "done" : "read";
    },
    [scrolled, answered, lessonQuestions],
  );

  const value = useMemo(
    () => ({ userId, statusOf, markScrolled, markAnswered }),
    [userId, statusOf, markScrolled, markAnswered],
  );
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export const useProgress = () => useContext(ProgressContext);
