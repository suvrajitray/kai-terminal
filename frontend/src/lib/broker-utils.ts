export function putDefaultFirst<T extends { id: string }>(items: T[], defaultId: string | null): T[] {
  if (!defaultId) return items;
  return [...items].sort((a) => (a.id === defaultId ? -1 : 1));
}

export function resolveDefaultBroker(savedDefault: string | null, connectedBrokerIds: string[]): string | null {
  if (savedDefault && connectedBrokerIds.includes(savedDefault)) return savedDefault;
  return connectedBrokerIds[0] ?? null;
}
