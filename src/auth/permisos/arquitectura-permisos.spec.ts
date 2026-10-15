import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  type ArchivoFuente,
  endpointsSinPermiso,
} from './arquitectura-permisos';

/**
 * AD-11 / historia 2.1: todo endpoint declara el permiso que exige
 * (`@Permiso`), o es público (`@Publico`) o declara su tipo de sesión
 * (`@Scope`). Olvidarlo falla esta prueba, no abre la puerta en silencio.
 */

const RAIZ_SRC = join(__dirname, '..', '..');

function controladores(): ArchivoFuente[] {
  const salida: ArchivoFuente[] = [];
  const recorrer = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const ruta = join(dir, e.name);
      if (e.isDirectory()) recorrer(ruta);
      else if (e.name.endsWith('.controller.ts')) {
        salida.push({
          ruta: relative(RAIZ_SRC, ruta).split(sep).join('/'),
          contenido: readFileSync(ruta, 'utf8'),
        });
      }
    }
  };
  recorrer(RAIZ_SRC);
  return salida;
}

describe('arquitectura: permiso declarado en cada endpoint', () => {
  it('ningún endpoint de src/ queda sin @Permiso, @Publico o @Scope', () => {
    const fuentes = controladores();
    expect(fuentes.length).toBeGreaterThan(8);
    expect(endpointsSinPermiso(fuentes)).toEqual([]);
  });

  describe('endpointsSinPermiso (fixtures)', () => {
    const f = (contenido: string): ArchivoFuente[] => [
      { ruta: 'x/x.controller.ts', contenido },
    ];

    it('detecta un endpoint sin decorador de acceso', () => {
      const r = endpointsSinPermiso(
        f(`@Controller('x')
export class XController {
  @Get('a')
  a() {}
}`),
      );
      expect(r).toEqual([
        { ruta: 'x/x.controller.ts', clase: 'XController', metodo: 'a' },
      ]);
    });

    it('acepta @Permiso, @Publico y @Scope en el método', () => {
      const r = endpointsSinPermiso(
        f(`@Controller('x')
export class XController {
  @Get('a') @Permiso('bandeja.ver') a() {}
  @Post('b') @Publico() b() {}
  @Put('c') @Scope('seleccion') c() {}
}`),
      );
      expect(r).toEqual([]);
    });

    it('acepta el decorador de acceso a nivel de clase', () => {
      const r = endpointsSinPermiso(
        f(`@Controller('x')
@Scope('plataforma')
export class XController {
  @Get('a')
  a() {}
}`),
      );
      expect(r).toEqual([]);
    });

    it('ignora métodos sin decorador HTTP y reporta cada método sin permiso', () => {
      const r = endpointsSinPermiso(
        f(`@Controller('x')
export class XController {
  ayuda() {}
  @Delete(':id')
  borrar() {}
  @Patch(':id')
  parchar() {}
}`),
      );
      expect(r.map((i) => i.metodo)).toEqual(['borrar', 'parchar']);
    });

    it('una clase sin @Controller no cuenta', () => {
      const r = endpointsSinPermiso(
        f(`export class Otra {
  @Get('a')
  a() {}
}`),
      );
      expect(r).toEqual([]);
    });
  });
});
