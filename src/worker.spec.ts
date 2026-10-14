describe('modo worker (historia 1.7)', () => {
  const previo = process.env.PROCESAR_COLAS;
  afterEach(() => {
    if (previo === undefined) delete process.env.PROCESAR_COLAS;
    else process.env.PROCESAR_COLAS = previo;
  });

  it('el worker fuerza PROCESAR_COLAS=true aunque el entorno diga false', () => {
    process.env.PROCESAR_COLAS = 'false';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./colas/modo-worker');
    });
    expect(process.env.PROCESAR_COLAS).toBe('true');
  });
});
