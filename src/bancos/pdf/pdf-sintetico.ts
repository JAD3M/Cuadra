// SINTÉTICO: PDFs mínimos generados en memoria para pruebas. Sin datos reales.

/** Arma un PDF de una página; con `lineas` vacío la página no tiene texto. */
export function construirPdfSintetico(lineas: string[]): Buffer {
  const escapar = (s: string) => s.replace(/([\\()])/g, '\\$1');
  const contenido = lineas.length
    ? `BT /F1 12 Tf 14 TL 50 700 Td ${lineas
        .map((l) => `(${escapar(l)}) Tj T*`)
        .join(' ')} ET`
    : '';
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objetos.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) pdf += `${String(o).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
