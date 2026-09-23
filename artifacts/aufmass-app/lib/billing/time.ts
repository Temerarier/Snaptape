const DAY_MS = 86_400_000;

export function utcDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function completedUtcDays(now: Date, count = 7): string[] {
  const today = Date.parse(`${utcDay(now)}T00:00:00.000Z`);
  return Array.from({ length: count }, (_, index) =>
    new Date(today - (count - index) * DAY_MS).toISOString().slice(0, 10),
  );
}

export function nextUtcDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function assertUtcDay(day: string): void {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    utcDay(new Date(`${day}T00:00:00Z`)) !== day
  ) {
    throw new Error(`Invalid UTC day: ${day}`);
  }
}
