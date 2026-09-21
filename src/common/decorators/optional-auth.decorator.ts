import { SetMetadata } from '@nestjs/common';

export const OPTIONAL_AUTH_KEY = 'optionalAuth';

/**
 * Login is optional on this route. No Authorization header = anonymous
 * (request.user is null). A header that is present must be a valid token,
 * otherwise the request is rejected with 401.
 */
export const OptionalAuth = () => SetMetadata(OPTIONAL_AUTH_KEY, true);
