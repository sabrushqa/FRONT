import { describe, it, expect } from 'vitest';
import { toSafeHttpUrl } from './url';

describe('toSafeHttpUrl', () => {
  it('renvoie null pour une valeur vide ou nulle', () => {
    expect(toSafeHttpUrl(null)).toBeNull();
    expect(toSafeHttpUrl(undefined)).toBeNull();
    expect(toSafeHttpUrl('')).toBeNull();
  });

  it('accepte les URLs http et https', () => {
    expect(toSafeHttpUrl('http://example.com')).toBe('http://example.com');
    expect(toSafeHttpUrl('https://example.com/path')).toBe('https://example.com/path');
  });

  it('rejette les schemas dangereux comme javascript:', () => {
    expect(toSafeHttpUrl('javascript:alert(1)')).toBeNull();
  });

  it('rejette les schemas non http comme data: ou file:', () => {
    expect(toSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(toSafeHttpUrl('file:///etc/passwd')).toBeNull();
  });

  it('renvoie null pour une chaine non parsable en URL', () => {
    expect(toSafeHttpUrl('not a url')).toBeNull();
  });
});
