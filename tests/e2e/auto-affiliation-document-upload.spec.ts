import { expect, test } from '@playwright/test';
import { RegisterPage } from './support/register-page';
import type { AffiliationType, CommercantType } from './support/register-page';

// E2E réel (aucun mock) du parcours "devenir client" :
//   react-portail-affiliation (/register)
//     -> demo / AffiliationRegistrationController (/api/affiliations/documents/validate)
//     -> doc-classifier (/api/process, port 9001) : classification + OCR du RIB
//     -> retour du champ RIB pré-rempli automatiquement
//   puis soumission complète -> demo crée un vrai dossier (/api/affiliations)
//
// Couvre les 4 types de commerçant x les 5 types d'affiliation (20 cas) :
// chaque combinaison a ses propres champs obligatoires et son propre jeu de
// documents (cf. requiredDocuments dans Register.tsx), donc son propre
// chemin de code côté front ET côté demo (mapping des documents uploadés).
//
// Prérequis (voir playwright.config.ts) : demo et doc-classifier doivent
// tourner réellement.
//
// Note sur la stabilité en rafale : en enchaînant les 20 cas d'affilée
// (jusqu'à ~70 inférences réelles CPU sans interruption, doc-classifier
// n'étant pas batché), un cas isolé pouvait occasionnellement dépasser
// l'ancien timeout front de 12s et échouer (latence sous charge soutenue,
// jamais un bug métier — un vrai utilisateur soumettant un seul formulaire
// ne déclenche jamais cette charge). Résolu en portant
// DOCUMENT_AUTO_VALIDATION_TIMEOUT_MS à 25s (Register.tsx), qui absorbe
// cette variance sans dégrader l'UX perçue.
const COMMERCANT_TYPES: CommercantType[] = ['PP', 'PM', 'AE', 'Association'];
const AFFILIATION_TYPES: AffiliationType[] = ['TPE', 'SoftPOS', 'QRCode', 'ECommerce', 'EncaissementEcommerce'];

test.describe('Auto-affiliation — upload de documents (devenir client)', () => {
  for (const commercantType of COMMERCANT_TYPES) {
    for (const affiliationType of AFFILIATION_TYPES) {
      test(`${commercantType} / ${affiliationType} — création de dossier avec extraction RIB automatique`, async ({ page }) => {
        const registerPage = new RegisterPage(page);
        const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

        await registerPage.goto();

        await registerPage.completeFullFlow({
          commercantType,
          affiliationType,
          suffix: uniqueSuffix,
          email: `e2e.${commercantType.toLowerCase()}.${affiliationType.toLowerCase()}.${uniqueSuffix}@lanacash-test.ma`,
          telephone: '0612345678'
        });

        // L'appel à doc-classifier passe par un état "validating" pendant
        // l'inférence réelle (OCR + classification) — jusqu'à 25s côté front
        // (DOCUMENT_AUTO_VALIDATION_TIMEOUT_MS, Register.tsx).
        const ribCard = registerPage.ribDocCard();
        await expect(ribCard.locator('.doc-status')).not.toHaveText(/Validation/, { timeout: 30_000 });

        // Preuve que l'intégration réelle a fonctionné : le champ RIB,
        // verrouillé tant qu'aucun document n'est importé, a été pré-rempli
        // par la réponse de doc-classifier (extraction OCR).
        await expect(registerPage.ribFieldValue()).not.toHaveValue('', { timeout: 5_000 });

        await registerPage.acceptTermsAndSubmit();

        // Preuve que demo a réellement créé le dossier (pas juste une
        // validation front) : le message de succès contient l'ID du dossier
        // créé en base — valide aussi que le mapping des documents propre à
        // ce type de commerçant est accepté côté backend.
        await expect(registerPage.successMessage()).toContainText(/Dossier #\d+ créé/, { timeout: 15_000 });
      });
    }
  }
});
