import { useEffect } from 'react';
import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import { useAccionesPlataforma } from '@/shared/sesion/plataforma';
import { AvisoSinDatos } from './components/AvisoSinDatos';
import { EsqueletoMedicion } from './components/EsqueletoMedicion';
import estilos from './components/MedicionPlataforma.module.css';
import { TablaDesacuerdo } from './components/TablaDesacuerdo';
import { TablaFracciones } from './components/TablaFracciones';
import { MarcoPlataforma } from './MarcoPlataforma';
import { TEXTOS_MEDICION_PLATAFORMA as T } from './textos';
import { useDesacuerdoPlataforma } from './useDesacuerdoPlataforma';
import { esFinDeSesion } from './useEmpresasPlataforma';
import { useFraccionesPlataforma } from './useFraccionesPlataforma';
import { vistaMedicionPlataforma } from './vistaMedicionPlataforma';

/**
 * Pantalla «Medición» del dueño (historia 9.2). Contenedor: lee las dos
 * consultas y deja la decisión de qué mostrar a `vistaMedicionPlataforma`; las
 * tablas solo reciben props. No decide nada: muestra lo que devuelve la API.
 */
export function MedicionPlataformaPage() {
  const { terminar } = useAccionesPlataforma();
  const desacuerdo = useDesacuerdoPlataforma();
  const fracciones = useFraccionesPlataforma();

  // Si la API dice que la sesión ya no vale, la guarda lleva al acceso con el
  // aviso de sesión terminada; mientras tanto no se muestra el error de red.
  const finDeSesion =
    esFinDeSesion(desacuerdo.error) || esFinDeSesion(fracciones.error);
  useEffect(() => {
    if (finDeSesion) terminar();
  }, [finDeSesion, terminar]);

  const vista = finDeSesion
    ? ({ tipo: 'cargando' } as const)
    : vistaMedicionPlataforma({
        desacuerdo: {
          cargando: desacuerdo.isPending,
          error: desacuerdo.isError,
          datos: desacuerdo.data,
        },
        fracciones: {
          cargando: fracciones.isPending,
          error: fracciones.isError,
          datos: fracciones.data,
        },
      });

  return (
    <MarcoPlataforma>
      <div className={estilos.titulos}>
        <h1 className={estilos.titulo}>{T.titulo}</h1>
        <p className={estilos.texto}>{T.descripcion}</p>
      </div>
      {vista.tipo === 'cargando' && <EsqueletoMedicion />}
      {vista.tipo === 'error' && (
        <AlertaError
          titulo={T.errorTitulo}
          detalle={T.errorDetalle}
          accion={
            <Button
              type="button"
              variante="secundario"
              onClick={() => {
                void desacuerdo.refetch();
                void fracciones.refetch();
              }}
            >
              {T.reintentar}
            </Button>
          }
        />
      )}
      {vista.tipo === 'listo' && (
        <>
          <section
            aria-labelledby="titulo-desacuerdo"
            className={estilos.seccion}
          >
            <div className={estilos.titulos}>
              <h2 id="titulo-desacuerdo" className={estilos.tituloSeccion}>
                {T.desacuerdoTitulo}
              </h2>
              <p className={estilos.texto}>{T.desacuerdoDescripcion}</p>
            </div>
            {vista.desacuerdo.length === 0 ? (
              <AvisoSinDatos />
            ) : (
              <>
                <TablaDesacuerdo filas={vista.desacuerdo} />
                <p className={estilos.nota}>{T.notaTasa}</p>
              </>
            )}
          </section>
          <section
            aria-labelledby="titulo-fracciones"
            className={estilos.seccion}
          >
            <div className={estilos.titulos}>
              <h2 id="titulo-fracciones" className={estilos.tituloSeccion}>
                {T.fraccionesTitulo}
              </h2>
              <p className={estilos.texto}>{T.fraccionesDescripcion}</p>
            </div>
            <TablaFracciones filas={vista.fracciones} />
            <p className={estilos.nota}>{T.notaFracciones}</p>
          </section>
        </>
      )}
    </MarcoPlataforma>
  );
}
