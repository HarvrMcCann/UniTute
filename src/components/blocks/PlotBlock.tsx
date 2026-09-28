"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { BlockOf } from "@/lib/course/schema";
import { formatTick, formatValue, logTicks, niceTicks, normalise, samples } from "@/lib/plot/axes";
import { compile, type Evaluate } from "@/lib/plot/expression";

const W = 640;
const H = 340;
const M = { left: 56, right: 16, top: 14, bottom: 46 };
const PW = W - M.left - M.right;
const PH = H - M.top - M.bottom;
const COLOURS = ["var(--accent)", "var(--callout-tip)", "var(--callout-example)", "var(--mastery-mid)", "var(--mastery-high)"];
const SAMPLE_COUNT = 400;
const MAX_STEMS = 200;

type PlotSpec = Omit<BlockOf<"plot">, "id" | "type" | "conceptIds">;

/** A graph of formulas drawn in SVG, with sliders for parameters and a readout that follows the pointer. */
export function PlotBlock({ spec }: { spec: PlotSpec }) {
  const { x, y, params, series } = spec;
  const [values, setValues] = useState(() => Object.fromEntries(params.map((p) => [p.name, p.value])));
  const [hoverX, setHoverX] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const clipId = `plot-clip-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;

  const compiled = useMemo(() => {
    const names = ["x", ...params.map((p) => p.name)];
    return series.map((s): Evaluate | null => {
      try {
        return compile(s.expr, names);
      } catch {
        return null; // validated when saved; this is belt and braces
      }
    });
  }, [series, params]);

  const px = (v: number) => M.left + normalise(v, x.min, x.max, x.scale) * PW;
  const py = (v: number) => M.top + (1 - normalise(v, y.min, y.max, y.scale)) * PH;
  const evalAt = (f: Evaluate | null, xv: number) => {
    if (!f) return NaN;
    const out = f({ ...values, x: xv });
    return Number.isFinite(out) ? out : NaN;
  };

  // Lines: break the path at non-finite values and where the curve leaves the plot far off-scale.
  const paths = useMemo(() => {
    const xs = samples(x.min, x.max, x.scale, SAMPLE_COUNT);
    const lo = y.min - (y.max - y.min);
    const hi = y.max + (y.max - y.min);
    return series.map((s, i) => {
      if (s.style !== "line") return "";
      let d = "";
      let pen = false;
      for (const xv of xs) {
        const yv = evalAt(compiled[i], xv);
        const ok = Number.isFinite(yv) && (y.scale !== "log" || yv > 0) && yv > lo && yv < hi;
        if (!ok) {
          pen = false;
          continue;
        }
        d += `${pen ? "L" : "M"}${px(xv).toFixed(1)},${py(yv).toFixed(1)}`;
        pen = true;
      }
      return d;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- px/py/evalAt derive from the listed inputs
  }, [compiled, values, x, y, series]);

  const stems = useMemo(
    () =>
      series.map((s, i) => {
        if (s.style !== "stem") return [];
        const out: { x: number; y: number }[] = [];
        for (let n = Math.ceil(x.min); n <= Math.floor(x.max) && out.length < MAX_STEMS; n++) {
          const yv = evalAt(compiled[i], n);
          if (Number.isFinite(yv)) out.push({ x: n, y: Math.max(y.min, Math.min(y.max, yv)) });
        }
        return out;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- evalAt derives from the listed inputs
    [compiled, values, x, y, series],
  );

  const xTicks = x.scale === "log" ? logTicks(x.min, x.max) : niceTicks(x.min, x.max, 7);
  const yTicks = y.scale === "log" ? logTicks(y.min, y.max) : niceTicks(y.min, y.max, 6);
  const zeroY = y.scale === "linear" && y.min < 0 && y.max > 0 ? py(0) : null;

  function onPointer(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const t = ((e.clientX - rect.left) / rect.width) * W;
    const f = (t - M.left) / PW;
    if (f < 0 || f > 1) return setHoverX(null);
    const xv = x.scale === "log" ? 10 ** (Math.log10(x.min) + f * (Math.log10(x.max) - Math.log10(x.min))) : x.min + f * (x.max - x.min);
    setHoverX(series.some((s) => s.style === "stem") ? Math.round(xv) : xv);
  }

  const readout =
    hoverX === null
      ? null
      : series.map((s, i) => ({ label: s.label, colour: COLOURS[i % COLOURS.length], value: evalAt(compiled[i], hoverX) }));

  return (
    <figure className="rounded-2xl border border-line bg-panel p-4 frost sm:p-5">
      {spec.title && <p className="font-display text-lg">{spec.title}</p>}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${spec.title ?? "Graph"}: ${series.map((s) => s.label).join(", ")} against ${x.label}`}
        className="mt-2 w-full touch-none select-none"
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setHoverX(null)}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={M.left} y={M.top} width={PW} height={PH} />
          </clipPath>
        </defs>

        {/* Grid and ticks */}
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line x1={px(t)} x2={px(t)} y1={M.top} y2={M.top + PH} stroke="var(--panel-border)" />
            <text x={px(t)} y={M.top + PH + 18} textAnchor="middle" fontSize="12" fill="var(--text-faint)">
              {formatTick(t)}
            </text>
          </g>
        ))}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={M.left} x2={M.left + PW} y1={py(t)} y2={py(t)} stroke="var(--panel-border)" />
            <text x={M.left - 8} y={py(t) + 4} textAnchor="end" fontSize="12" fill="var(--text-faint)">
              {formatTick(t)}
            </text>
          </g>
        ))}
        {zeroY !== null && <line x1={M.left} x2={M.left + PW} y1={zeroY} y2={zeroY} stroke="var(--text-faint)" />}
        <rect x={M.left} y={M.top} width={PW} height={PH} fill="none" stroke="var(--panel-border)" />
        <text x={M.left + PW / 2} y={H - 6} textAnchor="middle" fontSize="13" fill="var(--text-muted)">
          {x.label}
        </text>
        <text transform={`translate(14 ${M.top + PH / 2}) rotate(-90)`} textAnchor="middle" fontSize="13" fill="var(--text-muted)">
          {y.label}
        </text>

        {/* Data */}
        <g clipPath={`url(#${clipId})`}>
          {paths.map((d, i) => d && <path key={i} d={d} fill="none" stroke={COLOURS[i % COLOURS.length]} strokeWidth="2.25" strokeLinejoin="round" />)}
          {stems.map((points, i) =>
            points.map((p) => (
              <g key={`${i}-${p.x}`} stroke={COLOURS[i % COLOURS.length]} fill={COLOURS[i % COLOURS.length]}>
                <line x1={px(p.x)} x2={px(p.x)} y1={py(Math.max(y.min, Math.min(y.max, 0)))} y2={py(p.y)} strokeWidth="2" />
                <circle cx={px(p.x)} cy={py(p.y)} r="3.5" />
              </g>
            )),
          )}
          {hoverX !== null && <line x1={px(hoverX)} x2={px(hoverX)} y1={M.top} y2={M.top + PH} stroke="var(--text-faint)" strokeDasharray="4 4" />}
        </g>
      </svg>

      {/* Legend or live readout */}
      <div className="mt-1 flex min-h-6 flex-wrap gap-x-4 gap-y-1 text-sm">
        {readout ? (
          <>
            <span className="text-muted">
              {x.label.split(" (")[0]} = {formatValue(hoverX!)}
            </span>
            {readout.map((r) => (
              <span key={r.label} style={{ color: r.colour }}>
                {r.label}: {formatValue(r.value)}
              </span>
            ))}
          </>
        ) : (
          series.length > 1 &&
          series.map((s, i) => (
            <span key={s.label} className="flex items-center gap-1.5 text-muted">
              <span className="h-0.5 w-4 rounded" style={{ background: COLOURS[i % COLOURS.length] }} />
              {s.label}
            </span>
          ))
        )}
      </div>

      {params.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {params.map((p) => (
            <label key={p.name} className="block">
              <span className="flex justify-between text-sm">
                <span className="text-muted">{p.label}</span>
                <span className="font-medium tabular-nums">{formatValue(values[p.name], p.step)}</span>
              </span>
              <input
                type="range"
                min={p.min}
                max={p.max}
                step={p.step}
                value={values[p.name]}
                onChange={(e) => setValues((v) => ({ ...v, [p.name]: Number(e.target.value) }))}
                className="mt-1 w-full accent-[var(--accent)]"
              />
            </label>
          ))}
        </div>
      )}

      {spec.caption && <figcaption className="mt-3 text-sm text-muted">{spec.caption}</figcaption>}
    </figure>
  );
}
