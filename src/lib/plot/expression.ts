/*
 * A small, safe formula evaluator for plot blocks. Formulas come from Claude, so they're
 * parsed into a closure over a fixed set of operators and functions; nothing is ever
 * eval'd. Supports + - * / ^, parentheses, unary minus, numbers like 2.5e-3, the constants
 * pi and e, the variable x, slider parameters, and the functions below.
 */

const FUNCTIONS: Record<string, { arity: number | "any"; fn: (...a: number[]) => number }> = {
  sin: { arity: 1, fn: Math.sin },
  cos: { arity: 1, fn: Math.cos },
  tan: { arity: 1, fn: Math.tan },
  asin: { arity: 1, fn: Math.asin },
  acos: { arity: 1, fn: Math.acos },
  atan: { arity: 1, fn: Math.atan },
  arctan: { arity: 1, fn: Math.atan },
  atan2: { arity: 2, fn: Math.atan2 },
  sinh: { arity: 1, fn: Math.sinh },
  cosh: { arity: 1, fn: Math.cosh },
  tanh: { arity: 1, fn: Math.tanh },
  exp: { arity: 1, fn: Math.exp },
  ln: { arity: 1, fn: Math.log },
  log10: { arity: 1, fn: Math.log10 },
  log: { arity: 1, fn: Math.log10 }, // engineering convention: log = log10 (use ln for natural log)
  log2: { arity: 1, fn: Math.log2 },
  sqrt: { arity: 1, fn: Math.sqrt },
  abs: { arity: 1, fn: Math.abs },
  sign: { arity: 1, fn: Math.sign },
  floor: { arity: 1, fn: Math.floor },
  ceil: { arity: 1, fn: Math.ceil },
  round: { arity: 1, fn: Math.round },
  min: { arity: "any", fn: Math.min },
  max: { arity: "any", fn: Math.max },
  pow: { arity: 2, fn: Math.pow },
  mod: { arity: 2, fn: (a, b) => ((a % b) + b) % b },
  u: { arity: 1, fn: (t) => (t >= 0 ? 1 : 0) }, // unit step
  step: { arity: 1, fn: (t) => (t >= 0 ? 1 : 0) },
  rect: { arity: 1, fn: (t) => (Math.abs(t) <= 0.5 ? 1 : 0) },
  sinc: { arity: 1, fn: (t) => (t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t)) },
  deg: { arity: 1, fn: (r) => (r * 180) / Math.PI },
  rad: { arity: 1, fn: (d) => (d * Math.PI) / 180 },
};

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

export type Evaluate = (vars: Record<string, number>) => number;

export class ExpressionError extends Error {}

type Token = { kind: "num"; value: number } | { kind: "id"; name: string } | { kind: "op"; op: string };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
      if (!m) throw new ExpressionError(`Bad number at "${src.slice(i, i + 8)}"`);
      tokens.push({ kind: "num", value: Number(m[0]) });
      i += m[0].length;
    } else if (/[a-zA-Z_]/.test(c)) {
      const m = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(src.slice(i))!;
      tokens.push({ kind: "id", name: m[0] });
      i += m[0].length;
    } else if ("+-*/^(),".includes(c)) {
      tokens.push({ kind: "op", op: c });
      i++;
    } else {
      throw new ExpressionError(`Unexpected "${c}"`);
    }
  }
  return tokens;
}

/** Compiles `src` once; the result evaluates it for given variable values. Throws ExpressionError. */
export function compile(src: string, variables: string[]): Evaluate {
  if (src.length > 500) throw new ExpressionError("Formula is too long");
  const tokens = tokenize(src);
  const allowed = new Set(variables);
  let pos = 0;

  const peek = () => tokens[pos];
  const isOp = (op: string) => peek()?.kind === "op" && (peek() as { op: string }).op === op;
  const expectOp = (op: string) => {
    if (!isOp(op)) throw new ExpressionError(`Expected "${op}"`);
    pos++;
  };

  // expr := term (('+'|'-') term)*
  function expr(): Evaluate {
    let left = term();
    while (isOp("+") || isOp("-")) {
      const op = (tokens[pos++] as { op: string }).op;
      const a = left;
      const b = term();
      left = op === "+" ? (v) => a(v) + b(v) : (v) => a(v) - b(v);
    }
    return left;
  }
  // term := unary (('*'|'/') unary)*
  function term(): Evaluate {
    let left = unary();
    while (isOp("*") || isOp("/")) {
      const op = (tokens[pos++] as { op: string }).op;
      const a = left;
      const b = unary();
      left = op === "*" ? (v) => a(v) * b(v) : (v) => a(v) / b(v);
    }
    return left;
  }
  // unary := ('-'|'+') unary | power     (so -x^2 = -(x^2))
  function unary(): Evaluate {
    if (isOp("-")) {
      pos++;
      const a = unary();
      return (v) => -a(v);
    }
    if (isOp("+")) {
      pos++;
      return unary();
    }
    return power();
  }
  // power := atom ('^' unary)?     (right-associative: 2^3^2 = 2^9)
  function power(): Evaluate {
    const base = atom();
    if (isOp("^")) {
      pos++;
      const exponent = unary();
      return (v) => Math.pow(base(v), exponent(v));
    }
    return base;
  }
  function atom(): Evaluate {
    const t = tokens[pos++];
    if (!t) throw new ExpressionError("Formula ends too early");
    if (t.kind === "num") return () => t.value;
    if (t.kind === "op" && t.op === "(") {
      const inner = expr();
      expectOp(")");
      return inner;
    }
    if (t.kind === "id") {
      if (isOp("(")) {
        const f = FUNCTIONS[t.name];
        if (!f) throw new ExpressionError(`Unknown function "${t.name}"`);
        pos++;
        const args: Evaluate[] = [];
        if (!isOp(")")) {
          args.push(expr());
          while (isOp(",")) {
            pos++;
            args.push(expr());
          }
        }
        expectOp(")");
        if (f.arity !== "any" && args.length !== f.arity) throw new ExpressionError(`${t.name} takes ${f.arity} argument(s)`);
        if (args.length === 0) throw new ExpressionError(`${t.name} needs an argument`);
        return (v) => f.fn(...args.map((a) => a(v)));
      }
      if (allowed.has(t.name)) return (v) => v[t.name];
      if (t.name in CONSTANTS) return () => CONSTANTS[t.name];
      throw new ExpressionError(`Unknown name "${t.name}"`);
    }
    throw new ExpressionError(`Unexpected "${t.kind === "op" ? t.op : "?"}"`);
  }

  const result = expr();
  if (pos !== tokens.length) throw new ExpressionError("Unexpected text after the formula");
  return result;
}
