import { Fragment, useEffect, useRef } from 'react';
import { ETIQUETAS_ROL, type Rol } from '@/shared/dominio';
import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import { Tabla, Td, Th } from '@/shared/ui/Tabla';
import { PERSONAS } from '@/features/usuarios/textos';
import estilos from './ListaUsuarios.module.css';

/**
 * Una fila lista para pintar: el contenedor ya resolvió textos y vencimiento.
 * `invitacionId` solo existe en las pendientes y es lo que usan las acciones;
 * `id` es el de la fila (usuario si está activa, invitación si pendiente).
 */
export interface FilaPersona {
  id: string;
  email: string;
  roles: readonly Rol[];
  estado: 'activo' | 'pendiente';
  invitacionId: string | null;
  /** «Activo», «Pendiente · vence en N días» o «Vencida». */
  estadoTexto: string;
  vencida: boolean;
  /** Vacíos («—») en las activas. */
  enviada: string | null;
  invitadaPor: string | null;
}

/** Aviso de una fila, por correo (el reenvío cambia el id de la fila). */
export interface AvisoFila {
  tipo: 'ok' | 'error';
  texto: string;
}

export interface ListaUsuariosProps {
  estado: 'cargando' | 'error' | 'filas';
  filas: readonly FilaPersona[];
  /** Con `usuarios.gestionar`: sin ella no hay columna de acciones. */
  puedeGestionar: boolean;
  /** Avisos por correo de fila. */
  avisos: Readonly<Record<string, AvisoFila>>;
  /** Id de la fila con la confirmación de cancelar abierta. */
  confirmando: string | null;
  /** Una acción en vuelo: todos los botones esperan. */
  ocupado: boolean;
  /** Aviso sobre la tabla (`Invitación a … cancelada.`); objeto nuevo por vez. */
  aviso: { texto: string } | null;
  /** Último fallo de una fila: objeto nuevo por vez, lleva el foco al aviso. */
  ultimoFallo: { email: string } | null;
  onReintentar(): void;
  onReenviar(fila: FilaPersona): void;
  onPedirCancelar(fila: FilaPersona): void;
  onConfirmarCancelar(fila: FilaPersona): void;
  onVolver(fila: FilaPersona): void;
}

function claseEstado(fila: FilaPersona): string {
  if (fila.estado === 'activo') return `${estilos.estado} ${estilos.activo}`;
  return fila.vencida
    ? `${estilos.estado} ${estilos.venc}`
    : `${estilos.estado}`;
}

/**
 * Sección «Personas de tu empresa» (mockup `Usuarios.dc.html`, vistas
 * `usuarios`, `usuarios_cargando`, `usuarios_error`, `confirmar_cancelar`,
 * `reenviado`, `cancelada` y los errores de fila). No hay estado vacío: la
 * propia persona siempre está en su lista. Reenviar y cancelar solo en las
 * pendientes; las activas no tienen acciones. Presentacional: no sabe de la API. El foco: la confirmación de cancelar
 * lleva el foco a «Volver» (la salida segura) y «Volver» lo devuelve al botón
 * que la abrió; un fallo o el aviso de cancelada lo reciben ellos mismos.
 */
export function ListaUsuarios({
  estado,
  filas,
  puedeGestionar,
  avisos,
  confirmando,
  ocupado,
  aviso,
  ultimoFallo,
  onReintentar,
  onReenviar,
  onPedirCancelar,
  onConfirmarCancelar,
  onVolver,
}: ListaUsuariosProps) {
  const refVolver = useRef<HTMLButtonElement>(null);
  const refAviso = useRef<HTMLDivElement>(null);
  const botonesCancelar = useRef(new Map<string, HTMLButtonElement>());
  const alertas = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (confirmando !== null) refVolver.current?.focus();
  }, [confirmando]);

  useEffect(() => {
    if (aviso !== null) refAviso.current?.focus();
  }, [aviso]);

  useEffect(() => {
    if (ultimoFallo !== null) alertas.current.get(ultimoFallo.email)?.focus();
  }, [ultimoFallo]);

  const columnas = puedeGestionar ? 6 : 5;

  function volver(fila: FilaPersona) {
    onVolver(fila);
    botonesCancelar.current.get(fila.id)?.focus();
  }

  return (
    <section aria-labelledby="t-personas" className={estilos.tarjeta}>
      <div className={estilos.cabecera}>
        <h2 id="t-personas" className={estilos.titulo}>
          {PERSONAS.titulo}
        </h2>
        <span className={estilos.ayuda}>{PERSONAS.ayuda}</span>
      </div>

      {aviso !== null && (
        <div
          ref={refAviso}
          role="status"
          tabIndex={-1}
          className={estilos.avisoOk}
        >
          {aviso.texto}
        </div>
      )}

      {estado === 'cargando' && (
        <div aria-busy="true" className={estilos.esqueletos}>
          <span role="status" className={estilos.soloLector}>
            {PERSONAS.cargando}
          </span>
          {[0, 1, 2].map((n) => (
            <div key={n} aria-hidden="true" className={estilos.esqueleto} />
          ))}
        </div>
      )}

      {estado === 'error' && (
        <AlertaError
          titulo={PERSONAS.errorLista}
          accion={
            <Button
              type="button"
              variante="secundario"
              className={estilos.reintentar}
              onClick={onReintentar}
            >
              {PERSONAS.reintentar}
            </Button>
          }
        />
      )}

      {estado === 'filas' && (
        <Tabla titulo={PERSONAS.tabla}>
          <thead>
            <tr>
              <Th>{PERSONAS.columnas.correo}</Th>
              <Th>{PERSONAS.columnas.roles}</Th>
              <Th>{PERSONAS.columnas.estado}</Th>
              <Th>{PERSONAS.columnas.enviada}</Th>
              <Th>{PERSONAS.columnas.invitadaPor}</Th>
              {puedeGestionar && <Th>{PERSONAS.columnas.acciones}</Th>}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => {
              const pendiente = fila.estado === 'pendiente';
              const abierta = pendiente && confirmando === fila.id;
              const avisoFila = avisos[fila.email];
              return (
                <Fragment key={fila.id}>
                  <tr>
                    <Td className={estilos.correo}>{fila.email}</Td>
                    <Td>
                      <div className={estilos.roles}>
                        {fila.roles.map((rol) => (
                          <span key={rol} className={estilos.chip}>
                            {ETIQUETAS_ROL[rol]}
                          </span>
                        ))}
                      </div>
                    </Td>
                    <Td>
                      <span className={claseEstado(fila)}>
                        {fila.estadoTexto}
                      </span>
                    </Td>
                    <Td
                      className={pendiente ? estilos.enviada : estilos.sinDato}
                    >
                      {pendiente ? fila.enviada : PERSONAS.sinDato}
                    </Td>
                    <Td
                      className={
                        pendiente && fila.invitadaPor !== null
                          ? estilos.quien
                          : estilos.quienPlataforma
                      }
                    >
                      {!pendiente
                        ? PERSONAS.sinDato
                        : (fila.invitadaPor ?? PERSONAS.plataforma)}
                    </Td>
                    {puedeGestionar && (
                      <Td>
                        {pendiente && (
                          <div className={estilos.acciones}>
                            <Button
                              type="button"
                              variante="secundario"
                              className={estilos.accion}
                              aria-label={PERSONAS.ariaReenviar(fila.email)}
                              disabled={ocupado}
                              onClick={() => onReenviar(fila)}
                            >
                              {PERSONAS.reenviar}
                            </Button>
                            <Button
                              type="button"
                              variante="secundario"
                              className={estilos.accion}
                              aria-label={PERSONAS.ariaCancelar(fila.email)}
                              aria-expanded={abierta}
                              disabled={ocupado}
                              ref={(el) => {
                                if (el)
                                  botonesCancelar.current.set(fila.id, el);
                                else botonesCancelar.current.delete(fila.id);
                              }}
                              onClick={() => onPedirCancelar(fila)}
                            >
                              {PERSONAS.cancelar}
                            </Button>
                          </div>
                        )}
                      </Td>
                    )}
                  </tr>
                  {abierta && (
                    <tr>
                      <Td colSpan={columnas} className={estilos.extra}>
                        <div
                          role="group"
                          aria-label={PERSONAS.confirmarGrupo}
                          className={estilos.confirmar}
                        >
                          <span className={estilos.confirmarTexto}>
                            ¿Cancelar la invitación a{' '}
                            <strong className={estilos.confirmarCorreo}>
                              {fila.email}
                            </strong>
                            ? El enlace dejará de servir.
                          </span>
                          <div className={estilos.acciones}>
                            <Button
                              type="button"
                              variante="peligro"
                              className={`${estilos.accion} ${estilos.peligro}`}
                              disabled={ocupado}
                              onClick={() => onConfirmarCancelar(fila)}
                            >
                              {PERSONAS.confirmarSi}
                            </Button>
                            <Button
                              type="button"
                              variante="secundario"
                              className={estilos.accion}
                              ref={refVolver}
                              disabled={ocupado}
                              onClick={() => volver(fila)}
                            >
                              {PERSONAS.confirmarVolver}
                            </Button>
                          </div>
                        </div>
                      </Td>
                    </tr>
                  )}
                  {avisoFila?.tipo === 'ok' && (
                    <tr>
                      <Td colSpan={columnas} className={estilos.extra}>
                        <div role="status" className={estilos.avisoOk}>
                          {avisoFila.texto}
                        </div>
                      </Td>
                    </tr>
                  )}
                  {avisoFila?.tipo === 'error' && (
                    <tr>
                      <Td colSpan={columnas} className={estilos.extra}>
                        <AlertaError
                          titulo={avisoFila.texto}
                          ref={(el) => {
                            if (el) alertas.current.set(fila.email, el);
                            else alertas.current.delete(fila.email);
                          }}
                        />
                      </Td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </Tabla>
      )}
    </section>
  );
}
