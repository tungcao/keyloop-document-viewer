export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  mongoUri:
    process.env.MONGO_URI ?? 'mongodb://localhost:27017/document-viewer',
  salesApiUrl: process.env.SALES_API_URL ?? 'http://localhost:3000/mock/sales',
  serviceApiUrl:
    process.env.SERVICE_API_URL ?? 'http://localhost:3000/mock/service',
  downstreamTimeoutMs: parseInt(
    process.env.DOWNSTREAM_TIMEOUT_MS ?? '3000',
    10,
  ),
  cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS ?? '60', 10),
});
