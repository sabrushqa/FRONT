import { useEffect, useMemo, useState } from 'react';
import {
  getAffiliationRequests,
  getOverview,
  getPdvMap,
  getTpeStock,
  AffiliationRequestItem,
  PdvMapItem,
  SupervisorOverviewResponse,
  SupervisorTpeStockItem
} from '../../services/supervisorApi';
import {
  buildSupervisorDecisionMetrics,
  EMPTY_OVERVIEW,
  SupervisorDecisionMetrics
} from './supervisorDecisionMetrics';

interface SupervisorDecisionData {
  isLoading: boolean;
  errorMessage: string;
  requests: AffiliationRequestItem[];
  metrics: SupervisorDecisionMetrics;
}

interface RawData {
  overview: SupervisorOverviewResponse;
  requests: AffiliationRequestItem[];
  pdvs: PdvMapItem[];
  tpes: SupervisorTpeStockItem[];
}

// Pipeline dossiers, Performance des equipes et Activite & Conversion
// appellent chacun ce hook independamment (includeInventory=false pour les
// 3) : sans cache, naviguer de l'un a l'autre re-televersait a chaque fois
// getOverview()+getAffiliationRequests() — cette derniere renvoie TOUS les
// dossiers avec leur fiche complete (~90 champs chacun, y compris les
// blocs "compte-rendu" texte long), potentiellement des centaines de lignes.
// D'ou la lenteur perçue "les donnees mettent du temps a s'afficher" au
// moindre changement de page, alors que les donnees n'avaient pas change
// entre-temps. Cache module-level (survit au demontage/remontage des pages,
// contrairement a un state React) garde par includeInventory (Overview a
// aussi besoin des PDV/TPE, les 3 autres pages non), avec un TTL court pour
// rester raisonnablement a jour sans re-fetcher a chaque navigation.
const CACHE_TTL_MS = 45_000;
const cacheByInventoryFlag = new Map<boolean, { data: RawData; fetchedAt: number }>();
const inFlightByInventoryFlag = new Map<boolean, Promise<RawData>>();

async function fetchRawData(includeInventory: boolean): Promise<RawData> {
  const cached = cacheByInventoryFlag.get(includeInventory);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const existingRequest = inFlightByInventoryFlag.get(includeInventory);
  if (existingRequest) {
    return existingRequest;
  }

  const request = (async () => {
    const [overviewResponse, affiliationResponse, pdvResponse, tpeResponse] = await Promise.all([
      getOverview(),
      getAffiliationRequests(),
      includeInventory ? getPdvMap().catch(() => ({ pdvs: [] as PdvMapItem[] })) : Promise.resolve({ pdvs: [] as PdvMapItem[] }),
      includeInventory ? getTpeStock().catch(() => ({ tpes: [] as SupervisorTpeStockItem[] })) : Promise.resolve({ tpes: [] as SupervisorTpeStockItem[] })
    ]);
    const data: RawData = {
      overview: overviewResponse,
      requests: Array.isArray(affiliationResponse.requests) ? affiliationResponse.requests : [],
      pdvs: Array.isArray(pdvResponse.pdvs) ? pdvResponse.pdvs : [],
      tpes: Array.isArray(tpeResponse.tpes) ? tpeResponse.tpes : []
    };
    cacheByInventoryFlag.set(includeInventory, { data, fetchedAt: Date.now() });
    return data;
  })();

  inFlightByInventoryFlag.set(includeInventory, request);
  try {
    return await request;
  } finally {
    inFlightByInventoryFlag.delete(includeInventory);
  }
}

/** A appeler apres toute action qui modifie un dossier (validation, refus,
 * affectation TPE...) depuis une de ces pages, pour que la page suivante
 * revoie l'etat frais plutot que le cache TTL encore valide. */
export function invalidateSupervisorDecisionDataCache(): void {
  cacheByInventoryFlag.clear();
}

export function useSupervisorDecisionData(includeInventory = false): SupervisorDecisionData {
  const cachedEntry = cacheByInventoryFlag.get(includeInventory);
  const hasFreshCache = !!cachedEntry && Date.now() - cachedEntry.fetchedAt < CACHE_TTL_MS;

  const [isLoading, setIsLoading] = useState(!hasFreshCache);
  const [errorMessage, setErrorMessage] = useState('');
  const [overview, setOverview] = useState<SupervisorOverviewResponse>(cachedEntry?.data.overview ?? EMPTY_OVERVIEW);
  const [requests, setRequests] = useState<AffiliationRequestItem[]>(cachedEntry?.data.requests ?? []);
  const [pdvs, setPdvs] = useState<PdvMapItem[]>(cachedEntry?.data.pdvs ?? []);
  const [tpes, setTpes] = useState<SupervisorTpeStockItem[]>(cachedEntry?.data.tpes ?? []);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const freshEnough = cacheByInventoryFlag.get(includeInventory);
      if (!(freshEnough && Date.now() - freshEnough.fetchedAt < CACHE_TTL_MS)) {
        setIsLoading(true);
      }
      try {
        const data = await fetchRawData(includeInventory);
        if (!isMounted) return;
        setOverview(data.overview);
        setRequests(data.requests);
        setPdvs(data.pdvs);
        setTpes(data.tpes);
        setErrorMessage('');
      } catch {
        if (isMounted) {
          setErrorMessage('Les indicateurs superviseur sont indisponibles.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [includeInventory]);

  const metrics = useMemo(
    () => buildSupervisorDecisionMetrics(overview, requests, pdvs, tpes),
    [overview, requests, pdvs, tpes]
  );

  return { isLoading, errorMessage, requests, metrics };
}
