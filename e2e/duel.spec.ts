/**
 * Uçtan uca 1v1 düello testleri — GERÇEK bir Supabase projesine karşı, iki ayrı
 * browser context (iki ayrı anonim oyuncu) ile koşar.
 *
 * Varsayılan olarak SKIP edilir; CI'da koşmaz (gizli anahtar gerektirir).
 *
 * Çalıştırmak için:
 *   1. Supabase projesinde Authentication > Providers > "Anonymous Sign-ins" açık olmalı.
 *   2. `supabase/migrations/` altındaki tüm migration'lar projeye uygulanmış olmalı
 *      (soru bankası dahil — `supabase db push` ya da SQL Editor).
 *   3. Proje kökünde `.env` dolu olmalı:
 *        VITE_SUPABASE_URL=https://<proje>.supabase.co
 *        VITE_SUPABASE_ANON_KEY=<anon key>
 *   4. Komut (PowerShell):  $env:E2E_SUPABASE='1'; npx playwright test e2e/duel.spec.ts --project=desktop-chromium
 *      Komut (bash):        E2E_SUPABASE=1 npx playwright test e2e/duel.spec.ts --project=desktop-chromium
 *
 * Not: Testler gerçek odalar/maçlar oluşturur; liderlik tablosuna "E2E_" önekli
 * oyuncular düşebilir. Ayrı bir test projesi kullanmanız önerilir.
 */
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

test.skip(!process.env.E2E_SUPABASE, 'E2E_SUPABASE=1 ve .env gerekli');

// Both players share realtime state; running these in parallel against one project is noisy.
test.describe.configure({ mode: 'serial' });

const ROOM_CODE_RE = /^\d{6}$/;

const uniqueName = (prefix: string) => `E2E_${prefix}${Date.now().toString().slice(-6)}`;

interface Player {
  context: BrowserContext;
  page: Page;
  name: string;
}

const openPlayer = async (browser: Browser, prefix: string): Promise<Player> => {
  // browser.newContext() does not inherit the project's `use` options, so pass the
  // device profile and baseURL explicitly — each player gets an isolated context.
  const { baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = test.info().project.use;
  const context = await browser.newContext({ baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });
  const page = await context.newPage();
  const name = uniqueName(prefix);
  await page.goto('/');
  await page.getByPlaceholder('Örn: TeknoPilot_34').fill(name);
  return { context, page, name };
};

const lobbyRoomCode = (page: Page) => page.getByText(ROOM_CODE_RE);

const createRoom = async (host: Player): Promise<string> => {
  await host.page.getByRole('button', { name: 'ODA KUR', exact: true }).click();
  const code = lobbyRoomCode(host.page);
  await expect(code).toBeVisible({ timeout: 20_000 });
  const text = (await code.textContent())?.trim() ?? '';
  expect(text).toMatch(ROOM_CODE_RE);
  return text;
};

const joinRoom = async (guest: Player, code: string) => {
  await guest.page.getByRole('button', { name: 'ODAYA KATIL', exact: true }).click();
  await guest.page.getByLabel('Oda kodu').fill(code);
  await guest.page.getByRole('button', { name: 'KATIL', exact: true }).click();
  await expect(lobbyRoomCode(guest.page)).toHaveText(code, { timeout: 20_000 });
};

const pressReady = async (player: Player) => {
  await player.page.getByRole('button', { name: 'HAZIRIM', exact: true }).click();
  await expect(player.page.getByRole('button', { name: 'HAZIR DEĞİLİM', exact: true })).toBeVisible();
};

/** Answers every question with option "A", waiting out the feedback animation each time. */
const answerAllQuestions = async (page: Page) => {
  const counter = page.getByText(/^SORU \d+ \/ \d+$/);
  // VS countdown has to finish before the first question appears.
  await expect(counter).toBeVisible({ timeout: 30_000 });
  const total = Number((await counter.textContent())?.match(/\/\s*(\d+)/)?.[1]);
  expect(total).toBeGreaterThan(0);

  for (let i = 1; i <= total; i++) {
    await expect(counter).toHaveText(new RegExp(`^SORU ${i} / ${total}$`), { timeout: 15_000 });
    const firstOption = page.locator('button', { has: page.locator('span', { hasText: /^A$/ }) }).first();
    await expect(firstOption).toBeEnabled({ timeout: 15_000 });
    await firstOption.click();
    // Options lock while the answer is checked and the feedback animation plays.
    await expect(firstOption).toBeDisabled();
    if (i < total) {
      await expect(counter).toHaveText(new RegExp(`^SORU ${i + 1} / ${total}$`), { timeout: 15_000 });
    }
  }
};

/** [my score, opponent score] as rendered on the result screen. */
const resultScores = async (page: Page): Promise<[number, number]> => {
  const cells = page.locator('div.text-2xl', { hasText: 'Puan' });
  await expect(cells).toHaveCount(2);
  const [mine, theirs] = await cells.allTextContents();
  return [Number.parseInt(mine, 10), Number.parseInt(theirs, 10)];
};

test('iki oyuncu: oda kur, katıl, hazır, 10 soru, sonuç ve rövanş isteği', async ({ browser }) => {
  test.setTimeout(240_000);
  const a = await openPlayer(browser, 'A');
  const b = await openPlayer(browser, 'B');

  try {
    const code = await createRoom(a);
    await joinRoom(b, code);
    await expect(a.page.getByText(b.name)).toBeVisible({ timeout: 20_000 });

    await pressReady(a);
    await pressReady(b);

    await Promise.all([answerAllQuestions(a.page), answerAllQuestions(b.page)]);

    const mainMenu = 'ANA MENÜYE DÖN';
    await expect(a.page.getByRole('button', { name: mainMenu })).toBeVisible({ timeout: 60_000 });
    await expect(b.page.getByRole('button', { name: mainMenu })).toBeVisible({ timeout: 60_000 });

    // Each side shows "me" on the left, so A's (mine, theirs) must equal B's (theirs, mine).
    await expect
      .poll(
        async () => {
          const [aMine, aTheirs] = await resultScores(a.page);
          const [bMine, bTheirs] = await resultScores(b.page);
          return aMine === bTheirs && aTheirs === bMine;
        },
        { timeout: 20_000 },
      )
      .toBe(true);

    await a.page.getByRole('button', { name: 'RÖVANŞ İSTE' }).click();
    await expect(b.page.getByRole('button', { name: 'RÖVANŞI KABUL ET' })).toBeVisible({ timeout: 20_000 });
  } finally {
    await a.context.close();
    await b.context.close();
  }
});

test('ev sahibi sayfayı yenileyince aynı odada kalır (oturum kaybı regresyonu)', async ({ browser }) => {
  const a = await openPlayer(browser, 'R');
  try {
    const code = await createRoom(a);
    await a.page.reload();
    await expect(lobbyRoomCode(a.page)).toHaveText(code, { timeout: 20_000 });
    await expect(a.page.getByRole('button', { name: 'HAZIRIM', exact: true })).toBeVisible();
    await expect(a.page.getByText(`${a.name} (Sen)`)).toBeVisible();
  } finally {
    await a.context.close();
  }
});

test('misafir lobiden "Ana Menü" ile çıkınca ev sahibinde ikinci oyuncu kartı boşalır', async ({ browser }) => {
  const a = await openPlayer(browser, 'H');
  const b = await openPlayer(browser, 'G');
  try {
    const code = await createRoom(a);
    await joinRoom(b, code);
    await expect(a.page.getByText(b.name)).toBeVisible({ timeout: 20_000 });

    await b.page.getByRole('button', { name: 'Ana Menü' }).click();
    await expect(b.page.getByRole('button', { name: 'ODA KUR', exact: true })).toBeVisible();

    await expect(a.page.getByText('2. Oyuncu Katılımı Bekleniyor...')).toBeVisible({ timeout: 20_000 });
    await expect(a.page.getByText(b.name)).toHaveCount(0);
  } finally {
    await a.context.close();
    await b.context.close();
  }
});
