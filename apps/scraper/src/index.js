import Fastify from 'fastify';
import {
  getSessionsStatus,
  startPlatformLogin,
  deleteSession,
} from './auth.js';

const fastify = Fastify({
  logger: true,
});

fastify.get('/', async () => {
  return { hello: 'world', service: 'threadline-scraper' };
});

// Auth: list session status per platform
fastify.get('/auth/sessions', async () => {
  const sessions = getSessionsStatus();
  return { platforms: sessions };
});

// Auth: start login flow for a platform (opens browser, waits for login, saves session)
fastify.post('/auth/:platform/start', async (request, reply) => {
  const { platform } = request.params;
  try {
    const result = await startPlatformLogin(platform);
    return result;
  } catch (err) {
    fastify.log.error(err);
    reply.code(500);
    return { ok: false, message: err.message || 'Login failed.' };
  }
});

// Auth: logout (delete stored session)
fastify.post('/auth/:platform/logout', async (request, reply) => {
  const { platform } = request.params;
  const deleted = deleteSession(platform);
  return { ok: true, loggedOut: deleted };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '127.0.0.1' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
