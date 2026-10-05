export { api, configurarCliente, crearClienteApi } from './client';
export type {
  ClienteApi,
  ConfiguracionCliente,
  MotivoFinSesion,
  OpcionesApi,
  OpcionesCliente,
} from './client';
export { ApiError, ContratoError, NetworkError, aApiError } from './errores';
export { crearQueryClient, reintentarConsulta } from './queryClient';
export { mensajeDeError } from './mensajes';
export type { ContextoMensaje, MensajeError, TipoMensaje } from './mensajes';
