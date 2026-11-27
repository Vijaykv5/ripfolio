import type { PackQuantity } from "./pack-stage";

interface PurchaseBarProps {
  quantity: PackQuantity;
  onReview: () => void;
}

export function PurchaseBar({ quantity, onReview }: PurchaseBarProps) {
  return (
    <aside className="sticky bottom-0 z-30 mt-auto border-t border-border bg-background/90 px-5 py-4 backdrop-blur-xl sm:px-7" aria-label="Purchase">
      <div className="flex min-w-0 items-center">
        <button
          type="button"
          onClick={onReview}
          className="flex min-h-14 w-full cursor-pointer items-center justify-center rounded-full bg-foreground px-5 font-bold text-background motion-safe:transition-[transform,filter] motion-safe:duration-100 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring active:translate-y-px"
        >
          Buy {quantity === 1 ? "1 pack" : "3 packs"}
        </button>
      </div>
    </aside>
  );
}
