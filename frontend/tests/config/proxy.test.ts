// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { construirProxy } from '../../config/proxy';

describe('construirProxy', () => {
  it('apunta a http://localhost:3000 cuando API_TARGET no está definido', () => {
    expect(construirProxy({})['/api']?.target).toBe('http://localhost:3000');
  });

  it('usa API_TARGET cuando está definido', () => {
    const proxy = construirProxy({ API_TARGET: 'http://api:3000' });
    expect(proxy['/api']?.target).toBe('http://api:3000');
  });

  it('ignora un API_TARGET vacío y usa el valor por omisión', () => {
    expect(construirProxy({ API_TARGET: '' })['/api']?.target).toBe(
      'http://localhost:3000',
    );
  });

  it('quita el prefijo /api antes de reenviar', () => {
    const { rewrite } = construirProxy({})['/api']!;
    expect(rewrite?.('/api/auth/contexto')).toBe('/auth/contexto');
    expect(rewrite?.('/api/health')).toBe('/health');
  });

  it('solo quita el prefijo al inicio de la ruta', () => {
    const { rewrite } = construirProxy({})['/api']!;
    expect(rewrite?.('/bandeja/api/x')).toBe('/bandeja/api/x');
  });

  it('cambia el origen de la petición', () => {
    expect(construirProxy({})['/api']?.changeOrigin).toBe(true);
  });
});
