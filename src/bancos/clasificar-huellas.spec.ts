import { emparejar, type ClaseDeHuella } from './clasificar-huellas';

const e = (huella: string, referencia: string | null = null) => ({
  huella,
  referencia,
});

describe('emparejar (huella + multiplicidad)', () => {
  const clases = (
    entrantes: ReturnType<typeof e>[],
    existentes: ReturnType<typeof e>[],
  ): ClaseDeHuella[] => emparejar(entrantes, existentes);

  it('sin existentes todo es nuevo', () => {
    expect(clases([e('h1'), e('h2')], [])).toEqual(['nuevo', 'nuevo']);
  });

  it('misma huella y misma referencia cruda: exacto', () => {
    expect(clases([e('h1', 'ABC')], [e('h1', 'ABC')])).toEqual(['exacto']);
  });

  it('misma huella y referencia cruda distinta: dudoso', () => {
    expect(clases([e('h1', 'AB-C')], [e('h1', 'ABC')])).toEqual(['dudoso']);
  });

  it('otra huella no empareja', () => {
    expect(clases([e('h1', 'ABC')], [e('h2', 'ABC')])).toEqual(['nuevo']);
  });

  it('nulo y vacío son la misma referencia cruda', () => {
    expect(clases([e('h1', null)], [e('h1', '')])).toEqual(['exacto']);
    expect(clases([e('h1', '')], [e('h1', null)])).toEqual(['exacto']);
    expect(clases([e('h1', ' ')], [e('h1', null)])).toEqual(['exacto']);
  });

  it('la base tiene 1 y el archivo trae 2 iguales: 1 existente y 1 nueva', () => {
    expect(clases([e('h1', 'A'), e('h1', 'A')], [e('h1', 'A')])).toEqual([
      'exacto',
      'nuevo',
    ]);
  });

  it('la base tiene 2 y el archivo trae 1: exacto', () => {
    expect(clases([e('h1', 'A')], [e('h1', 'A'), e('h1', 'A')])).toEqual([
      'exacto',
    ]);
  });

  it('la base tiene 2 y el archivo 2: los dos exactos', () => {
    expect(
      clases([e('h1', 'A'), e('h1', 'A')], [e('h1', 'A'), e('h1', 'A')]),
    ).toEqual(['exacto', 'exacto']);
  });

  it('primero se consumen los exactos y luego se empareja el sobrante como dudoso', () => {
    // El dudoso viene primero en el archivo pero el exacto se queda con su par.
    expect(clases([e('h1', 'A-1'), e('h1', 'A1')], [e('h1', 'A1')])).toEqual([
      'nuevo',
      'exacto',
    ]);
    expect(
      clases([e('h1', 'A-1'), e('h1', 'A1')], [e('h1', 'A1'), e('h1', 'A 1')]),
    ).toEqual(['dudoso', 'exacto']);
  });

  it('cada existente se usa una sola vez', () => {
    expect(
      clases([e('h1', 'X'), e('h1', 'Y'), e('h1', 'Z')], [e('h1', 'W')]),
    ).toEqual(['dudoso', 'nuevo', 'nuevo']);
  });

  it('las filas del mismo lote no se emparejan entre sí', () => {
    expect(clases([e('h1', 'A'), e('h1', 'A')], [])).toEqual([
      'nuevo',
      'nuevo',
    ]);
  });

  it('varios grupos son independientes y conservan el orden de entrada', () => {
    expect(
      clases(
        [e('h1', 'A'), e('h2', 'B-'), e('h3'), e('h1', 'A'), e('h2', 'B')],
        [e('h1', 'A'), e('h2', 'B')],
      ),
    ).toEqual(['exacto', 'nuevo', 'nuevo', 'nuevo', 'exacto']);
  });

  it('lote vacío', () => {
    expect(clases([], [e('h1')])).toEqual([]);
  });
});
