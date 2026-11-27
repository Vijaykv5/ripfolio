export type PackId = "market" | "nvda" | "tsla" | "gme";

export interface PackOption {
  id: PackId;
  label: string;
  mark: string;
  detail: string;
  priceUsdc: number;
  themeClass: string;
}

export const PACK_OPTIONS: readonly PackOption[] = [
  {
    id: "market",
    label: "Market Mix",
    mark: "MIX",
    detail: "3-STOCK MIX",
    priceUsdc: 10,
    themeClass: "pack-theme-market",
  },
  {
    id: "nvda",
    label: "Nvidia",
    mark: "NVDA",
    detail: "NVIDIA STOCK",
    priceUsdc: 5,
    themeClass: "pack-theme-nvda",
  },
  {
    id: "tsla",
    label: "Tesla",
    mark: "TSLA",
    detail: "TESLA STOCK",
    priceUsdc: 5,
    themeClass: "pack-theme-tsla",
  },
  {
    id: "gme",
    label: "GameStop",
    mark: "GME",
    detail: "GAMESTOP STOCK",
    priceUsdc: 5,
    themeClass: "pack-theme-gme",
  },
] as const;

export const DEFAULT_PACK = PACK_OPTIONS[0];
