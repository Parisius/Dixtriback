import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as not requiring a JWT. Used on /auth/login, /auth/register,
 * /auth/otp/*, and any other endpoint that must work before login.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
