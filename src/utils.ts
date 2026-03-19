export const extractQueueNameFromRedisKey = (key: string): string | null => {
  const parts = key.split(':');

  if (parts.length < 3 || parts.at(-1) !== 'id') {
    return null;
  }

  return parts.at(-2) ?? null;
};
