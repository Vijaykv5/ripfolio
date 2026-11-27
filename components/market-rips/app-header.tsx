import { CircleHelp } from "lucide-react";
import { WalletControl } from "./wallet-control";

interface AppHeaderProps {
  onOpenHelp: () => void;
}

export function AppHeader({ onOpenHelp }: AppHeaderProps) {
  return (
    <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 pt-5 sm:px-7 sm:pt-7">
      <button
        type="button"
        onClick={onOpenHelp}
        className="grid size-11 cursor-pointer place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-sm motion-safe:transition-[transform,border-color] motion-safe:duration-100 hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px"
        aria-label="How it works"
      >
        <CircleHelp className="size-4" aria-hidden="true" />
      </button>
      <WalletControl compact />
    </header>
  );
}
