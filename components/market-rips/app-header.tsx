import { CircleHelp } from "lucide-react";
import { WalletControl } from "./wallet-control";

interface AppHeaderProps {
  helpOpen: boolean;
  onOpenHelp: () => void;
}

export function AppHeader({ helpOpen, onOpenHelp }: AppHeaderProps) {
  return (
    <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 pt-5 sm:px-7 sm:pt-7">
      <button
        type="button"
        onClick={onOpenHelp}
        className="grid size-11 cursor-pointer place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-sm motion-safe:transition-[transform,border-color] motion-safe:duration-100 hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px"
        aria-label="About Ripfolio and pack details"
        aria-haspopup="dialog"
        aria-expanded={helpOpen}
      >
        <CircleHelp className="size-4" aria-hidden="true" />
      </button>

      <div
        className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center gap-2"
        aria-label="Ripfolio"
      >
        <span className="grid size-7 place-items-center rounded-lg bg-primary text-xs font-extrabold text-primary-foreground shadow-sm">
          R
        </span>
        <span className="text-[0.7rem] font-extrabold tracking-[0.18em] text-foreground">
          RIPFOLIO
        </span>
      </div>
      <WalletControl compact />
    </header>
  );
}
