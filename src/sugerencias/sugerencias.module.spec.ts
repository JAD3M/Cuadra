import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdaptadorAnthropic } from './adaptador-anthropic';
import {
  ProveedorDesactivado,
  type ProveedorSugerencia,
} from './proveedor-sugerencia';
import { crearProveedor } from './sugerencias.module';

function config(valores: Record<string, unknown>): ConfigService {
  return new ConfigService({
    LLM_MODEL: 'claude-sonnet-5-5',
    LLM_TIMEOUT_MS: 15000,
    ...valores,
  });
}

describe('crearProveedor (CU-17)', () => {
  let aviso: jest.SpyInstance;
  beforeEach(() => {
    aviso = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  it('apagado por configuración: desactivado y sin aviso', () => {
    const p: ProveedorSugerencia = crearProveedor(
      config({ LLM_HABILITADO: false, ANTHROPIC_API_KEY: 'sk-x' }),
    );
    expect(p).toBeInstanceOf(ProveedorDesactivado);
    expect(p.activo).toBe(false);
    expect(aviso).not.toHaveBeenCalled();
  });

  it('sin nada configurado: desactivado', () => {
    expect(crearProveedor(config({}))).toBeInstanceOf(ProveedorDesactivado);
  });

  it('habilitado sin llave: desactivado, un aviso y sin lanzar', () => {
    const p = crearProveedor(config({ LLM_HABILITADO: true }));
    expect(p).toBeInstanceOf(ProveedorDesactivado);
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(String((aviso.mock.calls as unknown[][])[0][0])).toMatch(
      /ANTHROPIC_API_KEY/,
    );
  });

  it('habilitado y con llave: el adaptador de Anthropic con el modelo configurado', () => {
    const p = crearProveedor(
      config({
        LLM_HABILITADO: true,
        ANTHROPIC_API_KEY: 'sk-x',
        LLM_MODEL: 'otro-modelo',
      }),
    );
    expect(p).toBeInstanceOf(AdaptadorAnthropic);
    expect(p.activo).toBe(true);
    expect(p.modelo).toBe('otro-modelo');
  });
});
