import { test, expect } from '@playwright/test';

test.describe('Public Navigation', () => {

  test('homepage loads with correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/AfriXplore/i);
  });

  test('all public pages return non-error status', async ({ page }) => {
    const publicPages = ['/', '/login'];

    for (const path of publicPages) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should not return 5xx`).toBeLessThan(500);
    }
  });

  test('404 page renders for unknown routes', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-xyz-abc');
    expect(response?.status()).toBe(404);
  });

  test('security headers present on homepage', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() ?? {};

    // Next.js + Helmet should set these
    expect(headers['x-frame-options'] ?? headers['content-security-policy']).toBeTruthy();
    expect(headers['x-content-type-options']).toBe('nosniff');
  });
});
