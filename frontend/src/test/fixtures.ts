// Cargas útiles de ejemplo con la forma exacta que responde la API (CU-19).
// Las comparten las pruebas de contratos, de cliente y de pantallas.

export const USUARIO = {
  id: '3f2b8a6e-6c1d-4a39-9d5e-0c1f7a1b2c3d',
  nombre: 'Jorge Tapia',
  email: 'jorge.tapia@despacho.mx',
};

export const EMPRESA_CONTEXTO = {
  id: '7a1c9e52-0b34-4d6f-8e21-5c9d3b7a4f10',
  razonSocial: 'Ferreteria del Bajio SA de CV',
  rfc: 'FDB190215QK4',
};

export const EMPRESAS_DISPONIBLES = [
  { ...EMPRESA_CONTEXTO, roles: ['admin', 'contador'] },
  {
    id: 'b2d4f6a8-1c3e-4f50-9a7b-2d4f6a8c0e1b',
    razonSocial: 'Abarrotes del Norte SA de CV',
    rfc: 'ADN200310AB1',
    roles: ['revisor'],
  },
];

export const RESPUESTA_LOGIN = {
  token: 'token-de-seleccion',
  usuario: USUARIO,
  empresas: EMPRESAS_DISPONIBLES,
};

export const RESPUESTA_TOKEN = { token: 'token-de-sesion' };

export const CONTEXTO_SESION = {
  usuario: USUARIO,
  empresa: EMPRESA_CONTEXTO,
  roles: ['admin', 'contador'],
};
