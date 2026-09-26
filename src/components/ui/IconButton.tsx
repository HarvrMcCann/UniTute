type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
  /** md = 40px (default), sm = 36px */
  size?: "md" | "sm";
};

export function IconButton({ label, active, size = "md", className = "", children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid ${size === "sm" ? "size-9" : "size-10"} shrink-0 place-items-center rounded-xl transition-colors hover:bg-hover ${
        active ? "text-accent" : "text-muted hover:text-text"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
