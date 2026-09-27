# Documentación técnica y auditoría --- Calendario

## 1. Resumen

La aplicación es un calendario de planes construido con PHP, MySQL,
JavaScript y Tailwind CSS.

La estructura principal es:

-   `public/index.php`: interfaz HTML del calendario y los modales.
-   `public/assets/app.js`: lógica del navegador, eventos, renderizado y
    llamadas AJAX.
-   `public/api.php`: API interna que crea, consulta, actualiza y
    elimina datos.
-   `src/bootstrap.php`: arranque común, sesión, CSRF, conexión a MySQL
    y funciones auxiliares.
-   `src/backup.php`: creación, listado, restauración y eliminación de
    copias SQL.
-   `public/export.php`: exportación de planes a Excel.
-   `public/login.php`: autenticación del administrador.
-   `database/schema.sql`: estructura inicial de la base de datos.

## 2. Error principal encontrado

El error:

`Uncaught TypeError: Cannot set properties of null (setting 'onclick')`

se producía porque `app.js` intentaba hacer:

`$("#btnCreateBackup").onclick = ...`

pero `index.php` no tenía ningún elemento con `id="btnCreateBackup"`.

Como el error ocurría mientras el navegador estaba interpretando el
archivo JavaScript, la ejecución se detenía en ese punto. Esto podía dar
la impresión de que otras partes de la aplicación estaban dañadas,
aunque el problema real era un único selector inexistente.

### Corrección

Se añadió el botón `Crear copia` al panel de copias de seguridad y,
además, el JavaScript ahora usa un listener defensivo:

`$("#btnCreateBackup")?.addEventListener(...)`

De esta manera, una vista antigua o personalizada que no tenga ese botón
no vuelve a detener todo `app.js`.

## 3. Bugs y riesgos corregidos

### 3.1 Respuestas AJAX que no eran JSON

Antes, `api()` ejecutaba directamente `response.json()`.

Si PHP producía un warning, un error 500 o una página HTML, el navegador
podía mostrar un error poco claro como `Unexpected token < in JSON`.

Ahora se lee primero el texto y se intenta convertir a JSON. Si el
servidor devuelve algo distinto, se informa con el código HTTP y un
mensaje entendible.

### 3.2 Errores asíncronos sin controlar

Varias operaciones usaban `await api(...)` sin `try/catch`.

Se corrigieron las operaciones de:

-   eliminar o cambiar un plan;
-   crear registros de lugares, instructores y cursos;
-   eliminar registros de catálogos;
-   crear, restaurar y eliminar backups.

Esto evita promesas rechazadas sin controlar y permite mostrar el error
al usuario.

### 3.3 Buscador con respuestas fuera de orden

El buscador espera 350 ms antes de consultar la API. Si el usuario
escribe varias búsquedas rápidamente, una respuesta lenta de una
búsqueda anterior podía llegar después de una búsqueda nueva y
sobrescribir la pantalla.

Ahora cada búsqueda tiene un identificador. Las respuestas antiguas se
descartan.

### 3.4 Buscador incompleto

El texto de la interfaz indicaba que se podía buscar curso, instructor y
fecha, pero el backend únicamente buscaba en `title`.

La consulta ahora busca también en:

-   título;
-   descripción/notas;
-   nombre del instructor;
-   nombre del curso;
-   fecha.

### 3.5 Validación insuficiente de horas

La API comprobaba solamente que la hora tuviera forma `00:00`, pero
valores como `99:99` podían superar esa expresión regular.

Ahora se valida que:

-   hora: 00--23;
-   minutos: 00--59.

### 3.6 Asociación de catálogos sin validar propietario

Antes se podía enviar directamente un `lugar_id`, `instructor_id` o
`curso_id`.

Aunque los registros estaban relacionados con usuarios, la
creación/actualización de un plan no comprobaba que esos IDs
pertenecieran al usuario actual.

Ahora la API verifica la propiedad antes de guardar el plan.

### 3.7 Backups desactualizados respecto al esquema

El esquema actual tiene:

-   hora final;
-   lugar;
-   instructor;
-   curso.

El backup antiguo solamente guardaba los campos originales.

Ahora las copias nuevas conservan también esos campos. La restauración
mantiene compatibilidad con copias antiguas de 10 valores y copias
nuevas de 14 valores.

### 3.8 Restauración segura por usuario

Al restaurar, los planes se crean como planes del usuario que está
ejecutando la restauración.

El `user_id` guardado dentro de la copia no se utiliza para crear planes
bajo otra cuenta.

### 3.9 Limpieza de objetos temporales del navegador

Al descargar un backup, el navegador crea un `ObjectURL`. Ahora ese
recurso se libera después de iniciar la descarga para evitar acumulación
innecesaria de memoria.

## 4. Cómo funciona la aplicación

### Inicio

Cuando se abre `index.php`:

1.  PHP inicia la sesión.
2.  Comprueba que el usuario sea administrador.
3.  Inserta el token CSRF en una etiqueta `<meta>`.
4.  Carga `app.js`.
5.  JavaScript carga catálogos y datos del calendario.

La inicialización usa `Promise.allSettled()`. Si falla un catálogo, el
calendario puede seguir intentando funcionar y el error queda registrado
en la consola.

### Calendario

El calendario mantiene dos datos principales:

-   `view`: mes que se está visualizando.
-   `selected`: día seleccionado.

Los planes del mes se cargan mediante:

`api.php?action=list&month=AAAA-MM`

Al seleccionar un día, solamente se filtran los planes que pertenecen a
esa fecha.

### Crear o editar un plan

El formulario envía los datos como JSON mediante POST.

La API:

1.  valida el título;
2.  valida la fecha;
3.  valida la hora;
4.  normaliza notas;
5.  normaliza la alarma;
6.  verifica lugar, instructor y curso;
7.  guarda o actualiza el plan.

### Notificaciones

La API calcula los días restantes usando `DATEDIFF()`.

El navegador muestra:

-   vencido;
-   vence hoy;
-   vence mañana;
-   vence en X días.

También existe la posibilidad de solicitar permiso para las
notificaciones nativas del navegador.

### Catálogos

Los catálogos son:

-   lugares;
-   instructores;
-   cursos.

Cada catálogo pertenece a un usuario.

Desde el panel de configuración se pueden crear y eliminar registros.

### Copias de seguridad

El sistema conserva como máximo 5 archivos.

Al crear una sexta copia, la más antigua se elimina antes de generar la
nueva.

Los backups se guardan en:

`storage/backups`

El sistema permite:

-   crear;
-   listar;
-   eliminar;
-   restaurar;
-   descargar.

La opción de Google Drive actualmente prepara y descarga el `.sql`; no
realiza una subida automática a Google Drive.

### Exportación

`export.php` utiliza PhpSpreadsheet para generar archivos `.xlsx`.

Se pueden exportar:

-   el mes actual;
-   el año visible.

## 5. Pruebas realizadas

Se ejecutaron comprobaciones estáticas después de las modificaciones:

-   `node --check public/assets/app.js` → correcto.
-   `php -l` sobre todos los archivos PHP → sin errores de sintaxis.
-   comprobación automática de selectores `$("#...")` frente a los IDs
    de `index.php` → sin selectores literales inexistentes.
-   revisión del flujo de backups y compatibilidad de restauración
    antigua/nueva.

No fue posible ejecutar una prueba completa contra MySQL porque el
entorno de auditoría no contiene un servidor MySQL/MariaDB ni las
dependencias `vendor/` de Composer. Por eso no se debe interpretar esta
auditoría como una prueba E2E completa.

## 6. Pruebas manuales recomendadas

Después de instalar Composer y conectar MySQL, conviene probar en este
orden:

1.  Iniciar sesión.
2.  Abrir el calendario.
3.  Cambiar de mes.
4.  Seleccionar diferentes días.
5.  Crear un plan.
6.  Editar un plan.
7.  Marcarlo como hecho.
8.  Eliminarlo.
9.  Crear un lugar.
10. Crear un instructor.
11. Crear un curso.
12. Usar un curso desde el autocompletado.
13. Buscar por título.
14. Buscar por instructor.
15. Buscar por curso.
16. Buscar por fecha.
17. Activar notificaciones.
18. Crear un backup.
19. Descargar el backup.
20. Restaurar un backup.
21. Crear más de cinco backups y verificar la rotación.
22. Exportar un mes a Excel.
23. Exportar un año a Excel.
24. Cerrar sesión y comprobar que no se puede volver a `index.php` sin
    autenticación.

## 7. Convención para mantener el código

Cuando se agregue una nueva función:

-   La interfaz debe validar lo básico, pero la API debe volver a
    validar todo.
-   Ningún dato recibido del navegador debe considerarse confiable.
-   Las operaciones POST deben usar CSRF.
-   Las consultas SQL deben usar parámetros preparados.
-   Los IDs de catálogos deben comprobar pertenencia al usuario.
-   Los elementos DOM opcionales deben usar listeners defensivos.
-   Las operaciones asíncronas deben tener manejo de errores.
-   Las funciones complejas deben explicar en lenguaje natural qué
    problema resuelven.
-   Evitar comentarios que repitan literalmente el código; los
    comentarios deben explicar el motivo o la regla de negocio.

## 8. Resultado

El error de `btnCreateBackup` queda corregido y el flujo JavaScript deja
de detenerse en esa línea.

Además, la aplicación queda con validaciones más fuertes en backend,
mejor manejo de errores en frontend, un buscador coherente con el texto
de la interfaz y backups compatibles con los nuevos campos del
calendario.

## 9. CRUD real de catálogos y visualización de planes

Se añadió el CRUD completo de lugares, instructores y cursos desde el panel de configuración.

Cada registro ahora permite:

- **Crear**: se mantiene el formulario existente.
- **Ver**: el registro aparece en la lista con sus datos principales.
- **Editar**: se abre un formulario específico para modificar nombre y, cuando corresponde, dirección o cargo.
- **Eliminar**: se elimina el registro y se actualiza la información de los planes relacionados.

### Actualización automática de planes

Los planes no guardan una copia del nombre del lugar, instructor o curso. Guardan el ID del registro de catálogo.

Por esa razón, cuando se edita un instructor, curso o lugar, todos los planes que utilizan ese mismo ID pasan a mostrar automáticamente el nuevo nombre o dato actualizado. No es necesario recorrer y modificar manualmente cada plan.

La API carga los nombres mediante `LEFT JOIN` y devuelve campos como:

- `lugar_nombre`
- `lugar_direccion`
- `instructor_nombre`
- `instructor_cargo`
- `curso_nombre`

Esto evita datos duplicados y mantiene una única fuente de verdad.

### Ver plan

Cada plan del día ahora tiene tres acciones visibles:

1. **Ver plan** — abre una ventana de solo lectura con toda la información.
2. **Editar** — abre el formulario existente para modificarlo.
3. **Eliminar** — solicita confirmación y elimina el plan.

La ventana de visualización muestra fecha, horario, curso, instructor, lugar, estado, descripción y alarma cuando corresponde.

### Eliminación de catálogos utilizados

La base de datos utiliza `ON DELETE SET NULL`. Por tanto, si se elimina un lugar, instructor o curso que está siendo utilizado por un plan, el plan no se elimina. Únicamente queda sin esa asociación.
