/** Emits the site-id matrix consumed by GitHub Actions deploy workflow. */
import { sites } from '../sites/registry.mjs';

process.stdout.write(JSON.stringify(sites.map((site) => site.id)));
