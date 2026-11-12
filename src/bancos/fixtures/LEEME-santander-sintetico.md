# santander-sintetico.pdf y santander-protegido-sintetico.pdf

SINTÉTICO [SUPUESTO]: el primero se generó con `construirPdfSintetico`
(`src/bancos/pdf/pdf-sintetico.ts`) y el segundo es el mismo contenido cifrado
con Ghostscript (`gs -sDEVICE=pdfwrite -sUserPassword=clave-prueba
-sOwnerPassword=duenio-prueba`). La contraseña para abrirlo es `clave-prueba`;
no protege nada real. Ninguno es un estado de cuenta real de Santander ni trae
datos reales: dicen "DOCUMENTO SINTETICO - SIN DATOS REALES". El layout
(cuenta empresarial) es el acordado en la historia 8.2 y debe validarse con un
estado de cuenta empresarial anonimizado, igual que la idea de que Santander
proteja sus PDF con contraseña.
