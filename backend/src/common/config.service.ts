import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Thrown when an integration credential is neither in the environment nor in the
 * `system_settings` table. Mapped to HTTP 503 by {@link ServiceUnconfiguredFilter}.
 */
export class ServiceUnconfiguredError extends Error {
  constructor(public readonly key: string) {
    super(`Service credential "${key}" is not configured.`);
    this.name = 'ServiceUnconfiguredError';
  }
}

/** Values the scaffolder injects when a credential has not been supplied yet. */
const PLACEHOLDERS = new Set([
  'PLACEHOLDER_CONFIGURE_IN_SETTINGS',
  'PLACEHOLDER',
  'CHANGE_ME',
  '',
]);

const isUsable = (value: string | null | undefined): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  !PLACEHOLDERS.has(value.trim()) &&
  !value.trim().startsWith('PLACEHOLDER_');

@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Environment variable first, then the admin-managed `system_settings` row.
   * Returns `null` when neither holds a usable value — callers decide whether
   * that is fatal (503) or merely degraded (email delivery reported as failed).
   */
  async resolveConfig(key: string): Promise<string | null> {
    const fromEnv = process.env[key];
    if (isUsable(fromEnv)) {
      return fromEnv.trim();
    }
    try {
      const row = await this.prisma.systemSetting.findUnique({ where: { key } });
      return isUsable(row?.value) ? row!.value.trim() : null;
    } catch (error) {
      this.logger.warn(`Could not read system setting "${key}": ${String(error)}`);
      return null;
    }
  }

  /** Same as {@link resolveConfig} but raises the 503-mapped error when unset. */
  async requireConfig(key: string): Promise<string> {
    const value = await this.resolveConfig(key);
    if (value === null) {
      throw new ServiceUnconfiguredError(key);
    }
    return value;
  }

  async isConfigured(key: string): Promise<boolean> {
    return (await this.resolveConfig(key)) !== null;
  }

  async setConfig(key: string, value: string): Promise<void> {
    await this.prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  /** Plain env read with a default — for non-credential settings. */
  env(key: string, fallback: string): string {
    const value = process.env[key];
    return isUsable(value) ? value.trim() : fallback;
  }
}
