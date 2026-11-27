import { FormattedNumber } from "@/components/ui/formatted-number";

const stocks = [
  { symbol: "TSLA", remaining: 30 },
  { symbol: "NVDA", remaining: 29 },
  { symbol: "GME", remaining: 28 },
];

export function InventoryPanel() {
  return (
    <section id="inventory" className="px-5 py-6 sm:px-7" aria-labelledby="inventory-title">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 id="inventory-title" className="text-2xl font-semibold tracking-tight">In stock</h2>
        <div className="text-right">
          <FormattedNumber value={51704} type="fiat_value" className="text-lg font-bold text-foreground" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {stocks.map((stock) => (
          <article key={stock.symbol} className="rounded-2xl border border-border bg-card p-3">
            <p className="font-mono text-sm font-bold tracking-wide">{stock.symbol}</p>
            <p className="mt-2 font-mono text-xs tabular-nums text-muted-foreground">{stock.remaining} left</p>
          </article>
        ))}
      </div>
    </section>
  );
}
