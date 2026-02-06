import Fastify from 'fastify';

const fastify = Fastify({
    logger: true
});

fastify.get('/', async (request, reply) => {
    return { hello: 'world', service: 'threadline-scraper' };
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
