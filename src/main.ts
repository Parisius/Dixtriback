import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

const SWAGGER_CUSTOM_CSS = `
  .topbar { background-color: #1E2761 !important; }
  .topbar .download-url-wrapper { display: none; }
  .swagger-ui .info .title { color: #1E2761; }
  .swagger-ui .opblock-tag { color: #1E2761; }
  .swagger-ui .btn.authorize { background-color: #E8734A; border-color: #E8734A; color: #fff; }
  .swagger-ui .btn.authorize svg { fill: #fff; }
  .swagger-ui .opblock.opblock-post { border-color: #2E8B57; background: rgba(46,139,87,0.05); }
  .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #2E8B57; }
  .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #1C7293; }
  .swagger-ui .opblock.opblock-put .opblock-summary-method { background: #E8734A; }
`;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  (app as any).set('trust proxy', config.get<string>('trustProxy'));

  // Browser access: any localhost / 127.0.0.1 port, plus the configured origins.
  const allowedOrigins = new Set(config.get<string[]>('corsOrigins')!);
  const localhostOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  app.enableCors({
    origin: (origin, callback) => {
      // No Origin header = not a browser (curl, server-to-server, mobile app).
      if (!origin || allowedOrigins.has(origin) || localhostOrigin.test(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  });

  // whitelist: false is the load-bearing setting for the "extra fields
  // allowed" requirement — known DTO fields are still validated/transformed,
  // but anything else in the body is neither rejected nor stripped, and
  // survives to reach each schema's `strict: false` Mongoose model.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const apiPrefix = config.get<string>('apiPrefix')!;
  app.setGlobalPrefix(apiPrefix);

  const swaggerDoc = new DocumentBuilder()
    .setTitle('API — Plateforme de Commerce Multi-Entreprises')
    .setDescription(
      'Phase 1 (Tableau de Bord Admin) : Comptes & Entreprise, Approvisionnement & Entrepôts, ' +
        'Boutiques & POS, CRM & Segmentation, Reporting.\n\n' +
        '**Extensibilité des schémas** : tous les endpoints POST/PUT/PATCH acceptent des champs ' +
        "additionnels au-delà de ceux documentés — MongoDB étant sans schéma rigide (`strict: false` " +
        'sur chaque modèle Mongoose), un DTO NestJS valide les champs connus tandis que les champs ' +
        'inconnus sont conservés tels quels sur le document.\n\n' +
        '**Authentification** : JWT (access + refresh token), header `Authorization: Bearer <token>`.',
    )
    .setVersion('0.1.0 — Phase 1')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .addTag('Auth', 'Authentification JWT (login, register, refresh, OTP)')
    .addTag('Users', 'Comptes utilisateurs, tous rôles confondus')
    .addTag('Company', 'Entreprise (tenant)')
    .addTag('Procurement', 'Fournisseurs, bons de commande, expéditions & sérialisation')
    .addTag('Warehouse', 'Entrepôts National/Import et Régionaux, transferts de stock')
    .addTag('Inventory', 'Unités individuellement sérialisées & traçabilité')
    .addTag('Catalog', 'Produits')
    .addTag('Region', 'Régions de chaque entreprise (référencées par regionId)')
    .addTag('Logs', "Journal d'activité par entreprise (admin) et global (super admin)")
    .addTag('Store', 'Boutiques physiques/virtuelles')
    .addTag('Store & POS', 'Ventes, retours, encaissement')
    .addTag('CRM', 'Fiches client & segmentation')
    .addTag('Reporting', 'Ventes, marges, stocks')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerDoc);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'API — Plateforme de Commerce Multi-Entreprises',
    customCss: SWAGGER_CUSTOM_CSS,
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      tagsSorter: 'alpha',
      filter: true,
    },
  });

  const port = config.get<number>('port')!;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API running on http://localhost:${port}/${apiPrefix}`);
  // eslint-disable-next-line no-console
  console.log(`Swagger docs on http://localhost:${port}/docs`);
}
bootstrap();
