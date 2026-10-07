import { useEffect, useId, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { Paginacion } from '@/shared/ui/Paginacion';
import { paginaMaxima } from '@/shared/ui/paginas';
import { ErrorBitacora, VacioBitacora } from './components/EstadosBitacora';
import {
  FiltrosBitacora,
  type CambioFiltros,
  type EstadoUsuarios,
} from './components/FiltrosBitacora';
import { TablaBitacora } from './components/TablaBitacora';
import { LIMITE_PAGINA } from './constantes';
import { armarConsulta } from './consulta';
import { clasificarErrorBitacora } from './errores';
import { cambiar, esPorDefecto, leerFiltros, serializar } from './filtrosUrl';
import { EVENTOS } from './textos';
import { useBitacora } from './useBitacora';
import { useUsuariosBitacora } from './useUsuariosBitacora';
import estilos from './BitacoraPage.module.css';

/**
 * Pantalla de la bitácora (contenedor). Los filtros y la página viven en la
 * URL: se leen con tolerancia, se normalizan con `replace` y se escriben en
 * forma canónica. Es de solo lectura: solo hace GET y no ofrece editar ni
 * borrar. Con el rango invertido no se envía nada y la lista queda vacía (el
 * aviso lo pone el formulario). El título y el subtítulo los pone el
 * encabezado del shell desde el `handle` de la ruta.
 */
export function BitacoraPage() {
  const [params, setParams] = useSearchParams();
  const filtros = leerFiltros(params);
  const canonica = serializar(filtros);
  const resultados = useRef<HTMLDivElement>(null);
  const idEventos = useId();

  // Una URL no canónica (valor inválido, clave ajena, página 1 explícita) se
  // reescribe sin crear historial. La consulta ya usa los valores leídos.
  const actual = params.toString();
  useEffect(() => {
    if (canonica !== actual) setParams(canonica, { replace: true });
  }, [canonica, actual, setParams]);

  const consulta = armarConsulta(filtros);
  const lista = useBitacora(consulta);
  const personas = useUsuariosBitacora();
  const { data } = lista;

  // Página que ya no existe (enlace viejo o datos que se redujeron): se pasa a
  // la última válida sin historial, y mientras tanto no se muestra el vacío.
  const ultima = data ? paginaMaxima(data.total, LIMITE_PAGINA) : 1;
  const fueraDeRango =
    data !== undefined && !lista.isPlaceholderData && filtros.pagina > ultima;
  useEffect(() => {
    if (fueraDeRango) {
      setParams(serializar({ ...filtros, pagina: ultima }), { replace: true });
    }
  }, [fueraDeRango, filtros, ultima, setParams]);

  function cambiarFiltros(cambio: CambioFiltros) {
    setParams(serializar(cambiar(filtros, cambio)), { replace: true });
  }

  function irAPagina(pagina: number) {
    setParams(serializar({ ...filtros, pagina }));
    resultados.current?.focus();
  }

  function restablecer() {
    setParams('', { replace: true });
  }

  const usuarios: EstadoUsuarios = personas.isError
    ? { tipo: 'error' }
    : personas.data
      ? { tipo: 'lista', usuarios: personas.data }
      : { tipo: 'cargando' };

  const claseError = lista.isError
    ? clasificarErrorBitacora(lista.error)
    : null;
  const esqueleto =
    consulta !== null &&
    (lista.isPending ||
      fueraDeRango ||
      (lista.isPlaceholderData && data?.datos.length === 0));
  const ocupada = esqueleto || lista.isPlaceholderData;

  return (
    <div className={estilos.pagina}>
      <FiltrosBitacora
        filtros={filtros}
        usuarios={usuarios}
        onCambiar={cambiarFiltros}
      />
      <section className={estilos.tarjeta} aria-labelledby={idEventos}>
        <h2 id={idEventos} className="solo-lectores">
          {EVENTOS}
        </h2>
        <div
          ref={resultados}
          tabIndex={-1}
          aria-busy={ocupada}
          className={estilos.resultados}
        >
          {consulta === null ? null : lista.isError ? (
            claseError === null ? null : (
              <ErrorBitacora
                clase={claseError}
                onReintentar={() => void lista.refetch()}
              />
            )
          ) : esqueleto ? (
            <TablaBitacora eventos={[]} cargando />
          ) : data && data.total === 0 ? (
            <VacioBitacora
              conFiltros={!esPorDefecto(filtros)}
              onRestablecer={restablecer}
            />
          ) : data ? (
            <>
              <TablaBitacora eventos={data.datos} />
              <Paginacion
                pagina={data.pagina}
                total={data.total}
                limite={LIMITE_PAGINA}
                onIr={irAPagina}
              />
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
