import { useEffect, useState } from 'react';
import { ApiError, mensajeDeError } from '@/shared/api';
import { normalizarRfc } from '@/shared/dominio';
import {
  useAccionesPlataforma,
  useSesionPlataforma,
} from '@/shared/sesion/plataforma';
import { ControlTema } from '@/shared/tema';
import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import { AvisoEmpresaCreada } from './components/AvisoEmpresaCreada';
import { AvisoInvitacionEnviada } from './components/AvisoInvitacionEnviada';
import { AvisoSeparacionCambiada } from './components/AvisoSeparacionCambiada';
import { AvisoVistaPreviaLevantada } from './components/AvisoVistaPreviaLevantada';
import {
  EmpresasPlataforma,
  type FilaEmpresaPlataforma,
} from './components/EmpresasPlataforma';
import { EncabezadoPlataforma } from './components/EncabezadoPlataforma';
import {
  FormularioCrearEmpresa,
  type ValoresCrearEmpresa,
} from './components/FormularioCrearEmpresa';
import { FormularioCambiarSeparacion } from './components/FormularioCambiarSeparacion';
import { FormularioInvitarAdmin } from './components/FormularioInvitarAdmin';
import { FormularioLevantarVistaPrevia } from './components/FormularioLevantarVistaPrevia';
import { TablaBancos, type FilaBanco } from './components/TablaBancos';
import { describirFalloAlta, type FalloAlta } from './mensajesAlta';
import { describirFalloInvitar, type FalloInvitar } from './mensajesInvitar';
import { describirFalloLevantar, type FalloLevantar } from './mensajesBancos';
import {
  describirFalloSeparacion,
  type FalloSeparacion,
} from './mensajesSeparacion';
import { nombreDeBanco } from './nombreDeBanco';
import estilos from './PlataformaPage.module.css';
import {
  TEXTOS_ALTA_EMPRESA,
  TEXTOS_BANCOS,
  TEXTOS_PLATAFORMA,
} from './textos';
import { useBancosPlataforma } from './useBancosPlataforma';
import { useCambiarSeparacionPlataforma } from './useCambiarSeparacionPlataforma';
import { useCrearEmpresaPlataforma } from './useCrearEmpresaPlataforma';
import { useInvitarAdminPlataforma } from './useInvitarAdminPlataforma';
import { useLevantarVistaPrevia } from './useLevantarVistaPrevia';
import { esFinDeSesion, useEmpresasPlataforma } from './useEmpresasPlataforma';

/**
 * Pantalla interna del dueño. Contenedor: lee la sesión de plataforma y la
 * lista de empresas; los componentes de presentación solo reciben props. No
 * decide nada: muestra lo que devuelve la API. Crear una empresa pasa por la
 * API; el RFC se normaliza aquí solo por comodidad y el servidor decide.
 */
export function PlataformaPage() {
  const sesion = useSesionPlataforma();
  const { cerrarSesion, terminar } = useAccionesPlataforma();
  const empresas = useEmpresasPlataforma();
  const [cerrando, setCerrando] = useState(false);
  const crear = useCrearEmpresaPlataforma();
  const [formAbierto, setFormAbierto] = useState(false);
  const [creada, setCreada] = useState<string | null>(null);
  const [falloAlta, setFalloAlta] = useState<FalloAlta | null>(null);

  const invitar = useInvitarAdminPlataforma();
  const [invitando, setInvitando] = useState<FilaEmpresaPlataforma | null>(
    null,
  );
  const [invitada, setInvitada] = useState<string | null>(null);
  const [falloInvitar, setFalloInvitar] = useState<FalloInvitar | null>(null);

  function abrirInvitar(empresa: FilaEmpresaPlataforma) {
    invitar.reset();
    setInvitada(null);
    setFalloInvitar(null);
    setInvitando(empresa);
  }

  function cerrarInvitar() {
    invitar.reset();
    setFalloInvitar(null);
    setInvitando(null);
  }

  function enviarInvitacion(correo: string) {
    if (!invitando) return;
    setFalloInvitar(null);
    setInvitada(null);
    invitar.mutate(
      { empresaId: invitando.id, email: correo },
      {
        onSuccess: () => {
          // El correo que se muestra es el que se escribió, no el de la
          // respuesta: nada de la pantalla depende de si la cuenta existía.
          setInvitada(correo);
          setInvitando(null);
        },
        onError: (error) => setFalloInvitar(describirFalloInvitar(error)),
      },
    );
  }

  const cambiar = useCambiarSeparacionPlataforma();
  const [cambiando, setCambiando] = useState<FilaEmpresaPlataforma | null>(
    null,
  );
  const [cambiada, setCambiada] = useState<{
    razonSocial: string;
    activa: boolean;
  } | null>(null);
  const [falloCambiar, setFalloCambiar] = useState<FalloSeparacion | null>(
    null,
  );

  function abrirCambiar(empresa: FilaEmpresaPlataforma) {
    cambiar.reset();
    setCambiada(null);
    setFalloCambiar(null);
    setCambiando(empresa);
  }

  function cerrarCambiar() {
    cambiar.reset();
    setFalloCambiar(null);
    setCambiando(null);
  }

  function enviarCambio(motivo: string) {
    if (!cambiando) return;
    // El estado que se pide es el contrario al que muestra la fila; el
    // servidor decide (409 si ya estaba así).
    const activa = !cambiando.separacionFunciones;
    const razonSocial = cambiando.razonSocial;
    setFalloCambiar(null);
    setCambiada(null);
    cambiar.mutate(
      { empresaId: cambiando.id, activa, motivo },
      {
        onSuccess: () => {
          setCambiada({ razonSocial, activa });
          setCambiando(null);
        },
        onError: (error) => {
          const fallo = describirFalloSeparacion(error);
          setFalloCambiar(fallo);
          // Un fallo de alerta (409, 404, red) cierra el panel solo si el
          // servidor ya contestó con un estado; con la red caída se conserva
          // lo escrito.
          if (
            fallo?.donde === 'alerta' &&
            error instanceof ApiError &&
            (error.statusCode === 409 || error.statusCode === 404)
          ) {
            setCambiando(null);
          }
        },
      },
    );
  }

  const bancos = useBancosPlataforma();
  const levantar = useLevantarVistaPrevia();
  const [levantando, setLevantando] = useState<FilaBanco | null>(null);
  const [levantado, setLevantado] = useState<string | null>(null);
  const [falloLevantar, setFalloLevantar] = useState<FalloLevantar | null>(
    null,
  );

  function abrirLevantar(banco: FilaBanco) {
    levantar.reset();
    setLevantado(null);
    setFalloLevantar(null);
    setLevantando(banco);
  }

  function cerrarLevantar() {
    levantar.reset();
    setFalloLevantar(null);
    setLevantando(null);
  }

  function confirmarLevantar() {
    if (!levantando) return;
    const nombre = nombreDeBanco(levantando.banco);
    setFalloLevantar(null);
    setLevantado(null);
    levantar.mutate(levantando.banco, {
      onSuccess: () => {
        setLevantado(nombre);
        setLevantando(null);
      },
      onError: (error) => {
        setFalloLevantar(describirFalloLevantar(error));
        // Un 409 o un 422 ya no admiten confirmar lo mismo: el panel se cierra
        // y la lista (vuelta a pedir) muestra el estado real.
        setLevantando(null);
        void bancos.refetch();
      },
    });
  }

  function abrirFormulario() {
    setCreada(null);
    setFalloAlta(null);
    setFormAbierto(true);
  }

  function cerrarFormulario() {
    setFalloAlta(null);
    setFormAbierto(false);
  }

  function enviarAlta(valores: ValoresCrearEmpresa) {
    setFalloAlta(null);
    setCreada(null);
    const cuerpo = {
      razonSocial: valores.razonSocial.trim(),
      rfc: normalizarRfc(valores.rfc),
    };
    crear.mutate(cuerpo, {
      onSuccess: (empresa) => {
        setCreada(empresa.razonSocial);
        setFormAbierto(false);
      },
      onError: (error) => setFalloAlta(describirFalloAlta(error, cuerpo)),
    });
  }

  // Si la API dice que la sesión ya no vale, la guarda lleva al acceso con el
  // aviso de sesión terminada.
  const finDeSesion =
    esFinDeSesion(empresas.error) ||
    esFinDeSesion(crear.error) ||
    esFinDeSesion(invitar.error) ||
    esFinDeSesion(cambiar.error) ||
    esFinDeSesion(bancos.error) ||
    esFinDeSesion(levantar.error);
  useEffect(() => {
    if (finDeSesion) terminar();
  }, [finDeSesion, terminar]);

  if (sesion.status !== 'ready') return null;

  const fallo =
    empresas.isError && !finDeSesion ? mensajeDeError(empresas.error) : null;

  const falloBancos =
    bancos.isError && !finDeSesion ? mensajeDeError(bancos.error) : null;

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
        <div className={estilos.cabecera}>
          <div className={estilos.titulos}>
            <h1 className={estilos.titulo}>
              {TEXTOS_PLATAFORMA.tituloEmpresas}
            </h1>
            <p className={estilos.subtitulo}>
              {TEXTOS_PLATAFORMA.subtituloEmpresas}
            </p>
          </div>
          <Button
            type="button"
            className={estilos.crear}
            onClick={abrirFormulario}
          >
            {TEXTOS_ALTA_EMPRESA.crear}
          </Button>
        </div>
        {creada !== null && <AvisoEmpresaCreada razonSocial={creada} />}
        {falloAlta?.donde === 'alerta' && (
          <AlertaError titulo={falloAlta.titulo} detalle={falloAlta.detalle} />
        )}
        {formAbierto && (
          <FormularioCrearEmpresa
            pendiente={crear.isPending}
            errorRazonSocial={
              falloAlta?.donde === 'campo' && falloAlta.campo === 'razonSocial'
                ? falloAlta.texto
                : undefined
            }
            errorRfc={
              falloAlta?.donde === 'campo' && falloAlta.campo === 'rfc'
                ? falloAlta.texto
                : undefined
            }
            onEnviar={enviarAlta}
            onCancelar={cerrarFormulario}
          />
        )}
        {invitada !== null && <AvisoInvitacionEnviada correo={invitada} />}
        {falloInvitar?.donde === 'alerta' && (
          <AlertaError
            titulo={falloInvitar.titulo}
            detalle={falloInvitar.detalle}
          />
        )}
        {invitando && (
          <FormularioInvitarAdmin
            key={invitando.id}
            razonSocial={invitando.razonSocial}
            pendiente={invitar.isPending}
            errorCorreo={
              falloInvitar?.donde === 'campo' ? falloInvitar.texto : undefined
            }
            onEnviar={enviarInvitacion}
            onCancelar={cerrarInvitar}
          />
        )}
        {cambiada !== null && (
          <AvisoSeparacionCambiada
            razonSocial={cambiada.razonSocial}
            activa={cambiada.activa}
          />
        )}
        {falloCambiar?.donde === 'alerta' && (
          <AlertaError
            titulo={falloCambiar.titulo}
            detalle={falloCambiar.detalle}
          />
        )}
        {cambiando && (
          <FormularioCambiarSeparacion
            key={cambiando.id}
            razonSocial={cambiando.razonSocial}
            desactivar={cambiando.separacionFunciones}
            pendiente={cambiar.isPending}
            errorMotivo={
              falloCambiar?.donde === 'campo' ? falloCambiar.texto : undefined
            }
            onEnviar={enviarCambio}
            onCancelar={cerrarCambiar}
          />
        )}
        <EmpresasPlataforma
          empresas={empresas.data ?? null}
          onCrear={abrirFormulario}
          onInvitar={abrirInvitar}
          onCambiarSeparacion={abrirCambiar}
          alerta={
            fallo ? (
              <AlertaError titulo={fallo.titulo} detalle={fallo.detalle} />
            ) : undefined
          }
        />
        <section aria-labelledby="titulo-bancos" className={estilos.bancos}>
          <div className={estilos.titulos}>
            <h2 id="titulo-bancos" className={estilos.subtituloSeccion}>
              {TEXTOS_BANCOS.titulo}
            </h2>
            <p className={estilos.subtitulo}>{TEXTOS_BANCOS.descripcion}</p>
          </div>
          {levantado !== null && (
            <AvisoVistaPreviaLevantada banco={levantado} />
          )}
          {falloLevantar && (
            <AlertaError
              titulo={falloLevantar.titulo}
              detalle={falloLevantar.detalle}
            />
          )}
          {levantando && (
            <FormularioLevantarVistaPrevia
              key={levantando.banco}
              banco={nombreDeBanco(levantando.banco)}
              pendiente={levantar.isPending}
              onConfirmar={confirmarLevantar}
              onCancelar={cerrarLevantar}
            />
          )}
          <TablaBancos
            bancos={bancos.data ?? null}
            onLevantar={abrirLevantar}
            alerta={
              falloBancos ? (
                <AlertaError
                  titulo={falloBancos.titulo}
                  detalle={falloBancos.detalle}
                />
              ) : undefined
            }
          />
        </section>
      </main>
    </div>
  );
}
