import type { Locator, Page } from '@playwright/test';
import path from 'node:path';

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures', 'samples');
const sample = (name: string) => path.join(FIXTURES_DIR, name);

export type CommercantType = 'PP' | 'PM' | 'AE' | 'Association';
export type AffiliationType = 'TPE' | 'SoftPOS' | 'QRCode' | 'ECommerce' | 'EncaissementEcommerce';
export type EncaissementProduit = 'TPE' | 'SoftPOS' | 'QRCode';

export interface DocumentUpload {
  key: string;
  file: string;
}

interface CommercantProfile {
  identityKey: string;
  identityValue: string;
  /** Champs texte de l'étape 2 (specificFields) — tous des <input> pour les 4 profils. */
  step2TextFields: { key: string; value: string }[];
  /** Documents obligatoires (non optionnels) — RIB toujours en dernier : c'est
   *  lui qui déclenche l'extraction réelle via doc-classifier. */
  documents: DocumentUpload[];
}

export const SAMPLES = {
  cin: sample('cin-sample.jpg'),
  rib: sample('rib-sample.jpg'),
  // 3 échantillons RIB réels supplémentaires (dataset doc-classifier,
  // synth_rib_0001/0003/0005), vérifiés en extraction avant usage
  // (rib+iban corrects sur les 3) — évite de ne prouver l'extraction OCR
  // que sur une seule image fixe dans toute la suite.
  rib2: sample('rib-sample-2.jpg'),
  rib3: sample('rib-sample-3.jpg'),
  rib4: sample('rib-sample-4.jpg'),
  patente: sample('patente-sample.jpg'),
  statuts: sample('statuts-sample.jpg'),
  rc: sample('rc-sample.jpg'),
  ice: sample('ice-sample.jpg'),
  pvNomination: sample('pv-nomination-sample.jpg'),
  attestationAe: sample('attestation-ae-sample.jpg'),
  pvAssociation: sample('pv-association-sample.jpg'),
  listeMembres: sample('liste-membres-sample.jpg'),
  pdfDocument: sample('sample-document.pdf'),
  oversizedFile: sample('oversized-file.jpg')
};

// Un seul jeu d'échantillons réel par type de document (repris du dataset
// d'entraînement doc-classifier, cf. data/raw/<classe>/) — réutilisé pour
// toutes les combinaisons ; seul le RIB doit rester cohérent avec le
// document réellement traité par la classification/OCR.
export function commercantProfile(type: CommercantType, suffix: string): CommercantProfile {
  switch (type) {
    case 'PP':
      return {
        identityKey: 'nom',
        identityValue: 'Alaoui',
        step2TextFields: [
          { key: 'prenom', value: 'Yassine' },
          { key: 'cin', value: `CIN${suffix}` }
        ],
        documents: [
          { key: 'cinDocument', file: SAMPLES.cin },
          { key: 'ribDocument', file: SAMPLES.rib }
        ]
      };
    case 'PM':
      // (RIB #2 — cf. commentaire SAMPLES.rib2 : diversité des échantillons
      // testés à travers les 4 profils de commerçant.)
      return {
        identityKey: 'raisonSociale',
        identityValue: 'Lana Trading SARL',
        step2TextFields: [
          { key: 'rc', value: `RC${suffix}` },
          { key: 'ice', value: `ICE${suffix}` },
          { key: 'formeJuridique', value: 'SARL' },
          { key: 'representantLegal', value: 'Karim Bennani' }
        ],
        documents: [
          { key: 'statutsDocument', file: SAMPLES.statuts },
          { key: 'rcDocument', file: SAMPLES.rc },
          { key: 'iceDocument', file: SAMPLES.ice },
          { key: 'cinRepresentantDocument', file: SAMPLES.cin },
          { key: 'pvNominationDocument', file: SAMPLES.pvNomination },
          { key: 'ribDocument', file: SAMPLES.rib2 }
        ]
      };
    case 'AE':
      return {
        identityKey: 'nom',
        identityValue: 'Idrissi',
        step2TextFields: [
          { key: 'prenom', value: 'Sara' },
          { key: 'numeroAutoEntrepreneur', value: `AE${suffix}` },
          { key: 'ice', value: `ICE${suffix}` }
        ],
        documents: [
          { key: 'cinDocument', file: SAMPLES.cin },
          { key: 'attestationAeDocument', file: SAMPLES.attestationAe },
          { key: 'ribDocument', file: SAMPLES.rib3 }
        ]
      };
    case 'Association':
      return {
        identityKey: 'nomEntite',
        identityValue: 'Association Test E2E',
        step2TextFields: [
          { key: 'representantLegal', value: 'Nadia Amrani' },
          { key: 'objet', value: 'Aide sociale' },
          { key: 'ice', value: `ICE${suffix}` }
        ],
        documents: [
          { key: 'cinSignataireDocument', file: SAMPLES.cin },
          { key: 'pvAssociationDocument', file: SAMPLES.pvAssociation },
          { key: 'statutsDocument', file: SAMPLES.statuts },
          // listeMembresDocument : aucune classe dédiée dans doc-classifier
          // (absent de DOCUMENT_AUTO_VALIDATION_SUPPORTED_KEYS côté Register.tsx)
          // -> accepté sans classification, n'importe quel fichier convient.
          { key: 'listeMembresDocument', file: SAMPLES.listeMembres },
          { key: 'ribDocument', file: SAMPLES.rib4 }
        ]
      };
  }
}

/** Remplit les champs spécifiques à chaque type d'affiliation (étape 2). */
async function fillAffiliationFields(page: Page, type: AffiliationType, encaissementProduit: EncaissementProduit) {
  switch (type) {
    case 'TPE':
      await page.locator('#register-modeMiseADispositionTpe').selectOption({ index: 1 });
      await page.locator('#register-equipementTpe').selectOption({ index: 1 });
      await page.locator('#register-connectiviteTpe').selectOption({ index: 1 });
      await page.locator('#register-nombreTpe').fill('1');
      return;
    case 'SoftPOS':
    case 'QRCode':
      // resolveQrSoftposOptions() ne laisse qu'une seule option réelle
      // (l'autre est filtrée) -> index 1 = celle-ci, quel que soit le type.
      await page.locator('#register-modeleQrSoftpos').selectOption({ index: 1 });
      return;
    case 'ECommerce':
      await page.locator('#register-modeServiceEcommerce').selectOption({ index: 1 });
      await page.locator('#register-siteMarchandUrl').fill('https://boutique-e2e-test.ma');
      return;
    case 'EncaissementEcommerce':
      await page.locator('#register-encaissementProduit').selectOption(encaissementProduit);
      if (encaissementProduit === 'TPE') {
        await page.locator('#register-modeMiseADispositionTpe').selectOption({ index: 1 });
        await page.locator('#register-equipementTpe').selectOption({ index: 1 });
        await page.locator('#register-connectiviteTpe').selectOption({ index: 1 });
        await page.locator('#register-nombreTpe').fill('1');
      } else {
        // SoftPOS / QRCode : même champ modeleQrSoftpos que le cas simple.
        await page.locator('#register-modeleQrSoftpos').selectOption({ index: 1 });
      }
      await page.locator('#register-modeServiceEcommerce').selectOption({ index: 1 });
      await page.locator('#register-siteMarchandUrl').fill('https://boutique-e2e-test.ma');
      return;
  }
}

/** hasEncaissementFields côté Register.tsx : tout sauf E-commerce pur. */
function needsPointVente(type: AffiliationType): boolean {
  return type !== 'ECommerce';
}

/**
 * Page Object générique pour Register.tsx ("Créez votre compte
 * partenaire" — /register, page publique), couvrant les 4 types de
 * commerçant × 5 types d'affiliation, plus les cas limites/négatifs
 * (documents invalides, fichiers trop lourds, champs manquants...).
 * Tous les champs ont un id explicite (label htmlFor={id}) — ciblage
 * direct par id, jamais par libellé (évite toute ambiguïté avec les
 * libellés dupliqués dans la carte "Point de vente").
 */
export class RegisterPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/register');
    await this.page.getByRole('heading', { name: 'Créez votre compte partenaire' }).waitFor();
  }

  // ── Étape 1 : Informations ──────────────────────────────────────────
  async fillStep1(params: { commercantType: CommercantType; affiliationType: AffiliationType; telephone: string }) {
    const profile = commercantProfile(params.commercantType, 'na');
    await this.page.locator('#register-typeCommercant').selectOption(params.commercantType);
    await this.page.locator('#register-typeAffiliation').selectOption(params.affiliationType);
    await this.page.locator(`#register-${profile.identityKey}`).fill(profile.identityValue);
    await this.page.locator('#register-activite').selectOption({ index: 1 });
    await this.page.locator('#register-secteur').selectOption({ index: 1 });
    await this.page.locator('#register-telephonePrincipal').fill(params.telephone);
  }

  continuerButton(): Locator {
    return this.page.getByRole('button', { name: 'Continuer' });
  }

  finaliserButton(): Locator {
    return this.page.getByRole('button', { name: 'Finaliser la demande' });
  }

  // ── Étape 2 : Coordonnées et détails ────────────────────────────────
  async fillStep2(params: {
    commercantType: CommercantType;
    affiliationType: AffiliationType;
    suffix: string;
    email: string;
    telephone: string;
    pointVenteCount?: number;
    encaissementProduit?: EncaissementProduit;
  }) {
    const profile = commercantProfile(params.commercantType, params.suffix);
    const pointVenteCount = params.pointVenteCount ?? 1;
    const encaissementProduit = params.encaissementProduit ?? 'TPE';

    for (const field of profile.step2TextFields) {
      await this.page.locator(`#register-${field.key}`).fill(field.value);
    }
    await this.page.locator('#register-email').fill(params.email);
    await this.page.locator('#register-adresse').fill('12 rue des Fleurs');
    await this.page.locator('#register-ville').selectOption('Casablanca'); // remplit `region` automatiquement

    if (needsPointVente(params.affiliationType)) {
      await this.page.locator('#register-nombrePointsVente').fill(String(pointVenteCount));
    }
    await fillAffiliationFields(this.page, params.affiliationType, encaissementProduit);
    if (needsPointVente(params.affiliationType)) {
      for (let i = 0; i < pointVenteCount; i += 1) {
        await this.page.locator(`#pdv-nom-${i}`).fill(`Point de vente ${i + 1}`);
        await this.page.locator(`#pdv-adresse-${i}`).fill('12 rue des Fleurs');
        await this.page.locator(`#pdv-ville-${i}`).selectOption('Casablanca');
        await this.page.locator(`#pdv-telephone-${i}`).fill(params.telephone);
      }
    }
  }

  // ── Étape 3 : Documents et validation ──────────────────────────────
  async uploadDocuments(documents: DocumentUpload[]) {
    for (const doc of documents) {
      await this.page.locator(`#doc-${doc.key}`).setInputFiles(doc.file);
    }
  }

  /** Enchaîne étape 1 + 2 + upload des documents "normaux" du profil, sans soumettre. */
  async completeFullFlow(params: {
    commercantType: CommercantType;
    affiliationType: AffiliationType;
    suffix: string;
    email: string;
    telephone: string;
    pointVenteCount?: number;
    encaissementProduit?: EncaissementProduit;
  }) {
    await this.fillStep1(params);
    await this.continuerButton().click();
    await this.fillStep2(params);
    await this.continuerButton().click();
    const profile = commercantProfile(params.commercantType, params.suffix);
    await this.uploadDocuments(profile.documents);
  }

  documentCard(documentKey: string): Locator {
    return this.page.locator('.doc-card').filter({ has: this.page.locator(`#doc-${documentKey}`) });
  }

  documentStatus(documentKey: string): Locator {
    return this.documentCard(documentKey).locator('.doc-status');
  }

  ribDocCard(): Locator {
    return this.page.locator('.doc-card', { hasText: 'RIB' });
  }

  ribFieldValue(): Locator {
    return this.page.locator('#register-rib');
  }

  async acceptTermsAndSubmit() {
    await this.page.locator('#acceptTerms').check();
    await this.finaliserButton().click();
  }

  successMessage(): Locator {
    return this.page.locator('.submit-feedback-success');
  }

  errorMessage(): Locator {
    return this.page.locator('.submit-feedback-error');
  }
}
