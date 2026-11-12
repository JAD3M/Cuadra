import type { DataSource } from 'typeorm';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import { construirPdfSintetico } from '../bancos/pdf/pdf-sintetico';
import { filas } from '../database/testing/base-de-pruebas';
import {
  BANCOS_DE_PRUEBA,
  lineasDeEstadoCuenta,
  type BancoDePrueba,
} from '../testing/estados-de-cuenta-de-prueba';
import {
  cfdiDeEjemploPara,
  levantarRecorrido,
  type Recorrido,
} from '../testing/recorrido-de-pruebas';
import {
  FACTURAS,
  MOVIMIENTOS,
  PERIODO,
  SALDO_ANTERIOR,
} from '../../scripts/ejemplos/juego';

/**
 * Historia 8.3, puerta de salida de la fase 2b (FR-1, FR-2, FR-7, AD-18). Los
 * tres bancos con PDF cargan, cuadran y concilian el mismo mes de ejemplo (el
 * de la historia 7.1) de punta a punta por HTTP, con la API, Postgres con RLS
 * y Redis reales. Cada banco es una empresa distinta, dada de alta por el
 * dueño con su administrador, que sube el PDF y revisa lo que propone el
 * motor. SINTÉTICO [SUPUESTO]: los PDF de los tres bancos los arma
 * `estados-de-cuenta-de-prueba.ts`; ninguno es un estado de cuenta real.
 */

jest.setTimeout(180_000);

const DOMINIO = 'tresbancos.test';
const CORREO_DUENO = 'dueno-tres-bancos@cuadra.test';
const PASSWORD_DUENO = 'una-contraseña-larga-123';
const RFC: Record<BancoDePrueba, string> = {
  bbva: 'TBA240101AB1',
  banorte: 'TBB240202BC2',
  santander: 'TBC240303CD3',
};

let r: Recorrido;
let ds: DataSource;
let cookieDueno: string;

const http = () => r.http();

beforeAll(async () => {
  r = await levantarRecorrido({
    prefijo: 'cuadra_test_tres_bancos',
    dominio: DOMINIO,
    rfcs: Object.values(RFC),
    correoDueno: CORREO_DUENO,
    passwordDueno: PASSWORD_DUENO,
    conDominio: true,
  });
  ({ ds } = r);
  cookieDueno = await r.iniciarDueno();
}, 60_000);

afterAll(async () => {
  await r?.cerrar();
});

interface FilaBandeja {
  regla: string | null;
  mejorPropuesta: { score: string | null } | null;
}

async function bandeja(token: string, estados: string[]) {
  const res = await http()
    .get('/bandeja')
    .query({ estado: estados, limite: 100 })
    .set('Cookie', token)
    .expect(200);
  return (res.body as { datos: FilaBandeja[] }).datos;
}

/** El mes de ejemplo (7.1) con el PDF de cada banco. */
function pdfDelMes(banco: BancoDePrueba, saldoFinal?: string): Buffer {
  return construirPdfSintetico(
    lineasDeEstadoCuenta(banco, {
      periodoInicio: PERIODO.inicio,
      periodoFin: PERIODO.fin,
      saldoInicial: SALDO_ANTERIOR,
      saldoFinal,
      movimientos: MOVIMIENTOS.map((m) => ({
        fecha: m.fecha,
        descripcion: m.descripcion,
        referencia: m.referencia,
        monto: m.monto,
      })),
    }),
  );
}

describe.each(BANCOS_DE_PRUEBA)(
  'puerta de salida de la fase 2b: %s carga, cuadra y concilia un mes',
  (banco) => {
    let empresa: string;
    let token: string;

    it('la empresa se da de alta y su administradora entra por invitación', async () => {
      const correo = `admin-${banco}@${DOMINIO}`;
      empresa = await r.crearEmpresa(
        cookieDueno,
        `Ferretería ${banco} SA de CV`,
        RFC[banco],
        correo,
      );
      token = (await r.aceptar(correo, `Admin ${banco}`)).cookie;
    });

    it('un PDF que no cuadra se rechaza completo; el que cuadra entra al aceptar la vista previa', async () => {
      const subir = (pdf: Buffer, nombre: string) =>
        http()
          .post('/cargas/estado-cuenta/pdf')
          .set('Cookie', token)
          .field('banco', banco)
          .attach('archivo', pdf, nombre);

      const mal = await subir(pdfDelMes(banco, '1.00'), 'no-cuadra.pdf');
      expect(mal.status).toBe(400);
      expect(mal.body).toMatchObject({ error: 'saldos_no_cuadran' });
      const [{ n }] = await filas<{ n: string }>(
        ds,
        `SELECT (SELECT count(*) FROM movimientos WHERE company_id = $1)
              + (SELECT count(*) FROM movimientos_pendientes WHERE company_id = $1) AS n`,
        [empresa],
      );
      expect(Number(n)).toBe(0);

      const carga = await subir(pdfDelMes(banco), 'septiembre.pdf').expect(200);
      expect(carga.body).toMatchObject({
        banco,
        cuadreAutomatico: true,
        movimientosLeidos: MOVIMIENTOS.length,
        lineasNoLeidas: 0,
        estado: 'pendiente_vista_previa',
      });
      const { cargaId } = carga.body as { cargaId: string };
      await http()
        .post(`/cargas/${cargaId}/aceptar`)
        .set('Cookie', token)
        .expect(200);

      // Los movimientos de los tres bancos son los mismos del mes de ejemplo.
      const guardados = await filas<{
        fecha: string;
        descripcion: string;
        monto: string;
      }>(
        ds,
        `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha, descripcion, monto::text AS monto
           FROM movimientos WHERE company_id = $1 ORDER BY linea_numero`,
        [empresa],
      );
      expect(
        guardados.map((m) => [m.fecha, m.descripcion, Number(m.monto)]),
      ).toEqual(
        MOVIMIENTOS.map((m) => [m.fecha, m.descripcion, Number(m.monto)]),
      );
    });

    it('con los CFDI del mes el motor propone en el mismo orden y marca lo que no puede', async () => {
      const cfdi = http().post('/cargas/cfdi').set('Cookie', token);
      for (const f of FACTURAS) {
        cfdi.attach(
          'archivos',
          cfdiDeEjemploPara(RFC[banco], f.folio),
          `${f.folio}.xml`,
        );
      }
      const subida = await cfdi.expect(202);
      const fin = await r.esperarFin(token, (subida.body as { id: string }).id);
      expect(fin).toMatchObject({ estado: 'procesada', registrosOk: 9 });

      await r.app.get(ConciliacionService).conciliar(empresa);

      const sugerencias = await bandeja(token, ['sugerencia']);
      expect(sugerencias.map((f) => Number(f.mejorPropuesta?.score))).toEqual([
        1, 0.6, 0.5, 0.4,
      ]);
      expect(sugerencias.map((f) => f.regla)).toEqual([
        'referencia_monto_exacto',
        'suma_grupo',
        'referencia_monto_diferente',
        'monto_unico',
      ]);
      const sinMatch = await bandeja(token, ['sin_match']);
      expect(sinMatch.map((f) => f.regla).sort()).toEqual([
        'monto_multiples_candidatos',
        'sin_candidato_monto',
      ]);
    });
  },
);
