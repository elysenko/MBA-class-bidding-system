import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ServiceUnconfiguredError } from './config.service';

/** Unconfigured integrations surface as 503, never as an opaque 500. */
@Catch(ServiceUnconfiguredError)
export class ServiceUnconfiguredFilter implements ExceptionFilter {
  private readonly logger = new Logger('ServiceUnconfigured');

  catch(exception: ServiceUnconfiguredError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    this.logger.warn(exception.message);
    response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: 'Service Unavailable',
      message: `This feature needs credentials for "${exception.key}". An administrator can add them under Settings.`,
      key: exception.key,
    });
  }
}
