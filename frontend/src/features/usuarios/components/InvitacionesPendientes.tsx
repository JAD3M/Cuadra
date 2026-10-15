import { Fragment, useEffect, useRef } from 'react';
import { ETIQUETAS_ROL, type Rol } from '@/shared/dominio';
import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import { Tabla, Td, Th } from '@/shared/ui/Tabla';
import { PENDIENTES } from '@/features/usuarios/textos';
import estilos from './InvitacionesPendientes.module.css';

/** Una fila lista para pintar: el contenedor ya resolvió textos y vencimiento. */
export interface FilaPendiente {
  id: string;
  email: string;
  roles: readonly Rol[];
  enviada: string;
  vence: string;
  vencida: boolean;
  invitadaPor: string | null;
}

/** Aviso de una fila, por correo (el reenvío cambia el id de la fila). */
export interface AvisoFila {
  tipo: 'ok' | 'error';
  texto: string;
}

export interface InvitacionesPendientesProps {
  estado: 'cargando' | 'vacio' | 'error' | 'filas';
  filas: readonly FilaPendiente[];
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
  onReenviar(fila: FilaPendiente): void;
  onPedirCancelar(fila: FilaPendiente): void;
  onConfirmarCancelar(fila: FilaPendiente): void;
  onVolver(fila: FilaPendiente): void;
}

/**
 * Sección «Invitaciones pendientes» (mockup `Usuarios.dc.html`, vistas
 * `pendientes`, `pendientes_cargando`, `pendientes_vacio`, `pendientes_error`,
 * `confirmar_cancelar`, `reenviado`, `cancelada` y los errores de fila).
 * Presentacional: no sabe de la API. El foco: la confirmación de cancelar
 * lleva el foco a «Volver» (la salida segura) y «Volver» lo devuelve al botón
 * que la abrió; un fallo o el aviso de cancelada lo reciben ellos mismos.
 */
export function InvitacionesPendientes({
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
}: InvitacionesPendientesProps) {
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

  function volver(fila: FilaPendiente) {
    onVolver(fila);
    botonesCancelar.current.get(fila.id)?.focus();
  }

  return (
    <section aria-labelledby="t-pendientes" className={estilos.tarjeta}>
      <div className={estilos.cabecera}>
        <h2 id="t-pendientes" className={estilos.titulo}>
          {PENDIENTES.titulo}
        </h2>
        <span className={estilos.ayuda}>{PENDIENTES.ayuda}</span>
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
            {PENDIENTES.cargando}
          </span>
          {[0, 1, 2].map((n) => (
            <div key={n} aria-hidden="true" className={estilos.esqueleto} />
          ))}
        </div>
      )}

      {estado === 'vacio' && (
        <p role="status" className={estilos.vacia}>
          {PENDIENTES.vacia}
        </p>
      )}

      {estado === 'error' && (
        <AlertaError
          titulo={PENDIENTES.errorLista}
          accion={
            <Button
              type="button"
              variante="secundario"
              className={estilos.reintentar}
              onClick={onReintentar}
            >
              {PENDIENTES.reintentar}
            </Button>
          }
        />
      )}

      {estado === 'filas' && (
        <Tabla titulo={PENDIENTES.tabla}>
          <thead>
            <tr>
              <Th>{PENDIENTES.columnas.correo}</Th>
              <Th>{PENDIENTES.columnas.roles}</Th>
              <Th>{PENDIENTES.columnas.enviada}</Th>
              <Th>{PENDIENTES.columnas.vence}</Th>
              <Th>{PENDIENTES.columnas.invitadaPor}</Th>
              {puedeGestionar && <Th>{PENDIENTES.columnas.acciones}</Th>}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => {
              const abierta = confirmando === fila.id;
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
                    <Td className={estilos.enviada}>{fila.enviada}</Td>
                    <Td>
                      <span
                        className={
                          fila.vencida
                            ? `${estilos.vence} ${estilos.venc}`
                            : estilos.vence
                        }
                      >
                        {fila.vence}
                      </span>
                    </Td>
                    <Td
                      className={
                        fila.invitadaPor === null
                          ? estilos.quienPlataforma
                          : estilos.quien
                      }
                    >
                      {fila.invitadaPor ?? PENDIENTES.plataforma}
                    </Td>
                    {puedeGestionar && (
                      <Td>
                        <div className={estilos.acciones}>
                          <Button
                            type="button"
                            variante="secundario"
                            className={estilos.accion}
                            aria-label={PENDIENTES.ariaReenviar(fila.email)}
                            disabled={ocupado}
                            onClick={() => onReenviar(fila)}
                          >
                            {PENDIENTES.reenviar}
                          </Button>
                          <Button
                            type="button"
                            variante="secundario"
                            className={estilos.accion}
                            aria-label={PENDIENTES.ariaCancelar(fila.email)}
                            aria-expanded={abierta}
                            disabled={ocupado}
                            ref={(el) => {
                              if (el) botonesCancelar.current.set(fila.id, el);
                              else botonesCancelar.current.delete(fila.id);
                            }}
                            onClick={() => onPedirCancelar(fila)}
                          >
                            {PENDIENTES.cancelar}
                          </Button>
                        </div>
                      </Td>
                    )}
                  </tr>
                  {abierta && (
                    <tr>
                      <Td colSpan={columnas} className={estilos.extra}>
                        <div
                          role="group"
                          aria-label={PENDIENTES.confirmarGrupo}
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
                              {PENDIENTES.confirmarSi}
                            </Button>
                            <Button
                              type="button"
                              variante="secundario"
                              className={estilos.accion}
                              ref={refVolver}
                              disabled={ocupado}
                              onClick={() => volver(fila)}
                            >
                              {PENDIENTES.confirmarVolver}
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
