import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { AppConfigService } from '../common/config.service';
import { AdminGuard, SessionGuard } from '../auth/guards';
import { RESEND_API_KEY_ENV } from '../integrations/resend.service';

export class UpdateSettingDto {
  @IsString()
  @MinLength(1, { message: 'Provide a value to save.' })
  key!: string;

  @IsString()
  @MinLength(1, { message: 'Provide a value to save.' })
  value!: string;
}

interface SettingDefinition {
  service: string;
  label: string;
  envKey: string;
  description: string;
}

const DEFINITIONS: SettingDefinition[] = [
  {
    service: 'Resend REST API',
    label: 'Resend API key',
    envKey: RESEND_API_KEY_ENV,
    description:
      'Sends student sign-in links. Until this is set, accounts can still be created but every invitation email fails.',
  },
  {
    service: 'Resend REST API',
    label: 'From address',
    envKey: 'RESEND_FROM',
    description: 'Must belong to a domain verified in your Resend account.',
  },
  {
    service: 'PostgreSQL',
    label: 'PostgreSQL API key',
    envKey: 'POSTGRESQL_API_KEY',
    description: 'Credential for the managed PostgreSQL integration.',
  },
  {
    service: 'PostgreSQL',
    label: 'Database URL',
    envKey: 'DATABASE_URL',
    description: 'Primary datastore connection string. Injected by the platform.',
  },
  {
    service: 'MinIO',
    label: 'MinIO endpoint',
    envKey: 'MINIO_ENDPOINT',
    description: 'Object storage is provisioned but not yet used by any feature.',
  },
  {
    service: 'Application',
    label: 'Public base URL',
    envKey: 'APP_BASE_URL',
    description: 'Used to build the sign-in links emailed to students.',
  },
];

/** Never echo a secret back: show enough to recognise it and nothing more. */
function mask(value: string): string {
  if (value.length <= 8) {
    return `${value.slice(0, 2)}••••`;
  }
  return `${value.slice(0, 4)}••••••••${value.slice(-2)}`;
}

@ApiTags('admin')
@Controller('admin/settings')
@UseGuards(SessionGuard, AdminGuard)
export class SettingsController {
  constructor(private readonly config: AppConfigService) {}

  @Get()
  async list(): Promise<Array<Record<string, unknown>>> {
    return Promise.all(
      DEFINITIONS.map(async (definition) => {
        const value = await this.config.resolveConfig(definition.envKey);
        return {
          id: definition.envKey,
          service: definition.service,
          label: definition.label,
          envKey: definition.envKey,
          maskedValue: value ? mask(value) : null,
          configured: value !== null,
          description: definition.description,
        };
      }),
    );
  }

  @Patch()
  async update(@Body() dto: UpdateSettingDto): Promise<Record<string, unknown>> {
    await this.config.setConfig(dto.key.trim(), dto.value.trim());
    return { ok: true, key: dto.key.trim(), maskedValue: mask(dto.value.trim()) };
  }
}
