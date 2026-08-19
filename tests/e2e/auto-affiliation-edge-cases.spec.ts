import { expect, test } from '@playwright/test';
import { RegisterPage, SAMPLES, commercantProfile } from './support/register-page';

// Cas limites et négatifs du parcours "devenir client" (/register) —
// complète auto-affiliation-document-upload.spec.ts (chemin heureux, 20
// combinaisons commerçant x affiliation) avec les comportements attendus
// en cas d'erreur/limite. Aucun mock, sauf mention explicite (cas C1, qui
// simule un incident réseau ponctuel côté front sans jamais toucher au
// vrai backend/doc-classifier).
test.describe('Auto-affiliation — cas limites et négatifs', () => {
  test('A1 — mauvais type de document détecté (déterministe) mais soumission non bloquée', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await registerPage.goto();

    await registerPage.fillStep1({ commercantType: 'PP', affiliationType: 'TPE', telephone: '0612345678' });
    await registerPage.continuerButton().click();
    await registerPage.fillStep2({
      commercantType: 'PP',
      affiliationType: 'TPE',
      suffix,
      email: `e2e.a1.${suffix}@lanacash-test.ma`,
      telephone: '0612345678'
    });
    await registerPage.continuerButton().click();

    // On importe volontairement le RIB à la place de la CIN — doc-classifier
    // classe l'image réelle (RIB), ça ne correspond pas au type attendu (CIN).
    await registerPage.uploadDocuments([
      { key: 'cinDocument', file: SAMPLES.rib },
      { key: 'ribDocument', file: SAMPLES.rib }
    ]);

    await expect(registerPage.documentStatus('cinDocument')).toHaveText('À vérifier', { timeout: 20_000 });
    await expect(registerPage.documentCard('cinDocument').locator('.doc-validation-note')).toContainText('CIN');

    // Comportement réel de l'appli : un document "À vérifier" reste attaché
    // et ne bloque PAS la soumission (choix produit assumé — l'utilisateur
    // est averti, la revue finale reste humaine côté back office).
    await expect(registerPage.ribFieldValue()).not.toHaveValue('', { timeout: 20_000 });
    await registerPage.acceptTermsAndSubmit();
    await expect(registerPage.successMessage()).toContainText(/Dossier #\d+ créé/, { timeout: 15_000 });
  });

  test("A2 — RIB dont l'OCR ne trouve rien : champ déverrouillé pour saisie manuelle", async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await registerPage.goto();

    await registerPage.fillStep1({ commercantType: 'PP', affiliationType: 'TPE', telephone: '0612345678' });
    await registerPage.continuerButton().click();
    await registerPage.fillStep2({
      commercantType: 'PP',
      affiliationType: 'TPE',
      suffix,
      email: `e2e.a2.${suffix}@lanacash-test.ma`,
      telephone: '0612345678'
    });
    await registerPage.continuerButton().click();

    // Une CIN à la place du RIB : classification correcte (détecte "CIN"),
    // mais aucune extraction RIB possible -> le champ reste vide.
    await registerPage.uploadDocuments([
      { key: 'cinDocument', file: SAMPLES.cin },
      { key: 'ribDocument', file: SAMPLES.cin }
    ]);
    await expect(registerPage.documentStatus('ribDocument')).toHaveText('À vérifier', { timeout: 20_000 });

    // Le champ RIB doit rester éditable (déverrouillé dès qu'un fichier est
    // importé, indépendamment du résultat de l'extraction) — l'utilisateur
    // corrige à la main.
    await expect(registerPage.ribFieldValue()).toBeEditable();
    await expect(registerPage.ribFieldValue()).toHaveValue('');
    await registerPage.ribFieldValue().fill('230123456789012345678901');

    await registerPage.acceptTermsAndSubmit();
    await expect(registerPage.successMessage()).toContainText(/Dossier #\d+ créé/, { timeout: 15_000 });
  });

  test('A3 — PDF accepté sans blocage pour un type normalement classifié', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await registerPage.goto();

    await registerPage.fillStep1({ commercantType: 'PP', affiliationType: 'TPE', telephone: '0612345678' });
    await registerPage.continuerButton().click();
    await registerPage.fillStep2({
      commercantType: 'PP',
      affiliationType: 'TPE',
      suffix,
      email: `e2e.a3.${suffix}@lanacash-test.ma`,
      telephone: '0612345678'
    });
    await registerPage.continuerButton().click();

    await registerPage.uploadDocuments([
      { key: 'cinDocument', file: SAMPLES.pdfDocument },
      { key: 'ribDocument', file: SAMPLES.rib }
    ]);

    // Aucun appel réseau pour un PDF (resolveImmediateValidationState) :
    // "Non vérifié" apparaît immédiatement, pas d'état "Vérification" transitoire.
    await expect(registerPage.documentStatus('cinDocument')).toHaveText('Non vérifié', { timeout: 3_000 });
    await expect(registerPage.documentCard('cinDocument').locator('.doc-validation-note')).toContainText('image jpg');

    await expect(registerPage.ribFieldValue()).not.toHaveValue('', { timeout: 20_000 });
    await registerPage.acceptTermsAndSubmit();
    await expect(registerPage.successMessage()).toContainText(/Dossier #\d+ créé/, { timeout: 15_000 });
  });

  test('B1 — fichier de plus de 10 Mo rejeté avant tout upload', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await registerPage.goto();

    await registerPage.fillStep1({ commercantType: 'PP', affiliationType: 'TPE', telephone: '0612345678' });
    await registerPage.continuerButton().click();
    await registerPage.fillStep2({
      commercantType: 'PP',
      affiliationType: 'TPE',
      suffix,
      email: `e2e.b1.${suffix}@lanacash-test.ma`,
      telephone: '0612345678'
    });
    await registerPage.continuerButton().click();

    await registerPage.uploadDocuments([{ key: 'cinDocument', file: SAMPLES.oversizedFile }]);

    await expect(registerPage.errorMessage()).toContainText('dépasse la limite autorisée de 10 MB');
    // Le fichier rejeté ne doit PAS apparaître comme importé.
    await expect(registerPage.documentCard('cinDocument').locator('.doc-file')).toHaveText('Aucun fichier');
  });

  test('B2 — le bouton "Continuer" reste désactivé tant que les champs obligatoires ne sont pas remplis', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    await page.locator('#register-typeCommercant').selectOption('PP');
    await page.locator('#register-typeAffiliation').selectOption('TPE');
    await page.locator('#register-nom').fill('Test');
    await page.locator('#register-activite').selectOption({ index: 1 });
    await page.locator('#register-secteur').selectOption({ index: 1 });
    // Téléphone principal volontairement laissé vide.

    await expect(registerPage.continuerButton()).toBeDisabled();

    await page.locator('#register-telephonePrincipal').fill('0612345678');
    await expect(registerPage.continuerButton()).toBeEnabled();
  });

  test("C1 — un incident réseau ponctuel sur la vérification d'un document n'empêche pas la soumission", async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Simule un incident réseau/timeout côté front UNIQUEMENT sur le premier
    // appel de vérification par document (la CIN, uploadée en premier) — le
    // vrai backend/doc-classifier n'est jamais touché : à la soumission
    // finale, demo revalide réellement chaque document contre le vrai
    // doc-classifier (toujours up), donc le dossier doit quand même se créer.
    // C'est la preuve que la résilience front (fallback "Non vérifié" sur
    // échec réseau, cf. onDocumentSelected catch{}) ne casse pas le flux.
    let intercepted = false;
    await page.route('**/api/affiliations/documents/validate', async (route) => {
      if (!intercepted) {
        intercepted = true;
        await route.abort('failed');
        return;
      }
      await route.continue();
    });

    await registerPage.goto();
    await registerPage.fillStep1({ commercantType: 'PP', affiliationType: 'TPE', telephone: '0612345678' });
    await registerPage.continuerButton().click();
    await registerPage.fillStep2({
      commercantType: 'PP',
      affiliationType: 'TPE',
      suffix,
      email: `e2e.c1.${suffix}@lanacash-test.ma`,
      telephone: '0612345678'
    });
    await registerPage.continuerButton().click();

    const profile = commercantProfile('PP', suffix);
    await registerPage.uploadDocuments(profile.documents); // cinDocument en premier -> intercepté

    await expect(registerPage.documentStatus('cinDocument')).toHaveText('Non vérifié', { timeout: 10_000 });
    await expect(registerPage.documentCard('cinDocument').locator('.doc-validation-note')).toContainText(
      'Impossible de vérifier'
    );
    // Le RIB (2e appel, non intercepté) doit avoir été traité normalement.
    await expect(registerPage.ribFieldValue()).not.toHaveValue('', { timeout: 20_000 });

    await registerPage.acceptTermsAndSubmit();
    await expect(registerPage.successMessage()).toContainText(/Dossier #\d+ créé/, { timeout: 15_000 });
  });

  test('D1 — Encaissement + E-commerce avec un produit SoftPOS (pas seulement TPE)', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await registerPage.goto();

    await registerPage.completeFullFlow({
      commercantType: 'PP',
      affiliationType: 'EncaissementEcommerce',
      encaissementProduit: 'SoftPOS',
      suffix,
      email: `e2e.d1.${suffix}@lanacash-test.ma`,
      telephone: '0612345678'
    });

    await expect(registerPage.ribFieldValue()).not.toHaveValue('', { timeout: 20_000 });
    await registerPage.acceptTermsAndSubmit();
    await expect(registerPage.successMessage()).toContainText(/Dossier #\d+ créé/, { timeout: 15_000 });
  });

  test('D2 — plusieurs points de vente (3) sur une même demande', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await registerPage.goto();

    await registerPage.completeFullFlow({
      commercantType: 'PP',
      affiliationType: 'TPE',
      pointVenteCount: 3,
      suffix,
      email: `e2e.d2.${suffix}@lanacash-test.ma`,
      telephone: '0612345678'
    });

    await expect(registerPage.ribFieldValue()).not.toHaveValue('', { timeout: 20_000 });
    await registerPage.acceptTermsAndSubmit();
    await expect(registerPage.successMessage()).toContainText(/Dossier #\d+ créé/, { timeout: 15_000 });
  });
});
