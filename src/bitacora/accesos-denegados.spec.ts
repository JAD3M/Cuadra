import { Logger } from '@nestjs/common';
import type { TransaccionEmpresa } from '../database/transaccion-empresa';
import { AccesosDenegados, type AccesoDenegado } from './accesos-denegados';

const ACCESO: AccesoDenegado = {
  companyId: 'empresa-a',
  userId: 'usuario-1',
  metodo: 'GET',
  ruta: '/prueba/admin',
  rolesRequeridos: ['admin'],
  rolesDelUsuario: ['contador'],
};

describe('AccesosDenegados', () => {
  afterEach(() => jest.restoreAllMocks());

  it('si la bitácora falla, no lanza: deja el error en el log', async () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const ejecutar = jest.fn().mockRejectedValue(new Error('base caída'));
    const servicio = new AccesosDenegados({
      ejecutar,
    } as unknown as TransaccionEmpresa);

    await expect(servicio.registrar(ACCESO)).resolves.toBeUndefined();
    expect(ejecutar).toHaveBeenCalledWith('empresa-a', expect.any(Function));
    expect(error).toHaveBeenCalledTimes(1);
  });
});
