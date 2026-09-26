import { describe, expect, it } from "vitest";
import { guessWeek } from "@/lib/upload/guessWeek";

describe("guessWeek", () => {
  it.each([
    ["ENGR2722-8722 Signals and Systems - Week7.pdf", 7],
    ["ENGR2722-8722 Signals and Systems - Week4a.pdf", 4],
    ["Tutorial_05_Week_07_solutions.pdf", 7],
    ["T03_WK04.pdf", 4],
    ["Week 3 - Fourier series.pptx", 3],
    ["week_03_notes.docx", 3],
    ["Wk12 tutorial.pdf", 12],
    ["W5-slides.pdf", 5],
    ["COMP2123 Lecture 04.pptx", 4],
    ["Topic 9 readings.pdf", 9],
    ["L2 - intro.pdf", 2],
    ["Week 7 Lecture 13.pdf", 7], // explicit week beats lecture number
  ])("%s -> %i", (name, week) => {
    expect(guessWeek(name)).toBe(week);
  });

  it.each([
    "ENGR2722 unit outline.pdf", // course codes aren't weeks
    "Signals and Systems Textbook.pdf",
    "Week 45 archive.pdf", // out of range
    "Lawrence notes.pdf", // "L" inside a word
    "Flow2 diagrams.pdf",
  ])("%s -> null", (name) => {
    expect(guessWeek(name)).toBeNull();
  });
});
