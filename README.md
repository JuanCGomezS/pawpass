# PawPass

Plataforma de identificación digital para mascotas. Cada mascota conserva una ficha privada y un perfil público independiente para su QR.

> **Estado:** interfaz conectada a Firebase, acceso con Google, asignación de cupos y edición de mascotas. El rediseño está en validación local. Las pruebas de permisos con Emulator Suite y los recorridos autenticados completos siguen pendientes.

## Stack

- Astro + TypeScript + Tailwind CSS
- GitHub Pages
- Firebase Authentication (Google), Cloud Firestore y Storage

## Ejecutar localmente

```bash
npm install
npm run dev
```

Luego abre la URL que muestra Astro. Para validar la aplicación:

```bash
npm run check
npm test
npm run build
```

## Rutas

| Ruta | Propósito |
| --- | --- |
| `/` | Página comercial |
| `/login/` | Acceso y registro |
| `/mis-mascotas/` | Área privada del responsable |
| `/mis-mascotas/nueva/` | Alta de mascota usando un cupo asignado |
| `/mis-mascotas/mascota/?id=...` | Edición privada de una mascota |
| `/p/?id=luna-7k2` | Perfil QR público compatible con GitHub Pages |
| `/admin/` | Resumen de superadmin |
| `/admin/cuentas/` | Gestión de cuentas y cupos |
| `/admin/mascotas/` | Gestión global de mascotas |

### Por qué el QR usa `?id=`

GitHub Pages sólo sirve archivos estáticos y no resuelve de forma fiable rutas dinámicas como `/p/abc123` tras publicar una mascota. Por eso el MVP estático usa `/p/?id=abc123`. Esta página resuelve el perfil público desde Firestore. Si se migra a hosting con rewrites/SSR, puede exponerse también la ruta estética `/p/abc123`.

## Conectar Firebase

1. Habilita **Authentication** (Google), **Firestore** y **Storage**. El formulario de correo/contraseña no está implementado.
2. Copia las claves web públicas desde Firebase Console a `public/firebase-config.js`.
3. Inicializa la CLI: `firebase login` y `firebase use <project-id>`.
4. Publica la infraestructura:

   ```bash
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

5. Asigna el custom claim `role: superadmin` mediante `scripts/grant-superadmin.mjs` desde un entorno administrativo confiable. **No se debe asignar desde el navegador.**
6. La configuración web pública se carga desde `public/firebase-config.js`. Mantén las credenciales de servicio fuera del repositorio.
7. Prueba las reglas con Emulator Suite antes de desplegar producción.

La guía completa, incluyendo Google Sign-In y GitHub Pages, está en [`FIREBASE_SETUP.md`](./FIREBASE_SETUP.md).

## Modelo de datos

```text
users/{uid}                 email, role: prospect | admin | superadmin
accounts/{accountId}        adminUid, adminEmail, petLimit, status
pets/{petId}                datos privados, accountId, visibilidad
pets/{petId}/vaccines/{id}  registros privados
pets/{petId}/medications/{id}
pets/{petId}/vet-visits/{id}
publicProfiles/{publicId}   sólo la proyección explícitamente pública
```

**Regla de privacidad:** nunca guardes los campos privados y públicos de una mascota en el mismo documento. Firestore no protege campos individualmente.

## GitHub Pages

El dominio público es `https://pawpass.is-local.org/`, servido desde la raíz:

```bash
SITE_URL=https://pawpass.is-local.org/ BASE_PATH=/ npm run build
```

En local, configura `SITE_URL=https://pawpass.is-local.org/` en `.env` y ejecuta `npm run dev`. El workflow usa este dominio por defecto y admite reemplazarlo mediante la variable de Actions `SITE_URL`.

El DNS debe tener un CNAME de `pawpass.is-local.org` a `juancgomezs.github.io`, sin rutas. Coordina el despliegue de `dist/` con la configuración de `pawpass.is-local.org` en **Settings → Pages → Custom domain** y activa HTTPS cuando el certificado esté disponible. Con despliegue mediante Actions, `public/CNAME` no sustituye esa configuración remota.

Autoriza también el hostname en Firebase Authentication y el origen HTTPS en CORS de Storage. No retires los orígenes anteriores durante el cambio. Si vuelves al dominio de GitHub Pages, restaura tanto `SITE_URL` con `/pawpass/` como `BASE_PATH=/pawpass/` en el workflow y retira el dominio personalizado de Pages.

## Acceso y recuperación

- Google crea el acceso de una persona nueva y pide confirmar su nombre. El perfil `users/{uid}` conserva `displayName` y `nameConfirmed`; si el registro queda pendiente, la confirmación reaparece al volver. Los perfiles anteriores sin ese indicador conservan su acceso.
- Correo y contraseña permiten iniciar sesión, sin crear usuarios automáticamente. Con la protección contra enumeración de Firebase, un correo inexistente y una contraseña incorrecta pueden producir el mismo error; no se consulta una lista pública de usuarios para distinguirlos.
- La recuperación utiliza el correo de restablecimiento de Firebase, en español, y recuerda revisar spam. La confirmación no revela si una dirección está registrada. El cambio de contraseña se completa en la página de recuperación de Firebase.
- Confirmar el nombre es un paso de interfaz, no un permiso: las reglas y los roles siguen controlando los datos. No se asignan cuentas de mascotas ni cupos al registrarse.
- El logo de Google en `public/images/google.svg` procede del [recurso oficial de FirebaseUI](https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg), conservando sus colores y aviso de copyright.

## Foto e historial

La portada utiliza la imagen tal como se sube: PNG, JPG o WebP. El selector de presentación permite elegir imagen normal o con zoom; el zoom amplía la foto dentro del encuadre sin modificar el archivo original ni tapar el nombre. No hay recorte automático, modelos de IA, WebGPU ni procesamiento de alfa en el navegador.

Cada subida usa una ruta nueva de Storage para no sobrescribir la foto vigente antes de confirmar el perfil. Si falla el guardado puede quedar un archivo sin referencia, pero el perfil conserva su imagen anterior. Reemplazar una foto no revoca las URLs antiguas ni borra automáticamente esos archivos.

El editor incluye fecha de nacimiento (edad calculada), sexo, peso, presentación, responsable, teléfono, ubicación, alergias y cuidados especiales. Vacunas, consultas veterinarias y medicamentos se guardan como registros independientes en sus subcolecciones privadas, con fecha, próxima fecha, profesional e indicaciones.

Contacto y salud son privados por defecto. Cada registro tiene además una elección explícita de publicación; las proyecciones se guardan en las mismas subcolecciones bajo `publicProfiles/{publicId}`. Desactivar salud impide leer esas proyecciones incluso mediante un enlace directo. Los documentos médicos y archivos adjuntos no se publican.

**Activación pendiente:** el contrato nuevo requiere las reglas actualizadas de `firestore.rules` y `storage.rules`; no se han desplegado en esta intervención. No debe considerarse verificado el guardado remoto ni la protección de las nuevas subcolecciones hasta probar y publicar esas reglas. Las mascotas antiguas sin `publicId` necesitan migración explícita.

Identidad visual y fuentes: [`DESIGN.md`](./DESIGN.md).

## Seguridad pendiente de verificar

Los archivos `firestore.rules`, `storage.rules` e `firestore.indexes.json` son un punto de partida. Antes de producción se deben validar con Emulator Suite los accesos público, admin de cuenta, admin ajeno y superadmin, además de crear pruebas automatizadas de cuota y de publicación.

Consulta [`PLAN.md`](./PLAN.md) para el alcance, decisiones y lista de implementación.
