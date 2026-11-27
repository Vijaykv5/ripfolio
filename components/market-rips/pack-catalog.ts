export type PackId = "market" | "nvda" | "tsla" | "aapl";

export interface PackOption {
  id: PackId;
  label: string;
  mark: string;
  detail: string;
  themeClass: string;
}

export const PACK_OPTIONS: readonly PackOption[] = [
  {
    id: "market",
    label: "Market Mix",
    mark: "MIX",
    detail: "3-STOCK MIX",
    themeClass: "pack-theme-market",
  },
  {
    id: "nvda",
    label: "Nvidia",
    mark: "NVDA",
    detail: "NVIDIA STOCK",
    themeClass: "pack-theme-nvda",
  },
  {
    id: "tsla",
    label: "Tesla",
    mark: "TSLA",
    detail: "TESLA STOCK",
    themeClass: "pack-theme-tsla",
  },
  {
    id: "aapl",
    label: "Apple",
    mark: "AAPL",
    detail: "APPLE STOCK",
    themeClass: "pack-theme-aapl",
  },
] as const;

export const DEFAULT_PACK = PACK_OPTIONS[0];
