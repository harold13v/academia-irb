import { expect, test } from '@playwright/test';

/**
 * Falla si alguna ruta emite un error de consola, una excepción no capturada, un ChunkLoadError
 * o una respuesta 4xx/5xx de /_next/static (p. ej. chunks de route groups con %28app%29).
 * Sesión: IRB_SESSION=<jwt de una alumna de prueba> (sin ella, las rutas privadas redirigen a /entrar).
 */
// rutas de los datos de demo; en staging se sobreescriben con E2E_ROUTES="/,/cursos/<slug>,..." (separadas por coma)
const ROUTES = process.env.E2E_ROUTES?.split(',') ?? ['/', '/cursos', '/cursos/respiracion-consciente', '/cursos/respiracion-consciente/bienvenida', '/practicas/fuegos', '/perfil', '/circulos', '/ayuda', '/entrar', '/_design'];

test.beforeEach(async ({ context, baseURL }) => {
  const jwt = process.env.IRB_SESSION;
  if (jwt) await context.addCookies([{ name: 'irb_session', value: jwt, url: baseURL! }]);
});

for (const path of ROUTES) {
  test(`sin errores de consola: ${path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.name}: ${e.message}`));
    page.on('response', (r) => r.url().includes('/_next/static/') && r.status() >= 400 && errors.push(`static ${r.status()}: ${r.url()}`));
    await page.goto(path, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    await expect(page.getByText('Algo no cargó bien')).toHaveCount(0);
    expect(errors.filter((e) => !/vimeo|soundcloud|ERR_BLOCKED_BY_CLIENT/i.test(e) || /ChunkLoadError/.test(e)), errors.join('\n')).toEqual([]);
  });
}
