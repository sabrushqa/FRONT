import { stripLeadingAndTrailingSlashes } from './url';

type LanaCashWindow = Window & {
  __LANACASH_CONFIG__?: {
    apiBaseUrl?: string;
    keycloakUrl?: string;
    keycloakRealm?: string;
    keycloakClientId?: string;
  };
};

function splitUrlParts(url: string): { origin: string; pathname: string } {
  if (/^https?:\/\//i.test(url)) {
    const parsedUrl = new URL(url);
    return {
      origin: parsedUrl.origin,
      pathname: parsedUrl.pathname
    };
  }
  return { origin: '', pathname: url };
}

function trimSlashes(value: string): string {
  return stripLeadingAndTrailingSlashes(value);
}

function shouldUseLocalBackendProxy(basePath: string): boolean {
  const browserPort = window.location.port;
  const isLocalDevHost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '::1';
  return (
    basePath.startsWith('/') &&
    isLocalDevHost &&
    !!browserPort &&
    browserPort !== '8000' &&
    browserPort !== '8443'
  );
}

function formatLocalBackendHost(hostname: string): string {
  return hostname === '::1' ? '[::1]' : hostname;
}

function joinApiPaths(basePath: string, requestPath: string): string {
  const normalizedBasePath = trimSlashes(basePath);
  const normalizedRequestPath = trimSlashes(requestPath);

  if (!normalizedBasePath) return `/${normalizedRequestPath}`;
  if (!normalizedRequestPath) return `/${normalizedBasePath}`;

  const baseSegments = normalizedBasePath.split('/');
  const requestSegments = normalizedRequestPath.split('/');
  const maxOverlap = Math.min(baseSegments.length, requestSegments.length);
  let overlapLength = 0;

  for (let candidate = maxOverlap; candidate > 0; candidate -= 1) {
    const baseSuffix = baseSegments.slice(-candidate).join('/');
    const requestPrefix = requestSegments.slice(0, candidate).join('/');
    if (baseSuffix === requestPrefix) {
      overlapLength = candidate;
      break;
    }
  }

  return `/${[...baseSegments, ...requestSegments.slice(overlapLength)].join('/')}`;
}

export function resolveBackendApiUrl(path: string): string {
  const configuredBaseUrl = (window as LanaCashWindow).__LANACASH_CONFIG__?.apiBaseUrl?.trim();

  if (configuredBaseUrl) {
    const { origin, pathname } = splitUrlParts(configuredBaseUrl);
    const localBackendOrigin = shouldUseLocalBackendProxy(pathname)
      ? `${window.location.protocol}//${formatLocalBackendHost(window.location.hostname)}:8000`
      : origin;
    return `${localBackendOrigin}${joinApiPaths(pathname, path)}`;
  }

  const browserHost = window.location.hostname || 'localhost';
  const host =
    browserHost === 'localhost' || browserHost === '127.0.0.1' ? '127.0.0.1' : browserHost;
  const shouldUseHttps = window.location.protocol === 'https:';
  const protocol = shouldUseHttps ? 'https' : 'http';
  const port = shouldUseHttps ? '8443' : '8000';

  return `${protocol}://${host}:${port}${path}`;
}
