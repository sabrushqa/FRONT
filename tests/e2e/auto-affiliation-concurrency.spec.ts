import { expect, test, type Browser } from '@playwright/test';
import { RegisterPage } from './support/register-page';

// Test de concurrence limité et volontairement prudent : 3 dossiers PP/TPE
// soumis EN MÊME TEMPS (3 contextes de navigateur distincts, Promise.all),
// pour vérifier que demo + doc-classifier encaissent quelques requêtes
// simultanées sans planter — pas un test de charge/perf (doc-classifier
// tourne en CPU, non batché ; le reste de la suite est volontairement
// séquentiel, cf. playwright.config.ts). L'objectif ici est uniquement de
// vérifier l'absence de plantage/écrasement de données sous un minimum de
// parallélisme réaliste (plusieurs prospects qui remplissent le formulaire
// au même moment), pas de mesurer un débit.
async function submitOneDossier(browser: Browser, label: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const registerPage = new RegisterPage(page);
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}${label}`;

  await registerPage.goto();
  await registerPage.completeFullFlow({
    commercantType: 'PP',
    affiliationType: 'TPE',
    suffix,
    email: `e2e.concurrency.${label}.${suffix}@lanacash-test.ma`,
    telephone: '0612345678'
  });

  await expect(registerPage.ribFieldValue()).not.toHaveValue('', { timeout: 30_000 });
  await registerPage.acceptTermsAndSubmit();
  await expect(registerPage.successMessage()).toContainText(/Dossier #\d+ créé/, { timeout: 30_000 });

  const successText = await registerPage.successMessage().textContent();
  await context.close();
  return successText;
}

test('3 prospects soumettent un dossier en même temps sans collision ni plantage', async ({ browser }) => {
  const results = await Promise.all([
    submitOneDossier(browser, 'a'),
    submitOneDossier(browser, 'b'),
    submitOneDossier(browser, 'c')
  ]);

  // Chaque soumission doit avoir réussi ET avoir reçu un numéro de dossier
  // DIFFÉRENT (preuve qu'il n'y a pas eu d'écrasement/collision côté demo
  // malgré la concurrence).
  const dossierIds = results.map((text) => text?.match(/Dossier #(\d+)/)?.[1]);
  expect(dossierIds).toHaveLength(3);
  expect(dossierIds.every(Boolean)).toBe(true);
  expect(new Set(dossierIds).size).toBe(3);
});
