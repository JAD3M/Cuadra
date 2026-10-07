import { useEffect, useRef, useState } from 'react';
import { useSessionContext } from '@/shared/sesion';
import { AvisoSoloAdmin } from './components/AvisoSoloAdmin';
import { FormularioTolerancia } from './components/FormularioTolerancia';
import { TarjetaValor } from './components/TarjetaValor';
import { clasificarErrorGuardado, type ClaseErrorGuardado } from './errores';
import estilos from './ToleranciaContenedor.module.css';
import { useGuardarTolerancia } from './useGuardarTolerancia';
import { useTolerancia } from './useTolerancia';
import { derivarFormulario, puedeEditar, vistaValor } from './vista';

/**
 * Contenedor de la pantalla de Tolerancia: la tarjeta del valor con el
 * formulario (administrador) o el aviso de solo lectura (cualquier otro rol).
 * Es el único sitio que junta la sesión, los hooks y el estado de la pantalla;
 * las tarjetas solo reciben props. `TolerPage` lo monta con `key` por época:
 * un cambio de empresa o de cuenta lo desmonta y el borrador, el éxito, la
 * alerta y el foco empiezan de cero sin efectos. Las guardas de época del hook
 * siguen cubriendo lo que resuelve después del cambio.
 *
 * Estado propio: `borrador` (`null` = campo sin tocar, que sigue al valor de
 * la caché), `exito` y `fallo`. Todo lo demás se deriva. Editar quita el éxito
 * y la alerta; enviar de nuevo quita ambos. El éxito persiste hasta editar o
 * salir (sin temporizador).
 *
 * Foco: al enviar el campo y el botón se apagan, así que el foco se decide al
 * resolver. Tras un éxito vuelve al campo; tras un fallo va a la alerta; un
 * 401 o una cancelación no muestran nada y el foco vuelve al campo. Un campo
 * apagado no puede recibirlo: se espera a que `guardando` baje.
 *
 * La tarjeta de cambios recientes se monta en una rebanada posterior.
 */
export function ToleranciaContenedor() {
  const sesion = useSessionContext();
  const valor = useTolerancia();
  const { guardar, isPending: guardando } = useGuardarTolerancia();
  const [borrador, setBorrador] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  // Objeto nuevo en cada fallo: dos fallos seguidos de la misma clase vuelven
  // a llevar el foco a la alerta.
  const [fallo, setFallo] = useState<{ clase: ClaseErrorGuardado } | null>(
    null,
  );
  const campoRef = useRef<HTMLInputElement>(null);
  const alertaRef = useRef<HTMLDivElement>(null);
  const pendienteFoco = useRef<'campo' | 'alerta' | null>(null);

  useEffect(() => {
    const destino = pendienteFoco.current;
    if (destino === null) return;
    if (destino === 'campo') {
      if (guardando) return;
      campoRef.current?.focus();
    } else {
      alertaRef.current?.focus();
    }
    pendienteFoco.current = null;
  }, [guardando, exito, fallo]);

  // La ruta ya exige sesión lista; si no lo está no hay roles que juzgar.
  if (sesion.status !== 'ready') return null;

  const estado = vistaValor({ data: valor.data, error: valor.error });
  const actual = valor.data?.toleranciaMonto;
  const formulario = derivarFormulario({
    borrador,
    actual: actual ?? '',
    guardando,
  });

  function alEscribir(texto: string) {
    setBorrador(texto);
    setExito(false);
    setFallo(null);
  }

  function alGuardar() {
    if (formulario.valorAGuardar === null) return;
    const enviada = guardar(formulario.valorAGuardar, {
      onSuccess: () => {
        // El campo vuelve a seguir al valor de la caché, que ya trae la
        // respuesta del PUT normalizada por el servidor.
        setBorrador(null);
        setExito(true);
        pendienteFoco.current = 'campo';
      },
      onError: (error) => {
        const clase = clasificarErrorGuardado(error);
        if (clase === null) {
          // 401 o cancelación: nada que decir, la capa de sesión actúa.
          pendienteFoco.current = 'campo';
          setFallo(null);
          return;
        }
        pendienteFoco.current = 'alerta';
        setFallo({ clase });
      },
    });
    if (enviada) {
      setExito(false);
      setFallo(null);
    }
  }

  return (
    <div className={estilos.contenedor}>
      <TarjetaValor estado={estado} onReintentar={() => void valor.refetch()}>
        {puedeEditar(sesion.contexto.roles) ? (
          <FormularioTolerancia
            texto={formulario.texto}
            ayuda={formulario.ayuda}
            invalido={formulario.invalido}
            puedeGuardar={formulario.puedeGuardar}
            guardando={guardando}
            exito={exito}
            fallo={fallo?.clase ?? null}
            onCambiar={alEscribir}
            onGuardar={alGuardar}
            campoRef={campoRef}
            alertaRef={alertaRef}
          />
        ) : (
          <AvisoSoloAdmin />
        )}
      </TarjetaValor>
    </div>
  );
}
