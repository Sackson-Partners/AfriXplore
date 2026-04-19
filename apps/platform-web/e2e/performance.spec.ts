import { test, expect } from '@playwright/test';

test.describe('Performance Baseline', () => {

  test('homepage loads under 4s on simulated 3G (Africa baseline)', async ({ page }) => {
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (1.5 * 1024 * 1024) / 8, // 1.5 Mbps
      uploadThroughput: (750 * 1024) / 8,            // 750 Kbps
      latency: 150,                                   // 150ms — typical African latency
    });

    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    expect(loadTime, `Page load took ${loadTime}ms — should be under 4000ms`).toBeLessThan(4000);
  });

  test('no images missing alt text', async ({ page }) => {
    await page.goto('/');

    const imagesWithoutAlt = await page.$$eval('img:not([alt])', (imgs) =>
      imgs.map((img) => (img as HTMLImageElement).src)
    );

    expect(
      imagesWithoutAlt,
      `Images missing alt: ${imagesWithoutAlt.join(', ')}`
    ).toHaveLength(0);
  });
});
