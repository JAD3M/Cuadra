import { useEffect, useId, useRef, type ReactNode, type Ref } from 'react';
import {
  REGLAS_ESTADO_CUENTA,
  REGLAS_ESTADO_CUENTA_PDF,
  evaluarSeleccion,
} from '@/features/cargas/seleccion';
import {
  REINTENTAR,
  ELEGIR_ARCHIVO,
  FORMATO_ESTADO_CUENTA,
  LEYENDO,
  RECHAZO_ESTADO_CUENTA,
  RECHAZO_ESTADO_CUENTA_PDF,
  SUBIENDO,
  TARJETA_ESTADO_CUENTA,
  TARJETA_ESTADO_CUENTA_PDF,
} from '@/features/cargas/textos';
import { LIMITES_CARGA, type ModoEstadoCuenta } from '@/shared/dominio';
import { Button } from '@/shared/ui/Button';
import { AvisoYaExistia } from './AvisoYaExistia';
import { CampoCuenta } from './CampoCuenta';
import { CampoPerfil } from './CampoPerfil';
import { ListaArchivos } from './ListaArchivos';
import { RegionResultado } from './RegionResultado';
import { SelectorArchivos } from './SelectorArchivos';
import campos from './campos.module.css';
import estilos from './tarjeta.module.css';

export interface TarjetaEstadoCuentaProps {
  /** Formato del estado de cuenta; por omisión CSV (se importa). El PDF solo se lee. */
  modo?: ModoEstadoCuenta;
  onModo?: (modo: ModoEstadoCuenta) => void;
  /** El archivo elegido (CSV o PDF, según el modo), sin filtrar; `null` si aún no hay. */
  archivo: File | null;
  banco: string;
  cuenta: string;
  /** `undefined` mientras cargan o si la lista falló. */
  perfiles: readonly { id: string }[] | undefined;
  /** La lista de perfiles falló: el select queda apagado con Reintentar. */
  perfilesFallo: boolean;
  /** El perfil elegido, ya resuelto; `null` si no hay perfiles. */
  perfil: string | null;
  /** Rol de solo lectura: todo queda deshabilitado, no oculto. */
  deshabilitada: boolean;
  /** Esta tarjeta tiene una subida en curso (solo ella se apaga, M13). */
  subiendo: boolean;
  /** Cada elección REEMPLAZA al archivo anterior (M16). */
  onSeleccionar: (archivo: File | null) => void;
  onBanco: (banco: string) => void;
  /** El banco del PDF (`id` de `GET /bancos/pdf`); el CSV usa `banco`, texto libre. */
  /** Los bancos con lector de PDF, de `GET /bancos/pdf`; `undefined` mientras cargan o si falló. */
  bancos: readonly { id: string; nombre: string }[] | undefined;
  /** La lista de bancos falló: el select queda apagado con aviso y Reintentar. */
  bancosFallo: boolean;
  onReintentarBancos: () => void;
  bancoPdf: string;
  onBancoPdf: (banco: string) => void;
  /** El servidor pidió la contraseña de un PDF protegido (historia 8.2). */
  pideContrasena: boolean;
  contrasena: string;
  onContrasena: (contrasena: string) => void;
  onCuenta: (cuenta: string) => void;
  onPerfil: (id: string) => void;
  onReintentarPerfiles: () => void;
  /** Solo si el archivo está aceptado: un rechazado nunca se envía. */
  onSubir: (archivo: File) => void;
  /** Para mover el foco a la región de estado al enviar. */
  regionRef?: Ref<HTMLDivElement>;
  /** El resultado de la carga recién subida de esta tarjeta; lo anuncia la región. */
  resultado?: ReactNode;
  /** La alerta de una subida que falló en esta tarjeta; fuera de la región de estado, tiene su propio `role="alert"`. */
  alerta?: ReactNode;
}

function botonTexto(esPdf: boolean, subiendo: boolean): string {
  if (esPdf) {
    return subiendo ? LEYENDO : TARJETA_ESTADO_CUENTA_PDF.leer;
  }
  return subiendo ? SUBIENDO : TARJETA_ESTADO_CUENTA.subir;
}

const MODOS: readonly { modo: ModoEstadoCuenta; texto: string }[] = [
  { modo: 'csv', texto: FORMATO_ESTADO_CUENTA.csv },
  { modo: 'pdf', texto: FORMATO_ESTADO_CUENTA.pdf },
];

/**
 * Tarjeta de estado de cuenta. En modo CSV: banco, cuenta, perfil, un CSV y el
 * botón de subir. En modo PDF (historia 3.2): solo el banco (fijo), un PDF y el
 * botón de leer; no se importa nada. Solo presentación; el estado y el envío
 * viven en el contenedor.
 */
export function TarjetaEstadoCuenta({
  modo = 'csv',
  onModo,
  archivo,
  banco,
  cuenta,
  perfiles,
  perfil,
  perfilesFallo,
  deshabilitada,
  subiendo,
  onSeleccionar,
  onBanco,
  bancos,
  bancosFallo,
  onReintentarBancos,
  bancoPdf,
  onBancoPdf,
  pideContrasena,
  contrasena,
  onContrasena,
  onCuenta,
  onPerfil,
  onReintentarPerfiles,
  onSubir,
  regionRef,
  resultado,
  alerta,
}: TarjetaEstadoCuentaProps) {
  const idTitulo = useId();
  const idBanco = useId();
  const idContrasena = useId();
  const idContrasenaAyuda = `${idContrasena}-ayuda`;
  const campoContrasena = useRef<HTMLInputElement>(null);
  const inactiva = deshabilitada || subiendo;
  const esPdf = modo === 'pdf';
  const reglas = esPdf ? REGLAS_ESTADO_CUENTA_PDF : REGLAS_ESTADO_CUENTA;
  const evaluados = evaluarSeleccion(archivo === null ? [] : [archivo], reglas);
  const aceptado = evaluados[0]?.motivo === null ? archivo : null;
  const pedirContrasena = esPdf && pideContrasena;

  // El foco pasa al campo en cuanto el servidor pide la contraseña.
  useEffect(() => {
    if (pedirContrasena) campoContrasena.current?.focus();
  }, [pedirContrasena]);

  return (
    <section className={estilos.tarjeta} aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className={`${estilos.rotulo} ${estilos.rotuloCsv}`}>
        {TARJETA_ESTADO_CUENTA.titulo}
      </h2>
      <div
        className={estilos.modos}
        role="group"
        aria-label={FORMATO_ESTADO_CUENTA.grupo}
      >
        {MODOS.map(({ modo: m, texto }) => (
          <button
            key={m}
            type="button"
            className={estilos.modo}
            aria-pressed={modo === m}
            disabled={subiendo}
            onClick={() => onModo?.(m)}
          >
            {texto}
          </button>
        ))}
      </div>
      <div className={estilos.rejilla}>
        {esPdf ? (
          <>
            <div className={`${campos.campo} ${estilos.ancha}`}>
              <label htmlFor={idBanco} className={campos.etiqueta}>
                {TARJETA_ESTADO_CUENTA.banco}
              </label>
              <select
                id={idBanco}
                className={campos.control}
                value={bancoPdf}
                disabled={inactiva || bancos === undefined}
                onChange={(e) => onBancoPdf(e.target.value)}
              >
                {bancos === undefined ? (
                  <option value="">
                    {TARJETA_ESTADO_CUENTA_PDF.cargandoBancos}
                  </option>
                ) : (
                  bancos.map((banco) => (
                    <option key={banco.id} value={banco.id}>
                      {banco.nombre}
                    </option>
                  ))
                )}
              </select>
              {bancosFallo ? (
                <span className={campos.errorPerfiles}>
                  {TARJETA_ESTADO_CUENTA_PDF.errorBancos}
                  <button
                    type="button"
                    className={campos.enlace}
                    disabled={deshabilitada}
                    onClick={onReintentarBancos}
                  >
                    {REINTENTAR}
                  </button>
                </span>
              ) : null}
            </div>
            {pedirContrasena ? (
              <div className={`${campos.campo} ${estilos.ancha}`}>
                <label htmlFor={idContrasena} className={campos.etiqueta}>
                  {TARJETA_ESTADO_CUENTA_PDF.contrasena}
                </label>
                <input
                  ref={campoContrasena}
                  id={idContrasena}
                  type="password"
                  autoComplete="off"
                  className={campos.control}
                  value={contrasena}
                  maxLength={LIMITES_CARGA.estadoCuentaPdf.maxContrasena}
                  disabled={inactiva}
                  aria-describedby={idContrasenaAyuda}
                  onChange={(e) => onContrasena(e.target.value)}
                />
                <p id={idContrasenaAyuda} className={campos.ayuda}>
                  {TARJETA_ESTADO_CUENTA_PDF.contrasenaAyuda}
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className={campos.campo}>
              <label htmlFor={idBanco} className={campos.etiqueta}>
                {TARJETA_ESTADO_CUENTA.banco}
              </label>
              <input
                id={idBanco}
                className={campos.control}
                value={banco}
                maxLength={LIMITES_CARGA.estadoCuenta.maxBanco}
                disabled={inactiva}
                onChange={(e) => onBanco(e.target.value)}
              />
            </div>
            <CampoCuenta
              valor={cuenta}
              onCambiar={onCuenta}
              deshabilitado={inactiva}
            />
            <div className={estilos.ancha}>
              <CampoPerfil
                perfiles={perfiles}
                fallo={perfilesFallo}
                valor={perfil ?? ''}
                onCambiar={onPerfil}
                onReintentar={onReintentarPerfiles}
                deshabilitado={inactiva}
              />
            </div>
          </>
        )}
      </div>
      {esPdf ? (
        <div role="status">
          <AvisoYaExistia
            frases={[
              TARJETA_ESTADO_CUENTA_PDF.soloLectura,
              ...(pedirContrasena
                ? [TARJETA_ESTADO_CUENTA_PDF.pideContrasena]
                : []),
            ]}
          />
        </div>
      ) : null}
      <div className={estilos.elegir}>
        <SelectorArchivos
          etiqueta={ELEGIR_ARCHIVO}
          accept={reglas.extension}
          variante="secundario"
          deshabilitado={inactiva}
          onElegir={(archivos) => onSeleccionar(archivos[0] ?? null)}
        />
      </div>
      <ListaArchivos
        archivos={evaluados}
        motivos={esPdf ? RECHAZO_ESTADO_CUENTA_PDF : RECHAZO_ESTADO_CUENTA}
        rotulo={TARJETA_ESTADO_CUENTA.archivo}
        apagada={subiendo}
      />
      <div className={estilos.pie}>
        <span className={estilos.ayuda}>
          {esPdf
            ? TARJETA_ESTADO_CUENTA_PDF.limites
            : TARJETA_ESTADO_CUENTA.limites}
        </span>
        <Button
          tono="sin_match"
          disabled={
            inactiva || aceptado === null || (esPdf && bancos === undefined)
          }
          onClick={() => {
            if (aceptado !== null) onSubir(aceptado);
          }}
        >
          {botonTexto(esPdf, subiendo)}
        </Button>
      </div>
      <RegionResultado subiendo={subiendo && !esPdf} regionRef={regionRef}>
        {resultado}
      </RegionResultado>
      {alerta}
      <p className={estilos.nota}>{TARJETA_ESTADO_CUENTA.nota}</p>
    </section>
  );
}
