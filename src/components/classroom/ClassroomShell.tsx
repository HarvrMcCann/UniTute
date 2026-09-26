"use client";

import { AnimatePresence, motion, useDragControls } from "motion/react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountMenu, type Account } from "@/components/auth/AccountMenu";
import { IconButton } from "@/components/ui/IconButton";
import { ChatIcon, CloseIcon, MenuIcon, SidebarIcon } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { CourseOutline } from "@/lib/course/load";
import { CurriculumNav } from "./CurriculumNav";
import { LESSON_SCROLL_ID } from "./ProgressTracker";
import { TutorPanel } from "./TutorPanel";

const DESKTOP = "(min-width: 1024px)"; // lg: three columns
const TABLET_UP = "(min-width: 768px)"; // md: tutor is a side panel, not a sheet

const matches = (query: string) => window.matchMedia(query).matches;

/**
 * Tutor side panel state. "auto" = open on desktop, closed on tablet, which CSS handles
 * so the server render needs no screen size. Phones always use the bottom sheet instead.
 */
type TutorPanelMode = "auto" | "open" | "closed";

const TUTOR_PANEL_CLASSES: Record<TutorPanelMode, string> = {
  auto: "hidden lg:flex",
  open: "hidden md:flex",
  closed: "hidden",
};

const panel = "rounded-2xl border border-line bg-panel backdrop-blur-xl";

type ClassroomShellProps = {
  outline: CourseOutline;
  account: Account | null;
  children: React.ReactNode;
};

export function ClassroomShell({ outline, account, children }: ClassroomShellProps) {
  const { lessonId } = useParams<{ lessonId?: string }>();
  const lessonTitle = outline.units.flatMap((u) => u.lessons).find((l) => l.id === lessonId)?.title;

  const [navCollapsed, setNavCollapsed] = useState(false); // desktop column
  const [drawerOpen, setDrawerOpen] = useState(false); // tablet + phone
  const [tutorMode, setTutorMode] = useState<TutorPanelMode>("auto"); // tablet + desktop
  const [sheetOpen, setSheetOpen] = useState(false); // phone

  const sheetDrag = useDragControls();

  // Escape closes overlays.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setDrawerOpen(false);
      setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleCurriculum() {
    if (matches(DESKTOP)) setNavCollapsed((c) => !c);
    else setDrawerOpen((o) => !o);
  }

  function toggleTutor() {
    if (!matches(TABLET_UP)) {
      setSheetOpen((o) => !o);
      return;
    }
    setTutorMode((mode) => {
      const isOpen = mode === "open" || (mode === "auto" && matches(DESKTOP));
      return isOpen ? "closed" : "open";
    });
  }

  function closeTutor() {
    setTutorMode("closed");
    setSheetOpen(false);
  }

  return (
    <div className="flex h-dvh flex-col">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-1 px-2 sm:px-3">
        <IconButton label="Toggle curriculum" onClick={toggleCurriculum}>
          <MenuIcon className="lg:hidden" />
          <SidebarIcon className="hidden lg:block" />
        </IconButton>
        <div className="min-w-0 flex-1 px-2">
          <p className="truncate text-sm">
            <span className="hidden text-muted sm:inline">{outline.courseCode} · </span>
            <span className="font-medium">{lessonTitle ?? outline.title}</span>
          </p>
        </div>
        <ThemeToggle />
        <IconButton label="Toggle tutor" onClick={toggleTutor}>
          <ChatIcon />
        </IconButton>
        <AccountMenu account={account} />
      </header>

      <div className="flex min-h-0 flex-1 gap-3 px-0 sm:px-3 sm:pb-3">
        {/* Desktop curriculum column */}
        <AnimatePresence initial={false}>
          {!navCollapsed && (
            <motion.aside
              key="nav"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={`hidden shrink-0 overflow-hidden lg:block ${panel}`}
            >
              <div className="h-full w-[280px]">
                <CurriculumNav outline={outline} currentLessonId={lessonId} />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Lesson */}
        {/* Scroll position is restored and tracked by ProgressTracker */}
        <main id={LESSON_SCROLL_ID} className="scroll-thin min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Tutor side panel (tablet + desktop) */}
        <aside
          aria-label="Tutor"
          className={`w-[340px] shrink-0 flex-col overflow-hidden lg:w-[380px] ${panel} ${TUTOR_PANEL_CLASSES[tutorMode]}`}
        >
          <TutorPanel lessonTitle={lessonTitle} onClose={closeTutor} />
        </aside>
      </div>

      {/* Curriculum drawer (tablet + phone) */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Curriculum"
              className="absolute inset-y-0 left-0 flex w-[85vw] max-w-[320px] flex-col border-r border-line bg-panel-strong backdrop-blur-xl"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
            >
              <div className="absolute right-2 top-2 z-10">
                <IconButton label="Close curriculum" onClick={() => setDrawerOpen(false)}>
                  <CloseIcon />
                </IconButton>
              </div>
              <CurriculumNav
                outline={outline}
                currentLessonId={lessonId}
                onNavigate={() => setDrawerOpen(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tutor bottom sheet (phone) */}
      <AnimatePresence>
        {sheetOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <motion.div
              className="absolute inset-0 bg-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheetOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Tutor"
              className="absolute inset-x-0 bottom-0 flex h-[78dvh] flex-col rounded-t-3xl border-t border-line bg-panel-strong backdrop-blur-xl"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "tween", duration: 0.28, ease: "easeOut" }}
              drag="y"
              dragListener={false}
              dragControls={sheetDrag}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 500) setSheetOpen(false);
              }}
            >
              {/* Drag handle: only this starts a drag, so the chat can still scroll */}
              <div
                className="flex cursor-grab touch-none justify-center pb-1 pt-3"
                onPointerDown={(e) => sheetDrag.start(e)}
                aria-hidden
              >
                <div className="h-1 w-10 rounded-full bg-faint" />
              </div>
              <div className="min-h-0 flex-1">
                <TutorPanel lessonTitle={lessonTitle} onClose={closeTutor} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
