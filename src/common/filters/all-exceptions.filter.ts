import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Normalizes every error response to { statusCode, message, error } so the
 * shape matches the ErrorResponse schema documented in Swagger.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // A malformed id (e.g. GET /stores/not-an-id) makes Mongoose throw a CastError:
    // that is the caller's mistake, not a server failure.
    const isCastError = (exception as any)?.name === 'CastError';
    if (isCastError) {
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Identifiant ou valeur invalide.',
        error: 'BadRequestException',
      });
      return;
    }

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload = isHttp ? exception.getResponse() : null;
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? (payload as any).message
        : isHttp
          ? exception.message
          : 'Erreur interne du serveur';

    if (!isHttp) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: isHttp ? exception.name : 'InternalServerError',
    });
  }
}
