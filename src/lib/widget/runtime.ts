/*
 * The document an AI-written interactive runs in. It's loaded into an <iframe sandbox="allow-scripts">
 * via srcdoc, so it gets an opaque origin: no access to the app's cookies, storage, session or DOM.
 * The CSP below also blocks all network access (no fetch, no external scripts, images or fonts),
 * so nothing can be sent anywhere. The only channel out is postMessage, and the parent accepts just
 * two message types (height, error) from its own iframe.
 */

import { LOOSE_MATH_SOURCE, svgLooseMath } from "@/lib/looseMath";

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
.math{font-family:"Cambria Math","STIX Two Math","Times New Roman",serif;font-size:1.05em}
sup,sub{font-size:.72em;line-height:0}
`;

// Runs before the widget's own scripts: reports height and errors, applies theme changes.
const BRIDGE = `
(function(){
  var post=function(m){m.source="unitute-widget";parent.postMessage(m,"*")};
  var last=0;
  // Measure the content itself: the document's scrollHeight is never less than the frame, so it could only grow.
  var report=function(){if(!document.body)return;var h=Math.ceil(document.body.getBoundingClientRect().height)+2;if(h!==last){last=h;post({type:"height",height:h})}};
  // Maths written as text ("X(e^{jω})", "ω_c") becomes real super/subscripts in every HTML text
  // node, including ones the widget's script writes later. Same rule as lib/looseMath.ts.
  var SRC=${JSON.stringify(LOOSE_MATH_SOURCE)},HAS=new RegExp(SRC,"u");
  var build=function(text){var f=document.createDocumentFragment(),re=new RegExp(SRC,"gu"),last=0,m;
    while((m=re.exec(text))){if(m.index>last)f.appendChild(document.createTextNode(text.slice(last,m.index)));
      var el=document.createElement(m[1]==="^"?"sup":"sub");el.appendChild(build(m[2]!=null?m[2]:m[3]));f.appendChild(el);last=m.index+m[0].length}
    if(last<text.length)f.appendChild(document.createTextNode(text.slice(last)));return f};
  var fixText=function(n){var p=n.parentNode;if(!p||!HAS.test(n.nodeValue)||p.namespaceURI!=="http://www.w3.org/1999/xhtml"||/^(SCRIPT|STYLE|TEXTAREA|OPTION|TITLE)$/.test(p.nodeName))return;p.replaceChild(build(n.nodeValue),n)};
  var scan=function(root){if(root.nodeType===3)return fixText(root);if(root.nodeType!==1)return;var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),list=[],n;while((n=w.nextNode()))list.push(n);list.forEach(fixText)};
  window.UniTute={math:function(el,s){if(s!=null)el.textContent=s;scan(el)}};
  document.addEventListener("DOMContentLoaded",function(){
    scan(document.body);
    new MutationObserver(function(muts){muts.forEach(function(mu){if(mu.type==="characterData")fixText(mu.target);else mu.addedNodes.forEach(scan)})})
      .observe(document.body,{childList:true,subtree:true,characterData:true});
    new ResizeObserver(report).observe(document.body);
    report();
  });
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
  return svgLooseMath(svg).replace(/^(<svg[^>]*>)/i, `$1${style}`);
}

export const svgDataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
