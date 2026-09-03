# Mi Estantería

Una aplicación personal para medir el tiempo de lectura, registrar páginas, estimar cuándo terminarás cada libro y colocar los libros completados en una estantería visual.

## Funciones

- Añadir varios libros con título, autor, ISBN, portada, páginas totales y página actual.
- Cronómetro de lectura que continúa aunque recargues la página.
- Registro de páginas al terminar cada sesión.
- Estimación automática del tiempo y la fecha de finalización según tu ritmo real.
- Estadísticas diarias y mensuales.
- Estantería visual de libros terminados.
- Guardado privado en `localStorage`, sin cuentas ni servidor.

## Desarrollo local

Requiere Node.js 22 y pnpm.

```bash
pnpm install
pnpm dev
```

## GitHub y Vercel

El repositorio puede subirse directamente a GitHub. Vercel detectará Next.js y ejecutará automáticamente `pnpm vercel-build`.

Para la tarjeta social, configura `NEXT_PUBLIC_SITE_URL` con la URL pública final del proyecto. Vercel también puede resolverla mediante su variable de entorno `VERCEL_PROJECT_PRODUCTION_URL`.

Los datos de lectura viven en el navegador de cada dispositivo. Para sincronización entre dispositivos haría falta añadir autenticación y una base de datos en una fase posterior.
