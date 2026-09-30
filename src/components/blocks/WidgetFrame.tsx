"use client";

import { useEffect, useRef, useState } from "react";
import { widgetDocument, type WidgetTheme } from "@/lib/widget/runtime";

type WidgetFrameProps = {
  title: string;
  html: string;
  initialHeight: number;
  /** Server-rendered explanation, shown if the widget reports an error. */
  fallback: React.ReactNode;
};

const currentTheme = (): WidgetTheme => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

/**
 * Runs an AI-written interactive in a sandboxed iframe. `sandbox="allow-scripts"` without
 * allow-same-origin gives it an opaque origin: it can't reach the app's cookies, storage or DOM,
 * and its CSP blocks the network. We only accept height and error messages from our own frame.
 */
export function WidgetFrame({ title, html, initialHeight, fallback }: WidgetFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(initialHeight);
  const [failed, setFailed] = useState(false);
  const [run, setRun] = useState(0); // bump to restart the widget
  // The document is built once per run with the theme at that moment; later theme changes are posted in.
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  // The frame's color-scheme must match the document inside it, or the browser paints an opaque backdrop.
  const [theme, setTheme] = useState<WidgetTheme>("dark");

  useEffect(() => {
    setTheme(currentTheme()); // eslint-disable-line react-hooks/set-state-in-effect -- needs the client theme
    setSrcDoc(widgetDocument(html, currentTheme()));
  }, [html, run]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const data = e.data as { source?: string; type?: string; height?: unknown };
      if (data?.source !== "unitute-widget") return;
      if (data.type === "height" && typeof data.height === "number" && Number.isFinite(data.height)) {
        setHeight(Math.min(1400, Math.max(120, Math.ceil(data.height))));
      } else if (data.type === "error") {
        setFailed(true);
      }
    };
    window.addEventListener("message", onMessage);

    // Follow the app's theme toggle.
    const observer = new MutationObserver(() => {
      setTheme(currentTheme());
      frame.current?.contentWindow?.postMessage({ type: "theme", theme: currentTheme() }, "*");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      window.removeEventListener("message", onMessage);
      observer.disconnect();
    };
  }, []);

  if (failed) {
    return (
      <div>
        {fallback}
        <button
          type="button"
          onClick={() => {
            setFailed(false);
            setRun((r) => r + 1);
          }}
          className="mt-2 text-sm text-accent hover:underline"
        >
          Try the interactive again
        </button>
      </div>
    );
  }

  return (
    <div>
      {srcDoc ? (
        <iframe
          key={run}
          ref={frame}
          title={title}
          srcDoc={srcDoc}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          loading="lazy"
          className="block w-full border-0 bg-transparent"
          style={{ height, colorScheme: theme }}
        />
      ) : (
        <div className="animate-pulse rounded-xl bg-hover" style={{ height }} />
      )}
      <div className="mt-2 flex justify-end">
        <button type="button" onClick={() => setRun((r) => r + 1)} className="text-xs text-faint hover:text-text">
          Reset
        </button>
      </div>
    </div>
  );
}
