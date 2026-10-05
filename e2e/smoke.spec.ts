import { expect, test, type Page } from '@playwright/test';

/**
 * Smoke tests that need NO Supabase backend. They run on every CI push.
 * Anything that talks to the database lives in duel.spec.ts.
 */

const nameInput = (page: Page) => page.getByPlaceholder('Örn: TeknoPilot_34');

test.describe('Ana ekran', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('başlık ve tüm ana butonlar görünür', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'TEKNOFEST BİLGİ YARIŞMASI' })).toBeVisible();
    for (const label of ['HIZLI EŞLEŞ', 'ODA KUR', 'ODAYA KATIL', 'TURNUVA', 'LİDERLİK']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    await expect(nameInput(page)).toBeVisible();
  });

  test('isim boşken ODA KUR uyarı verir', async ({ page }) => {
    await nameInput(page).fill('');
    await page.getByRole('button', { name: 'ODA KUR', exact: true }).click();
    await expect(page.getByText('Lütfen takma adınızı girin!')).toBeVisible();
  });

  test('isim boşken HIZLI EŞLEŞ uyarı verir', async ({ page }) => {
    await nameInput(page).fill('   ');
    await page.getByRole('button', { name: 'HIZLI EŞLEŞ', exact: true }).click();
    await expect(page.getByText('Lütfen takma adınızı girin!')).toBeVisible();
  });

  test('ODAYA KATIL penceresinde kod alanı yalnızca rakam alır ve 6 haneyle sınırlıdır', async ({ page }) => {
    await page.getByRole('button', { name: 'ODAYA KATIL', exact: true }).click();
    const code = page.getByLabel('Oda kodu');
    await expect(code).toBeVisible();

    await code.pressSequentially('12ab-3x4567');
    await expect(code).toHaveValue('123456');

    // Pasting non-digits strips them; pasting a longer code is cut to 6 digits.
    await code.fill('ab-12');
    await expect(code).toHaveValue('12');
    await code.fill('987654321');
    await expect(code).toHaveValue('987654');
  });

  test('.env yokken oda kurmak "yapılandırılmamış" mesajı gösterir', async ({ page }) => {
    test.skip(Boolean(process.env.VITE_SUPABASE_URL), 'Supabase yapılandırılmış; bu test yalnızca .env yokken koşar');
    await nameInput(page).fill('SmokeTester');
    await page.getByRole('button', { name: 'ODA KUR', exact: true }).click();
    await expect(page.getByText(/yapılandırılmamış/)).toBeVisible();
  });

  test('manifest linki var ve sayfa yatay taşma yapmıyor', async ({ page }) => {
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
    const manifest = await page.request.get('/manifest.webmanifest');
    expect(manifest.ok()).toBeTruthy();

    await expect(page.getByRole('button', { name: 'ODA KUR', exact: true })).toBeVisible();
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  });
});

test('?room=654321 ile açılınca katılma penceresi kod dolu açılır', async ({ page }) => {
  await page.goto('/?room=654321');
  await expect(page.getByLabel('Oda kodu')).toHaveValue('654321');
});

test('#/leaderboard stant modu ekranını açar', async ({ page }) => {
  await page.goto('/#/leaderboard');
  await expect(page.getByRole('heading', { name: /Liderlik Tablosu/i })).toBeVisible();
  await expect(page.getByTestId('stand-join-info')).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Dönem' })).toBeVisible();
});

test('#/admin yönetici ekranını açar', async ({ page }) => {
  await page.goto('/#/admin');
  if (process.env.VITE_SUPABASE_URL) {
    const form = page.getByRole('form', { name: 'Yönetici girişi' });
    await expect(form).toBeVisible();
    await expect(form.locator('input[type="email"]')).toBeVisible();
    await expect(form.locator('input[type="password"]')).toBeVisible();
  } else {
    // Without Supabase the panel cannot log anyone in and says so instead of showing the form.
    await expect(page.getByRole('alert')).toContainText('Yönetici paneli için Supabase bağlantısı gerekli');
  }
});
