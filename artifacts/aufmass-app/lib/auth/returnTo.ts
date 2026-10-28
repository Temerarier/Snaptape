export function safeReturnTo(value?: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/app";
  if (/^\/(login|register|sign-in|sign-up)(\/|\?|$)/.test(value)) return "/app";
  return value;
}
