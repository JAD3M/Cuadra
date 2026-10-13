/**
 * Se ejecuta antes de cada archivo de prueba (`setupFiles` de Jest). Fija las
 * variables que cambian el comportamiento de la API y que no deben depender
 * del `.env` de quien corre los tests: el origen de Vite en desarrollo y sin
 * proxy de confianza. Un spec que necesite otro valor lo asigna él mismo.
 */
process.env.ORIGEN_AUTORIZADO = 'http://localhost:5173';
delete process.env.TRUST_PROXY;
