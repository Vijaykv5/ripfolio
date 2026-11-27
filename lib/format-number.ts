export type NumberType =
  | "fiat_value"
  | "stable_value"
  | "token_amount"
  | "token_price"
  | "percent"
  | "ratio";

export type NumberContext = "compact" | "detailed";
export type SignMode = "auto" | "always" | "never";

export interface FormatOptions {
  type: NumberType;
  context?: NumberContext;
  tokenPriceUsd?: number;
  sign?: SignMode;
}

export interface FormatResult {
  display: string;
  raw: string;
  ariaLabel: string;
  isTiny: boolean;
  isSubscript: boolean;
}

const SUBSCRIPT_DIGITS: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
};

const ABBREVIATIONS = [
  { threshold: 1e12, suffix: "T" },
  { threshold: 1e9, suffix: "B" },
  { threshold: 1e6, suffix: "M" },
  { threshold: 1e3, suffix: "K" },
];

function toDecimalString(value: number): string {
  if (value === 0) return "0";
  const current = value.toString();
  if (!/[eE]/.test(current)) return current;

  const [coefficient, exponentText] = current.toLowerCase().split("e");
  const exponent = Number(exponentText);
  const negative = coefficient.startsWith("-");
  const digits = coefficient.replace("-", "").replace(".", "");
  const decimalIndex = (coefficient.replace("-", "").indexOf(".") || coefficient.length) + exponent;

  if (decimalIndex <= 0) {
    return `${negative ? "-" : ""}0.${"0".repeat(Math.abs(decimalIndex))}${digits}`;
  }

  if (decimalIndex >= digits.length) {
    return `${negative ? "-" : ""}${digits}${"0".repeat(decimalIndex - digits.length)}`;
  }

  return `${negative ? "-" : ""}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
}

function applySign(value: number, content: string, sign: SignMode): string {
  if (sign === "never") return content;
  if (value < 0) return `-${content}`;
  if (sign === "always") return `+${content}`;
  return content;
}

function result(
  value: number,
  display: string,
  isTiny = false,
  isSubscript = false,
  ariaLabel = display,
): FormatResult {
  return {
    display,
    raw: toDecimalString(value),
    ariaLabel,
    isTiny,
    isSubscript,
  };
}

function countLeadingZeros(value: number): number {
  if (value >= 1 || value === 0) return 0;
  const decimal = value.toFixed(20).split(".")[1] ?? "";
  let count = 0;
  for (const character of decimal) {
    if (character !== "0") break;
    count += 1;
  }
  return count;
}

function zeroSubscript(value: number, significantDigits: number): FormatResult {
  const absolute = Math.abs(value);
  const zeroCount = countLeadingZeros(absolute);
  const decimals = zeroCount + significantDigits;
  const expanded = absolute.toFixed(decimals);
  const significant = (expanded.split(".")[1] ?? "").slice(zeroCount, decimals);
  const subscript = String(zeroCount)
    .split("")
    .map((digit) => SUBSCRIPT_DIGITS[digit] ?? digit)
    .join("");
  const prefix = value < 0 ? "-" : "";
  return result(value, `${prefix}0.0${subscript}${significant}`, false, true, `${prefix}${expanded}`);
}

function abbreviate(value: number, prefix = ""): FormatResult | null {
  const absolute = Math.abs(value);
  const match = ABBREVIATIONS.find(({ threshold }) => absolute >= threshold);
  if (!match) return null;
  const amount = (absolute / match.threshold).toFixed(1).replace(/\.0$/, "");
  return result(value, applySign(value, `${prefix}${amount}${match.suffix}`, "auto"));
}

export function formatNumber(
  input: number | null | undefined,
  options: FormatOptions,
): FormatResult {
  if (input == null || !Number.isFinite(input)) {
    return {
      display: "--",
      raw: "",
      ariaLabel: "No data",
      isTiny: false,
      isSubscript: false,
    };
  }

  const value = Object.is(input, -0) ? 0 : input;
  const absolute = Math.abs(value);
  const context = options.context ?? "compact";
  const sign = options.sign ?? "auto";

  if (value === 0) {
    const zeros: Record<NumberType, string> = {
      fiat_value: "$0.00",
      stable_value: "$0.00",
      token_amount: "0",
      token_price: "$0.00",
      percent: "0.00%",
      ratio: "0x",
    };
    return result(0, zeros[options.type]);
  }

  if (options.type === "fiat_value" || options.type === "stable_value") {
    if (absolute < 0.01) {
      return result(value, `${value < 0 ? "-" : sign === "always" ? "+" : ""}<$0.01`, true);
    }
    if (context === "compact") {
      const compact = abbreviate(value, "$");
      if (compact) return compact;
    }
    const display = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(absolute);
    return result(value, applySign(value, display, sign));
  }

  if (options.type === "percent") {
    if (absolute < 0.01) {
      return result(value, `${value < 0 ? "-" : sign === "always" ? "+" : ""}<0.01%`, true);
    }
    const decimals = absolute >= 1000 ? 0 : absolute >= 100 ? 1 : 2;
    const display = `${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(absolute)}%`;
    return result(value, applySign(value, display, sign));
  }

  if (options.type === "ratio") {
    if (absolute < 0.01) {
      return result(value, `${value < 0 ? "-" : sign === "always" ? "+" : ""}<0.01x`, true);
    }
    const display = `${new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
    }).format(absolute)}x`;
    return result(value, applySign(value, display, sign));
  }

  if (options.type === "token_price") {
    if (absolute < 1 && countLeadingZeros(absolute) >= 3) {
      const formatted = zeroSubscript(value, context === "compact" ? 2 : 4);
      return { ...formatted, display: formatted.display.replace(/^-?/, (match) => `${match}$`) };
    }
    const decimals = absolute >= 1000 ? 2 : absolute >= 100 ? (context === "compact" ? 0 : 2) : absolute >= 1 ? (context === "compact" ? 1 : 3) : context === "compact" ? 3 : 5;
    const display = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(absolute);
    return result(value, applySign(value, display, sign));
  }

  if (absolute < 1 && countLeadingZeros(absolute) >= 3) {
    return zeroSubscript(value, context === "compact" ? 2 : 4);
  }

  if (context === "compact") {
    const compact = abbreviate(value);
    if (compact) return compact;
  }

  const price = options.tokenPriceUsd;
  const fallbackDecimals = context === "compact" ? 4 : 8;
  const threshold = context === "compact" ? 0.01 : 0.0001;
  const maxDecimals = context === "compact" ? 6 : 12;
  const decimals = price && price > 0
    ? Math.min(maxDecimals, Math.max(0, Math.ceil(-Math.log10(threshold / price))))
    : fallbackDecimals;
  const display = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
  }).format(absolute);
  return result(value, applySign(value, display, sign));
}
