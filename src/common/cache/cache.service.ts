import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client!: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.client = new Redis(this.config.get<string>('redisUrl')!, {
      lazyConnect: true,
      enableReadyCheck: false,
      maxRetriesPerRequest: 1,
    });

    this.client.on('error', (err: Error) =>
      this.logger.error({ err }, 'Redis connection error'),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.error({ err, key }, 'Cache GET failed — treating as miss');
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.error({ err, key }, 'Cache SET failed — continuing without cache');
    }
  }
}
