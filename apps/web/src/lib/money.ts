export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatBdt(amount: number): string {
  return new Intl.NumberFormat("bn-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPriceRange(
  minUsd: number,
  maxUsd: number,
  minBdt: number,
  maxBdt: number,
): { usd: string; bdt: string } {
  return {
    usd: `${formatUsd(minUsd)} - ${formatUsd(maxUsd)}`,
    bdt: `${formatBdt(minBdt)} - ${formatBdt(maxBdt)}`,
  };
}

export function toBanglaDigits(value: number | string): string {
  const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(value).replace(/[0-9]/g, (digit) => bnDigits[Number(digit)] ?? digit);
}

