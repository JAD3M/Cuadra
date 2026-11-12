# Cómo anonimizar un estado de cuenta real

Si una persona consigue un estado de cuenta real con su asesor o su banco para
probar el lector, **nunca se sube al repositorio**. Ni el original ni una copia
«casi limpia». Se usa solo en tu máquina.

## Antes de usarlo, quita:

- **Nombre** del titular, domicilio y cualquier razón social.
- **Número de cuenta**, **CLABE** y número de tarjeta, completos o parciales.
- **RFC** del titular y de quien aparezca en los movimientos.
- Nombres de personas o empresas en las descripciones y referencias.

Reemplázalos con datos inventados y marca el archivo como sintético: la primera
línea del PDF debe decir `DOCUMENTO SINTETICO - SIN DATOS REALES`.

## Dónde dejarlo

- Guárdalo en `ejemplos/real/` o ponle `.real.` en el nombre (por ejemplo
  `bbva-septiembre.real.pdf`). Las dos formas están en `.gitignore`.
- Si aun así se agrega a git, la prueba `src/ejemplos/ejemplos-bbva.spec.ts`
  falla: todo archivo de `ejemplos/` debe estar en `MANIFIESTO.json` como
  `sintetico` o `publico`.

## Si ya lo subiste por error

Avisa antes de hacer nada más: quitarlo del último commit no basta, queda en el
historial. Hay que reescribirlo y cambiar lo que se haya expuesto.
