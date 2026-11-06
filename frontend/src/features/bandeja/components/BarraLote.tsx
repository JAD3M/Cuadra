import { Button } from '@/shared/ui/Button';
import { LOTE } from '@/features/bandeja/textos';
import estilos from './BarraLote.module.css';

export interface BarraLoteProps {
  /** Cuántas propuestas están marcadas ahora. */
  marcadas: number;
  /** Cuántas se pueden marcar en esta página. */
  total: number;
  enviando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

/**
 * Barra de la confirmación en lote (mockups 2 y 7): qué es, cuántas hay
 * marcadas y los dos botones. El botón dice cuántas va a confirmar; sin
 * ninguna marcada se deshabilita. Presentacional: no llama a la API.
 */
export function BarraLote({
  marcadas,
  total,
  enviando,
  onConfirmar,
  onCancelar,
}: BarraLoteProps) {
  const sinMarcadas = marcadas === 0;
  return (
    <div role="region" aria-label={LOTE.titulo} className={estilos.barra}>
      <div className={estilos.texto}>
        <strong className={estilos.titulo}>{LOTE.titulo}</strong>
        <span className={estilos.ayuda}>{LOTE.ayuda}</span>
        <span
          role="status"
          className={
            sinMarcadas
              ? `${estilos.contador} ${estilos.aviso}`
              : estilos.contador
          }
        >
          {LOTE.contador(marcadas, total)}
        </span>
      </div>
      <div className={estilos.acciones}>
        <Button variante="secundario" onClick={onCancelar} disabled={enviando}>
          {LOTE.cancelar}
        </Button>
        <Button
          variante="primario"
          tono="conciliado"
          onClick={onConfirmar}
          disabled={enviando || sinMarcadas}
        >
          {enviando ? LOTE.confirmando : LOTE.confirmar(marcadas)}
        </Button>
      </div>
    </div>
  );
}
