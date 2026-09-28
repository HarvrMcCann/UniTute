/*
 * The document an AI-written interactive runs in. It's loaded into an <iframe sandbox="allow-scripts">
 * via srcdoc, so it gets an opaque origin: no access to the app's cookies, storage, session or DOM.
 * The CSP below also blocks all network access (no fetch, no external scripts, images or fonts),
 * so nothing can be sent anywhere. The only channel out is postMessage, and the parent accepts just
 * two message types (height, error) from its own iframe.
 */

export type WidgetTheme = "dark" | "light";

/** Colours shared with widgets and diagrams; mirrors the app's theme tokens in globals.css. */
export const WIDGET_COLOURS: Record<WidgetTheme, Record<string, string>> = {
  dark: {
    "--ink": "#e8eaf0",
    "--muted": "rgba(232, 234, 240, 0.62)",
    "--faint": "rgba(232, 234, 240, 0.4)",
    "--accent": "#5ec8c0",
    "--accent-2": "#8f8ae6",
    "--accent-3": "#e59a7c",
    "--warn": "#d2a85c",
    "--good": "#6fb58a",
    "--bad": "#c7766f",
    "--panel": "rgba(255, 255, 255, 0.06)",
    "--line": "rgba(255, 255, 255, 0.12)",
    "--control": "rgba(0, 0, 0, 0.28)",
  },
  light: {
    "--ink": "#1b2030",
    "--muted": "rgba(27, 32, 48, 0.66)",
    "--faint": "rgba(27, 32, 48, 0.44)",
    "--accent": "#2a9d95",
    "--accent-2": "#6c66cf",
    "--accent-3": "#c96d4a",
    "--warn": "#b98016",
    "--good": "#2f8a55",
    "--bad": "#c05a50",
    "--panel": "rgba(27, 32, 48, 0.04)",
    "--line": "rgba(27, 32, 48, 0.12)",
    "--control": "rgba(27, 32, 48, 0.06)",
  },
};

const vars = (theme: WidgetTheme) =>
  Object.entries(WIDGET_COLOURS[theme])
    .map(([k, v]) => `${k}:${v}`)
    .join(";");

const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:";

const BASE_CSS = `
:root{${vars("dark")};color-scheme:dark}
:root[data-theme="light"]{${vars("light")};color-scheme:light}
*{box-sizing:border-box}
html,body{margin:0;background:transparent;color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
body{padding:2px}
button{font:inherit;color:var(--ink);background:var(--control);border:1px solid var(--line);border-radius:10px;padding:6px 12px;cursor:pointer}
button:hover{border-color:var(--accent)}
button:active{transform:scale(.97)}
button.primary{background:var(--accent);border-color:var(--accent);color:#0e1320}
input,select,textarea{font:inherit;color:var(--ink);background:var(--control);border:1px solid var(--line);border-radius:8px;padding:4px 8px}
input[type=range]{accent-color:var(--accent);padding:0;background:none;border:0;width:100%}
input[type=checkbox],input[type=radio]{accent-color:var(--accent)}
label{color:var(--muted);font-size:14px}
canvas,svg,img{max-width:100%}
`;

// Runs before the widget's own scripts: reports height and errors, applies theme changes.
const BRIDGE = `
(function(){
  var post=function(m){m.source="unitute-widget";parent.postMessage(m,"*")};
  var last=0;
  var report=function(){var h=Math.ceil(document.documentElement.scrollHeight);if(h!==last){last=h;post({type:"height",height:h})}};
  new ResizeObserver(report).observe(document.documentElement);
  window.addEventListener("load",report);
  window.addEventListener("error",function(e){post({type:"error",message:String(e.message||"error").slice(0,200)})});
  window.addEventListener("message",function(e){
    if(e.source!==parent||!e.data||e.data.type!=="theme")return;
    var t=e.data.theme==="light"?"light":"dark";
    document.documentElement.setAttribute("data-theme",t);
    window.dispatchEvent(new CustomEvent("unitute-theme",{detail:t}));
  });
})();
`;

/** The full srcdoc for a widget. `html` is the widget's body (style, markup, scripts). */
export function widgetDocument(html: string, theme: WidgetTheme): string {
  return `<!doctype html><html data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${CSP}"><style>${BASE_CSS}</style><script>${BRIDGE}</script></head><body>${html}</body></html>`;
}

/** Diagram SVGs are shown as <img>; this bakes one theme's colours into a copy. */
export function themedSvg(svg: string, theme: WidgetTheme): string {
  const style = `<style>svg{${vars(theme)};font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}</style>`;
  return svg.replace(/^(<svg[^>]*>)/i, `$1${style}`);
}

export const svgDataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
