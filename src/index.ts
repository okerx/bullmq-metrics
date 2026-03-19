import { Config } from './config';
import { getMetrics } from './metrics.ts';
import { health } from './health.ts';

const server = Bun.serve({
  port: Config.PORT,
  hostname: Config.HOST,
  routes: {
    '/': () => new Response('BullMQ Prometheus exporter\n'),
    '/healthz': async () => Response.json(...(await health())),
    '/metrics': async () => {
      try {
        return new Response(await getMetrics());
      } catch (error) {
        console.error('Failed to collect BullMQ metrics.', error);
        return new Response('Failed to collect BullMQ metrics.\n', { status: 500 });
      }
    },
  },
});

console.log(`Listening on ${server.url}`);
