import { expect, test } from '@playwright/test';

/** El enlace público /fuegos no deja llegar al resto de la plataforma. */
test('kiosco de Fuegos: sin salidas internas y el resto de rutas devuelve a /fuegos', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/vimeo/i.test(m.text()) && errors.push(m.text()));
  await page.goto('/fuegos?utm_source=qa');
  await expect(page.locator('.big-play, .dev-notice').first()).toBeVisible();
  const hrefs = await page.locator('a[href]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  const internal = hrefs.filter((h) => new URL(h).origin === new URL(page.url()).origin && !new URL(h).pathname.startsWith('/fuegos'));
  expect(internal, internal.join('\n')).toEqual([]);
  expect(hrefs.some((h) => h.startsWith('https://irbximena.com/pg/fam2027/org/?utm_source=qa'))).toBe(true);
  await expect(page.locator('.sidebar, .mnav, [aria-label="Buscar"]')).toHaveCount(0);
  for (const p of ['/', '/cursos', '/cursos/respiracion-consciente/bienvenida', '/practicas/fuegos', '/perfil', '/entrar', '/_design']) {
    await page.goto(p);
    expect(new URL(page.url()).pathname, p).toBe('/fuegos');
  }
  expect(errors).toEqual([]);
});
