import { useEffect, useState } from 'react';
import { mensajeDeError } from '@/shared/api';
import {
  useAccionesPlataforma,
  useSesionPlataforma,
} from '@/shared/sesion/plataforma';
import { ControlTema } from '@/shared/tema';
import { AlertaError } from '@/shared/ui/AlertaError';
import { EmpresasPlataforma } from './components/EmpresasPlataforma';
import { EncabezadoPlataforma } from './components/EncabezadoPlataforma';
import estilos from './PlataformaPage.module.css';
import { TEXTOS_PLATAFORMA } from './textos';
import { esFinDeSesion, useEmpresasPlataforma } from './useEmpresasPlataforma';

/**
 * Pantalla interna del dueño. Contenedor: lee la sesión de plataforma y la
 * lista de empresas; los componentes de presentación solo reciben props. No
 * decide nada: muestra lo que devuelve la API. Sin botón de crear empresa
 * (historia 1.4).
 */
export function PlataformaPage() {
  const sesion = useSesionPlataforma();
  const { cerrarSesion, terminar } = useAccionesPlataforma();
  const empresas = useEmpresasPlataforma();
  const [cerrando, setCerrando] = useState(false);

  // Si la API dice que la sesión ya no vale, la guarda lleva al acceso con el
  // aviso de sesión terminada.
  const finDeSesion = esFinDeSesion(empresas.error);
  useEffect(() => {
    if (finDeSesion) terminar();
  }, [finDeSesion, terminar]);

  if (sesion.status !== 'ready') return null;

  const fallo =
    empresas.isError && !finDeSesion ? mensajeDeError(empresas.error) : null;

  return (
    <div className={estilos.pagina}>
      <EncabezadoPlataforma
        correo={sesion.usuario.correo}
        controlTema={<ControlTema />}
        cerrando={cerrando}
        onCerrarSesion={() => {
          setCerrando(true);
          void cerrarSesion();
        }}
      />
      <main className={estilos.principal}>
        <div className={estilos.titulos}>
          <h1 className={estilos.titulo}>{TEXTOS_PLATAFORMA.tituloEmpresas}</h1>
          <p className={estilos.subtitulo}>
            {TEXTOS_PLATAFORMA.subtituloEmpresas}
          </p>
        </div>
        <EmpresasPlataforma
          empresas={empresas.data ?? null}
          alerta={
            fallo ? (
              <AlertaError titulo={fallo.titulo} detalle={fallo.detalle} />
            ) : undefined
          }
        />
      </main>
    </div>
  );
}
