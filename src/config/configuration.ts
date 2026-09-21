const DEFAULT_CORS_ORIGINS = 'https://dixtriv2-one.vercel.app';

export default () => {
  const config = buildConfig();
  if (config.nodeEnv === 'production') {
    const unsafe = [
      config.jwt.accessSecret === 'dev-access-secret' && 'JWT_ACCESS_SECRET',
      config.jwt.refreshSecret === 'dev-refresh-secret' && 'JWT_REFRESH_SECRET',
    ].filter(Boolean);
    if (unsafe.length) {
      throw new Error(`Refusing to start in production with default secrets: ${unsafe.join(', ')}`);
    }
  }
  return config;
};

const buildConfig = () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'v1',
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri:
    process.env.MONGODB_URI || 'mongodb://localhost:27017/multicompany_commerce',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  // Which proxies to trust for the client IP in audit logs (Express `trust proxy` syntax).
  trustProxy: process.env.TRUST_PROXY || 'loopback,linklocal,uniquelocal',
  // Extra allowed browser origins (comma-separated). localhost on any port is always allowed.
  corsOrigins: (process.env.CORS_ORIGINS || DEFAULT_CORS_ORIGINS)
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for 587 (STARTTLS)
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Dixtri <no-reply@dixtri.com>',
  },
  otp: {
    ttlSeconds: parseInt(process.env.OTP_CODE_TTL_SECONDS || '300', 10),
    devStaticCode: process.env.OTP_DEV_STATIC_CODE || '123456',
  },
});
