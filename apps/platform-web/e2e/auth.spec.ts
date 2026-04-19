import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {

  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*login/);
  });

  test('login page renders without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/login');

    await expect(page.getByRole('button', { name: /sign in/i }))
      .toBeVisible({ timeout: 10_000 });

    expect(errors).toHaveLength(0);
  });

  test('login button triggers MSAL redirect', async ({ page }) => {
    await page.goto('/login');

    const navigationPromise = page.waitForURL(
      /login\.microsoftonline\.com|ciamlogin\.com/,
      { timeout: 10_000 }
    );

    await page.getByRole('button', { name: /sign in/i }).click();
    await navigationPromise;

    expect(page.url()).toMatch(/microsoftonline\.com|ciamlogin\.com/);
  });

  test('MSAL provider does not throw on page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const msalErrors = errors.filter(
      (e) =>
        e.toLowerCase().includes('msal') ||
        e.toLowerCase().includes('publicclientapplication')
    );
    expect(msalErrors).toHaveLength(0);
  });
});
