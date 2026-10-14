import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { AvisoAuth } from '@/features/auth/components/AvisoAuth';
import { LayoutAuth } from '@/features/auth/components/LayoutAuth';
import { mensajeDeError } from '@/shared/api';
import {
  useAccionesPlataforma,
  useSesionPlataforma,
  type EstadoPlataforma,
  type MotivoFinPlataforma,
} from '@/shared/sesion/plataforma';
import { ControlTema } from '@/shared/tema';
import {
  FormularioLoginPlataforma,
  type FalloLoginPlataforma,
} from './components/FormularioLoginPlataforma';
import { PanelMarcaPlataforma } from './components/PanelMarcaPlataforma';
import type { ValoresLoginPlataforma } from './esquemaLogin';
import { AVISOS_PLATAFORMA } from './textos';

function leerMotivo(estado: EstadoPlataforma): MotivoFinPlataforma | null {
  return estado.status === 'ended' ? estado.motivo : null;
}

/**
 * Acceso del dueño. Contenedor: lee la sesión de plataforma y llama a
 * `iniciarSesion`; el formulario solo recibe props. No navega: al iniciar
 * sesión el estado pasa a `ready` y la guarda de `/plataforma/login` redirige.
 *
 * El motivo de una sesión terminada se lee una vez, al montar, a estado
 * local, y entonces se llama a `consumirFin`: el aviso sale una sola vez.
 */
export function PlataformaLoginPage() {
  const estado = useSesionPlataforma();
  const { iniciarSesion, consumirFin } = useAccionesPlataforma();
  const [motivo] = useState(() => leerMotivo(estado));
  const [fallo, setFallo] = useState<FalloLoginPlataforma | null>(null);

  useEffect(() => {
    if (estado.status === 'ended') consumirFin();
  }, [estado.status, consumirFin]);

  // La contraseña viaja en las variables de la mutación; se sueltan de la
  // caché apenas termina, con éxito o con fallo (gcTime 0 las descarta).
  const reiniciar = useRef<() => void>(() => {});
  const acceso = useMutation({
    gcTime: 0,
    mutationFn: (valores: ValoresLoginPlataforma) => iniciarSesion(valores),
    onError: (error) => setFallo(mensajeDeError(error, 'plataforma')),
    onSettled: () => reiniciar.current(),
  });
  useEffect(() => {
    reiniciar.current = acceso.reset;
  });

  const aviso = motivo ? AVISOS_PLATAFORMA[motivo] : null;

  return (
    <LayoutAuth controlTema={<ControlTema />} panel={<PanelMarcaPlataforma />}>
      <FormularioLoginPlataforma
        pendiente={acceso.isPending}
        fallo={acceso.isPending ? null : fallo}
        aviso={aviso ? <AvisoAuth enfocar>{aviso}</AvisoAuth> : undefined}
        onEnviar={(valores) => {
          setFallo(null);
          acceso.mutate(valores);
        }}
      />
    </LayoutAuth>
  );
}
