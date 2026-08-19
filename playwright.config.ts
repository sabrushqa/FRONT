import { defineConfig, devices } from '@playwright/test';

// Config E2E — parcours "devenir client" (page publique /register) avec
// upload de documents : react-portail-affiliation -> demo/Spring Boot
// (/api/affiliations/documents/validate, /api/affiliations) -> doc-classifier
// (port 9001, classification + OCR RIB).
//
// Prérequis avant de lancer `npm run test:e2e` :
//   1. doc-classifier tourne sur http://127.0.0.1:9001 (uvicorn ou docker).
//   2. demo (Spring Boot) tourne sur http://127.0.0.1:8000, avec
//      app.affiliation.document-validator.base-url pointant vers doc-classifier
//      (valeur par défaut déjà http://127.0.0.1:9001).
//   3. demo a accès à sa base (SQL Server) pour pouvoir créer un vrai dossier
//      via POST /api/affiliations.
//   4. `npm run dev` sert le front sur http://localhost:4200 (ou laisser
//      Playwright le démarrer via `webServer` ci-dessous si tu préfères).
// Aucune authentification requise : /register est une page publique.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // un seul worker : le parcours crée un vrai dossier via l'API réelle
  // 1 retry : la suite complète enchaîne ~28 dossiers, chacun avec de vraies
  // inférences doc-classifier (CPU, non batchées) — sous charge soutenue,
  // une inférence individuelle dépasse parfois le timeout front (25s,
  // DOCUMENT_AUTO_VALIDATION_TIMEOUT_MS) alors que le même cas, isolé,
  // passe systématiquement (vérifié : doc-classifier reste up, aucun crash).
  // C'est de la variance de latence d'infra, pas un bug logique — le retry
  // est donc la réponse standard (pas un masquage de bug).
  retries: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
  // Pas de `webServer` : ce test suppose demo + doc-classifier déjà démarrés
  // manuellement — Playwright ne peut orchestrer que le front.
});
