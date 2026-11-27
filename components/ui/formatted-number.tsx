import { formatNumber, type FormatOptions } from "@/lib/format-number";

interface FormattedNumberProps extends FormatOptions {
  value: number | null | undefined;
  className?: string;
}

export function FormattedNumber({
  value,
  className,
  ...options
}: FormattedNumberProps) {
  const formatted = formatNumber(value, options);

  return (
    <span
      className={`font-mono tabular-nums ${className ?? ""}`}
      aria-label={formatted.ariaLabel}
      title={formatted.raw || undefined}
    >
      {formatted.display}
    </span>
  );
}
