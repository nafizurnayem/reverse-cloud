export const bookingCountryCodes = [
  { code: "+880", country: "BD", label: "Bangladesh" },
  { code: "+1", country: "US", label: "United States / Canada" },
  { code: "+44", country: "GB", label: "United Kingdom" },
  { code: "+91", country: "IN", label: "India" },
  { code: "+971", country: "AE", label: "United Arab Emirates" },
  { code: "+966", country: "SA", label: "Saudi Arabia" },
  { code: "+65", country: "SG", label: "Singapore" },
  { code: "+61", country: "AU", label: "Australia" },
] as const;

const e164Pattern = /^\+[1-9]\d{7,14}$/;

export function normalizePhoneNumber(countryCode: string, value: string) {
  const clean = value.trim();
  if (!clean) return null;

  const international = clean.startsWith("+")
    ? `+${clean.slice(1).replace(/\D/g, "")}`
    : `${countryCode}${clean.replace(/\D/g, "").replace(/^0+/, "")}`;

  if (!e164Pattern.test(international)) return null;
  if (international.startsWith("+880") && !/^\+8801[3-9]\d{8}$/.test(international)) {
    return null;
  }
  return international;
}
