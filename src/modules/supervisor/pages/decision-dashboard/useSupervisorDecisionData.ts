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

export function useSupervisorDecisionData(includeInventory = false): SupervisorDecisionData {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [overview, setOverview] = useState<SupervisorOverviewResponse>(EMPTY_OVERVIEW);
  const [requests, setRequests] = useState<AffiliationRequestItem[]>([]);
  const [pdvs, setPdvs] = useState<PdvMapItem[]>([]);
  const [tpes, setTpes] = useState<SupervisorTpeStockItem[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      try {
        const [overviewResponse, affiliationResponse, pdvResponse, tpeResponse] = await Promise.all([
          getOverview(),
          getAffiliationRequests(),
          includeInventory ? getPdvMap().catch(() => ({ pdvs: [] as PdvMapItem[] })) : Promise.resolve({ pdvs: [] as PdvMapItem[] }),
          includeInventory ? getTpeStock().catch(() => ({ tpes: [] as SupervisorTpeStockItem[] })) : Promise.resolve({ tpes: [] as SupervisorTpeStockItem[] })
        ]);

        if (!isMounted) return;
        setOverview(overviewResponse);
        setRequests(Array.isArray(affiliationResponse.requests) ? affiliationResponse.requests : []);
        setPdvs(Array.isArray(pdvResponse.pdvs) ? pdvResponse.pdvs : []);
        setTpes(Array.isArray(tpeResponse.tpes) ? tpeResponse.tpes : []);
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
