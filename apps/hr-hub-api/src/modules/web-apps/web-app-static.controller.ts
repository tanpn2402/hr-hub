import { Controller, Get, NotFoundException, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { join } from 'node:path';
import { TraceContextService } from '../app/trace/trace-context.service';
import { TraceLogger } from '../app/trace/trace-logger.service';
import { SLUG_PATTERN, WebAppsConfig } from './web-apps.config';

/**
 * Serves the published version of a web app (WEBAPPS_ROOT/:slug/current) at /apps/:slug/*, which nginx exposes
 * as /hr-hub/api/apps/:slug/*. The iframe in the SPA viewer (/hr-hub/apps/:slug) loads from here; iframes can't
 * send a Bearer token, so the files are public static content. Authorization applies to the data API.
 */
@Controller('apps')
export class WebAppStaticController {
  private readonly logger: TraceLogger;

  constructor(
    private readonly config: WebAppsConfig,
    traceContext: TraceContextService,
  ) {
    this.logger = new TraceLogger(traceContext, WebAppStaticController.name);
  }

  @Get(':slug')
  redirect(@Param('slug') slug: string, @Req() request: Request, @Res() response: Response) {
    this.assertValid(slug);
    // Express treats "/apps/x/" as ":slug" too (non-strict routing): serve the index instead of redirecting forever.
    if (request.path.endsWith('/')) return this.serve(slug, '', response);

    // Relative redirect keeps whatever prefix the reverse proxy added.
    const query = request.url.includes('?') ? request.url.slice(request.url.indexOf('?')) : '';
    response.redirect(301, `${slug}/${query}`);
  }

  @Get(':slug/*')
  serve(@Param('slug') slug: string, @Param('0') rest: string, @Res() response: Response) {
    this.assertValid(slug);

    response.set({
      'Content-Security-Policy': "sandbox allow-scripts allow-forms allow-modals allow-downloads allow-popups; frame-ancestors 'self'",
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });

    const root = join(this.config.root, slug, 'current');
    const target = rest && !rest.endsWith('/') ? rest : `${rest}index.html`;

    this.logger.log(`Serving web app "${slug}" file "${target}" from dir ${root}`);

    // sendFile rejects dotfiles and path traversal; `root` pins it to the published version.
    response.sendFile(target, { root, dotfiles: 'deny' }, (error) => {
      if (error) this.logger.warn(`Web app "${slug}" file "${target}" not served from ${root}: ${error.message}`);
      if (error && !response.headersSent) response.status(404).json({ message: 'Not found', statusCode: 404 });
    });
  }

  private assertValid(slug: string) {
    if (!SLUG_PATTERN.test(slug)) throw new NotFoundException();
  }
}
