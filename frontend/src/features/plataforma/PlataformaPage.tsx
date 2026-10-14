import { useEffect, useState } from 'react';
import { mensajeDeError } from '@/shared/api';
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
import {
  EmpresasPlataforma,
  type FilaEmpresaPlataforma,
} from './components/EmpresasPlataforma';
import { EncabezadoPlataforma } from './components/EncabezadoPlataforma';
import {
  FormularioCrearEmpresa,
  type ValoresCrearEmpresa,
} from './components/FormularioCrearEmpresa';
import { FormularioInvitarAdmin } from './components/FormularioInvitarAdmin';
import { describirFalloAlta, type FalloAlta } from './mensajesAlta';
import { describirFalloInvitar, type FalloInvitar } from './mensajesInvitar';
import estilos from './PlataformaPage.module.css';
import { TEXTOS_ALTA_EMPRESA, TEXTOS_PLATAFORMA } from './textos';
import { useCrearEmpresaPlataforma } from './useCrearEmpresaPlataforma';
import { useInvitarAdminPlataforma } from './useInvitarAdminPlataforma';
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
    esFinDeSesion(invitar.error);
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
        <EmpresasPlataforma
          empresas={empresas.data ?? null}
          onCrear={abrirFormulario}
          onInvitar={abrirInvitar}
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
