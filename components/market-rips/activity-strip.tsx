import { FormattedNumber } from "@/components/ui/formatted-number";

const activity = [
  { initials: "OH", name: "Onyx Heron", multiple: 2.2, symbol: "TSLA" },
  { initials: "WJ", name: "wujli1", multiple: 1.7, symbol: "NVDA" },
];

export function ActivityStrip() {
  return (
    <section aria-label="Recent pack pulls" className="border-y border-border bg-card">
      <div className="flex snap-x gap-8 overflow-x-auto px-4 py-3">
        {activity.map((item) => (
          <div key={item.name} className="flex shrink-0 snap-start items-center gap-3 text-sm">
            <span className="grid size-9 place-items-center rounded-full bg-secondary font-mono text-xs font-bold text-muted-foreground">
              {item.initials}
            </span>
            <p className="whitespace-nowrap text-muted-foreground">
              <span className="font-semibold text-foreground">{item.name}</span>
              <span aria-hidden="true"> pulled </span>
              <FormattedNumber value={item.multiple} type="ratio" className="font-bold text-primary" />
              <span className="ml-1 font-mono font-semibold text-foreground">{item.symbol}</span>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
