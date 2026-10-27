import { Fragment, useEffect, useRef } from 'react';
import { ETIQUETAS_ROL, type Rol } from '@/shared/dominio';
import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import { Tabla, Td, Th } from '@/shared/ui/Tabla';
import { PERSONAS, ROLES_PERSONA } from '@/features/usuarios/textos';
import { EditorRoles } from './EditorRoles';
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
  /** Fila activa con el editor de roles abierto y su borrador. */
  editando: { id: string; roles: readonly Rol[] } | null;
  /** Id de la fila activa con la confirmación de quitar acceso abierta. */
  quitando: string | null;
  /** Una acción en vuelo: todos los botones esperan. */
  ocupado: boolean;
  /** Aviso sobre la tabla (`Invitación a … cancelada.`); objeto nuevo por vez. */
  aviso: { texto: string } | null;
  /** Último fallo de una fila: objeto nuevo por vez, lleva el foco al aviso. */
  ultimoFallo: { email: string } | null;
  /** Último éxito de una fila (roles guardados): lleva el foco a su aviso. */
  ultimoExito: { email: string } | null;
  onReintentar(): void;
  onReenviar(fila: FilaPersona): void;
  onPedirCancelar(fila: FilaPersona): void;
  onConfirmarCancelar(fila: FilaPersona): void;
  onVolver(fila: FilaPersona): void;
  onPedirEditar(fila: FilaPersona): void;
  onAlternarRol(rol: Rol): void;
  onGuardarRoles(fila: FilaPersona): void;
  onCancelarEdicion(fila: FilaPersona): void;
  onPedirQuitar(fila: FilaPersona): void;
  onConfirmarQuitar(fila: FilaPersona): void;
  onVolverQuitar(fila: FilaPersona): void;
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
 * pendientes; Cambiar roles y Quitar acceso (historia 2.6: vistas
 * `editar_roles*`, `roles_*`, `confirmar_quitar`, `acceso_*` y `ultimo_admin*`)
 * solo en las activas. Presentacional: no sabe de la API. El foco: las
 * confirmaciones llevan el foco a «Volver» (la salida segura) y «Volver» lo
 * devuelve al botón que las abrió; el editor lo lleva a su primera casilla y
 * «Cancelar» lo devuelve a «Cambiar roles»; un fallo, el éxito de una fila o
 * el aviso de cancelada o de acceso quitado lo reciben ellos mismos.
 */
export function ListaUsuarios({
  estado,
  filas,
  puedeGestionar,
  avisos,
  confirmando,
  editando,
  quitando,
  ocupado,
  aviso,
  ultimoFallo,
  ultimoExito,
  onReintentar,
  onReenviar,
  onPedirCancelar,
  onConfirmarCancelar,
  onVolver,
  onPedirEditar,
  onAlternarRol,
  onGuardarRoles,
  onCancelarEdicion,
  onPedirQuitar,
  onConfirmarQuitar,
  onVolverQuitar,
}: ListaUsuariosProps) {
  const refVolver = useRef<HTMLButtonElement>(null);
  const refAviso = useRef<HTMLDivElement>(null);
  const botonesCancelar = useRef(new Map<string, HTMLButtonElement>());
  const botonesCambiar = useRef(new Map<string, HTMLButtonElement>());
  const botonesQuitar = useRef(new Map<string, HTMLButtonElement>());
  const alertas = useRef(new Map<string, HTMLDivElement>());
  const exitos = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (confirmando !== null || quitando !== null) {
      refVolver.current?.focus();
    }
  }, [confirmando, quitando]);

  useEffect(() => {
    if (aviso !== null) refAviso.current?.focus();
  }, [aviso]);

  useEffect(() => {
    if (ultimoFallo !== null) alertas.current.get(ultimoFallo.email)?.focus();
  }, [ultimoFallo]);

  useEffect(() => {
    if (ultimoExito !== null) exitos.current.get(ultimoExito.email)?.focus();
  }, [ultimoExito]);

  const columnas = puedeGestionar ? 6 : 5;

  function volver(fila: FilaPersona) {
    onVolver(fila);
    botonesCancelar.current.get(fila.id)?.focus();
  }

  function cancelarEdicion(fila: FilaPersona) {
    onCancelarEdicion(fila);
    botonesCambiar.current.get(fila.id)?.focus();
  }

  function volverQuitar(fila: FilaPersona) {
    onVolverQuitar(fila);
    botonesQuitar.current.get(fila.id)?.focus();
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
              const editandoFila = !pendiente && editando?.id === fila.id;
              const quitandoFila = !pendiente && quitando === fila.id;
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
                        {!pendiente && (
                          <div className={estilos.acciones}>
                            <Button
                              type="button"
                              variante="secundario"
                              className={estilos.accion}
                              aria-label={ROLES_PERSONA.ariaCambiar(fila.email)}
                              aria-expanded={editandoFila}
                              disabled={ocupado}
                              ref={(el) => {
                                if (el) botonesCambiar.current.set(fila.id, el);
                                else botonesCambiar.current.delete(fila.id);
                              }}
                              onClick={() => onPedirEditar(fila)}
                            >
                              {ROLES_PERSONA.cambiar}
                            </Button>
                            <Button
                              type="button"
                              variante="secundario"
                              className={estilos.accion}
                              aria-label={ROLES_PERSONA.ariaQuitar(fila.email)}
                              aria-expanded={quitandoFila}
                              disabled={ocupado}
                              ref={(el) => {
                                if (el) botonesQuitar.current.set(fila.id, el);
                                else botonesQuitar.current.delete(fila.id);
                              }}
                              onClick={() => onPedirQuitar(fila)}
                            >
                              {ROLES_PERSONA.quitar}
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
                  {editandoFila && editando !== null && (
                    <tr>
                      <Td colSpan={columnas} className={estilos.extra}>
                        <EditorRoles
                          correo={fila.email}
                          seleccion={editando.roles}
                          ocupado={ocupado}
                          onAlternar={onAlternarRol}
                          onGuardar={() => onGuardarRoles(fila)}
                          onCancelar={() => cancelarEdicion(fila)}
                        />
                      </Td>
                    </tr>
                  )}
                  {quitandoFila && (
                    <tr>
                      <Td colSpan={columnas} className={estilos.extra}>
                        <div
                          role="group"
                          aria-label={ROLES_PERSONA.confirmarGrupo}
                          className={estilos.confirmar}
                        >
                          <span className={estilos.confirmarTexto}>
                            ¿Quitar el acceso de{' '}
                            <strong className={estilos.confirmarCorreo}>
                              {fila.email}
                            </strong>{' '}
                            {ROLES_PERSONA.confirmarQuitarResto}
                          </span>
                          <div className={estilos.acciones}>
                            <Button
                              type="button"
                              variante="peligro"
                              className={`${estilos.accion} ${estilos.peligro}`}
                              disabled={ocupado}
                              onClick={() => onConfirmarQuitar(fila)}
                            >
                              {ROLES_PERSONA.confirmarSi}
                            </Button>
                            <Button
                              type="button"
                              variante="secundario"
                              className={estilos.accion}
                              ref={refVolver}
                              disabled={ocupado}
                              onClick={() => volverQuitar(fila)}
                            >
                              {ROLES_PERSONA.volver}
                            </Button>
                          </div>
                        </div>
                      </Td>
                    </tr>
                  )}
                  {avisoFila?.tipo === 'ok' && (
                    <tr>
                      <Td colSpan={columnas} className={estilos.extra}>
                        <div
                          role="status"
                          tabIndex={-1}
                          className={estilos.avisoOk}
                          ref={(el) => {
                            if (el) exitos.current.set(fila.email, el);
                            else exitos.current.delete(fila.email);
                          }}
                        >
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
