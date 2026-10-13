import { splitLooseMath, type MathPiece } from "@/lib/looseMath";

const render = (pieces: MathPiece[]): React.ReactNode =>
  pieces.map((p, i) => (typeof p === "string" ? p : p.tag === "sup" ? <sup key={i}>{render(p.children)}</sup> : <sub key={i}>{render(p.children)}</sub>));

/** Plain text with maths written as text (ω_c, e^{jω}) shown with real super/subscripts. */
export function LooseMathText({ children }: { children: string }) {
  return <>{render(splitLooseMath(children))}</>;
}
