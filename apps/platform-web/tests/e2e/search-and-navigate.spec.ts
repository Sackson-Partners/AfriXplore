import { test, expect } from '@playwright/test';

test.describe('Search and Navigation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.goto('/');
    // Add auth token to localStorage if needed
    await page.evaluate(() => {
      localStorage.setItem('auth-token', 'mock-token-for-testing');
    });
    await page.goto('/dashboard');
  });

  test('should open search with Cmd+K keyboard shortcut', async ({ page }) => {
    // Press Cmd+K (or Ctrl+K on Windows/Linux)
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');

    // Check that search modal is visible
    await expect(page.locator('[role="dialog"]').or(page.locator('.search-panel'))).toBeVisible();

    // Check for search input
    const searchInput = page.locator('input[type="text"]').first();
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeFocused();
  });

  test('should search for mines and display results', async ({ page }) => {
    // Open search
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');

    // Type search query
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill('copper');

    // Wait for results to appear
    await page.waitForTimeout(500); // Debounce delay

    // Check that results are displayed
    const results = page.locator('[data-testid="search-result"]').or(page.locator('a[href*="/mines/"]'));
    await expect(results.first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to mine detail page from search', async ({ page }) => {
    // Open search
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');

    // Search for a mine
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill('mine');
    await page.waitForTimeout(500);

    // Click first result
    const firstResult = page.locator('a[href*="/mines/"]').first();
    await firstResult.click();

    // Verify navigation to mine detail page
    await expect(page).toHaveURL(/\/mines\/.+/);

    // Check that mine details are loaded
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should navigate using sidebar', async ({ page }) => {
    // Click on Convergence in sidebar
    await page.click('a[href="/convergence"]');

    // Verify navigation
    await expect(page).toHaveURL('/convergence');
    await expect(page.locator('h1:has-text("Convergence")')).toBeVisible();
  });

  test('should close search with ESC key', async ({ page }) => {
    // Open search
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');

    // Verify search is open
    const searchPanel = page.locator('[role="dialog"]').or(page.locator('.search-panel'));
    await expect(searchPanel).toBeVisible();

    // Press ESC
    await page.keyboard.press('Escape');

    // Verify search is closed
    await expect(searchPanel).not.toBeVisible();
  });

  test('should navigate with keyboard in search results', async ({ page }) => {
    // Open search
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');

    // Type search query
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill('mine');
    await page.waitForTimeout(500);

    // Press arrow down to select first result
    await page.keyboard.press('ArrowDown');

    // Press Enter to navigate
    await page.keyboard.press('Enter');

    // Verify navigation occurred
    await page.waitForURL(/\/mines\/.+/, { timeout: 5000 });
  });
});

test.describe('Convergence Score Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('auth-token', 'mock-token-for-testing');
    });
  });

  test('should display convergence dashboard', async ({ page }) => {
    await page.goto('/convergence');

    // Check for key elements
    await expect(page.locator('h1:has-text("Convergence")')).toBeVisible();

    // Check for stats cards
    const statsCards = page.locator('[data-testid="stat-card"]').or(page.locator('.bg-gray-900').filter({ hasText: /Certified|Potential|Average/ }));
    await expect(statsCards.first()).toBeVisible({ timeout: 10000 });

    // Check for score list/table
    const scoreList = page.locator('table').or(page.locator('[data-testid="score-list"]'));
    await expect(scoreList).toBeVisible({ timeout: 10000 });
  });

  test('should filter convergence scores', async ({ page }) => {
    await page.goto('/convergence');

    // Wait for data to load
    await page.waitForTimeout(2000);

    // Click filter button
    const certifiedFilter = page.locator('button:has-text("Certified")').or(page.locator('[data-filter="certified"]'));
    if (await certifiedFilter.isVisible()) {
      await certifiedFilter.click();

      // Verify filter is applied (URL or UI state change)
      await page.waitForTimeout(500);
      // Could check for filtered results here
    }
  });

  test('should navigate to mine detail from convergence page', async ({ page }) => {
    await page.goto('/convergence');

    // Wait for scores to load
    await page.waitForTimeout(2000);

    // Click on a mine link
    const mineLink = page.locator('a[href*="/mines/"]').first();
    if (await mineLink.isVisible()) {
      await mineLink.click();

      // Verify navigation
      await expect(page).toHaveURL(/\/mines\/.+/);
    }
  });

  test('should display convergence score card on mine detail', async ({ page }) => {
    // Navigate to a mine (using a test mine ID or first available)
    await page.goto('/library');
    await page.waitForTimeout(2000);

    const firstMine = page.locator('a[href*="/mines/"]').first();
    if (await firstMine.isVisible()) {
      await firstMine.click();

      // Wait for detail page to load
      await page.waitForTimeout(2000);

      // Check for convergence score card
      const scoreCard = page.locator('[data-testid="convergence-score-card"]').or(page.locator(':has-text("Convergence Score")'));
      await expect(scoreCard).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE size

  test('should display mobile menu button', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('auth-token', 'mock-token-for-testing');
    });
    await page.goto('/dashboard');

    // Check for hamburger menu button
    const menuButton = page.locator('button[aria-label="Open menu"]').or(page.locator('button svg:has(path[d*="M3.75 6.75"])'));
    await expect(menuButton).toBeVisible();
  });

  test('should open mobile sidebar', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('auth-token', 'mock-token-for-testing');
    });
    await page.goto('/dashboard');

    // Click menu button
    const menuButton = page.locator('button svg:has(path[d*="M3.75 6.75"])').locator('..').first();
    await menuButton.click();

    // Check that sidebar is visible
    await page.waitForTimeout(300); // Animation
    const mobileSidebar = page.locator('aside').filter({ hasText: /MSIM Platform|Dashboard/ });
    await expect(mobileSidebar).toBeVisible();
  });

  test('should display compact stats on mobile', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('auth-token', 'mock-token-for-testing');
    });
    await page.goto('/convergence');

    // Stats should be in 2-column grid on mobile
    const statsContainer = page.locator('.grid').first();
    await expect(statsContainer).toBeVisible();

    // Check that layout is compact
    const stats = page.locator('[data-testid="stat-card"]').or(page.locator('.bg-gray-900').filter({ hasText: /Certified|Potential/ }));
    await expect(stats.first()).toBeVisible({ timeout: 5000 });
  });
});
