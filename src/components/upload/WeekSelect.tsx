import { MAX_WEEK } from "@/lib/upload/guessWeek";

type WeekSelectProps = {
  value: number | null;
  onChange: (week: number | null) => void;
  disabled?: boolean;
  label: string;
};

export function WeekSelect({ value, onChange, disabled, label }: WeekSelectProps) {
  return (
    <select
      aria-label={label}
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className={`rounded-lg border bg-code py-1.5 pl-2.5 pr-7 text-sm outline-none transition-colors focus:border-accent disabled:opacity-60 ${
        value === null ? "border-mastery-mid/60 text-mastery-mid" : "border-line text-text"
      }`}
    >
      <option value="">No week</option>
      {Array.from({ length: MAX_WEEK }, (_, i) => i + 1).map((w) => (
        <option key={w} value={w}>
          Week {w}
        </option>
      ))}
    </select>
  );
}
