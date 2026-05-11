import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, username = 'e2e-user') {
  await page.goto('/sign-in');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill('password123');
  await page.getByLabel('Tenant').selectOption('tenant-a');
  await page.getByTestId('sign-in-button').click();
  await expect(page).toHaveURL(/\/$/);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/sign-in');
  await page.evaluate(() => localStorage.clear());
});

test('add to cart updates cart badge', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Add to Cart' }).first().click();
  await expect(page.locator('.cart-count')).toHaveText('1');
});

test('search filters products', async ({ page }) => {
  await signIn(page);
  await page.getByPlaceholder('Search products...').fill('Kindle');
  await expect(page.getByText('Kindle Paperwhite')).toBeVisible();
  await expect(page.getByText('Echo Dot (5th Gen)')).not.toBeVisible();
});

test('cart persists after reload for signed-in user', async ({ page }) => {
  await signIn(page, 'persist-user');
  await page.getByRole('button', { name: 'Add to Cart' }).first().click();
  await expect(page.locator('.cart-count')).toHaveText('1');

  await page.reload();
  await expect(page.locator('.cart-count')).toHaveText('1');
});
