type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
};

export function IconButton({ label, active, className = "", children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid size-10 shrink-0 place-items-center rounded-xl transition-colors hover:bg-hover ${
        active ? "text-accent" : "text-muted hover:text-text"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
