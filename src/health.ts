import { redis } from 'bun';

export const health = async (): Promise<[{ status: string }, ResponseInit]> => {
  try {
    const ping = await redis.ping();
    if (ping === 'PONG') {
      return [{ status: 'ok' }, { status: 200 }];
    }
    return [{ status: 'Redis is not available' }, { status: 503 }];
  } catch (error) {
    console.error('Failed to ping Redis', error);
    return [{ status: 'Redis is not available' }, { status: 503 }];
  }
};
