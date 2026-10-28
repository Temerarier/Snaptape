export function nutzerName(user: { email: string | null; firstName?: string | null; lastName?: string | null; replitUserId?: string | null; id: string }): string {
  return user.email || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.replitUserId || user.id;
}
