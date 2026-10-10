# Diseño de recuperación de nota de alta: Etapa 36A

Diseño acordado con el usuario. No autoriza implementar la recuperación.

## Alcance

Recuperar únicamente la nota de alta cuando una sesión previamente autenticada
recibe HTTP 401 y el médico vuelve a autenticarse en la misma página abierta.
Actualmente la nota vive en EpisodePage y el cliente HTTP recarga ante ese 401.
Una implementación futura deberá sustituir esa recarga por un flujo de
reautenticación dentro de la aplicación, conservando el borrador en memoria.

Navegación, recarga manual, cierre de pestaña, reinicio y otros formularios
quedan fuera del alcance. No se usarán localStorage, sessionStorage, IndexedDB
ni persistencia backend para el texto del borrador. El almacenamiento actual
del token no se modifica como parte de este diseño.

## Identidad y vigencia

- Un único borrador de nota de alta por instancia abierta de la aplicación.
- Asociarlo al username autenticado, id de episodio, tipo de formulario y
  momento del primer 401 que inicia la recuperación. No conservar credenciales.
- Plazo máximo de 30 minutos desde ese primer 401, sin renovarlo por intentos
  fallidos de login, errores de red ni nuevos 401.
- La identidad debe proceder de la respuesta autenticada de la API. Restaurar
  solo si coincide el username y el rol actual es DOCTOR.
- Consultar nuevamente el detalle del mismo episodio y exigir ACTIVE.
  No aceptar el estado clínico guardado antes de perder la sesión como prueba.
- Un detalle inexistente o CLOSED elimina el borrador. Un error transitorio de
  consulta impide ofrecer recuperación; admite reintento dentro del plazo.

## Flujo propuesto

1. Ante 401 de una petición protegida con sesión previa, suspender las acciones
   autenticadas, invalidar el token y mostrar login sin recargar la página.
   Guardar únicamente una nota no vacía y su identidad previa.
2. Mantener el texto fuera del formulario visible mientras no exista sesión
   válida. Los intentos de login fallidos no amplían el plazo.
3. Después del login, comprobar identidad, rol, plazo y episodio actualizado.
4. Si cumple todas las condiciones, ofrecer «Restaurar nota de alta» o
   «Descartar». No mostrar el texto durante el login ni a otro usuario.
5. Restaurar solo tras elección explícita del médico, en el mismo episodio.
   La recuperación termina y se vuelve al comportamiento normal del formulario.
6. Nunca repetir automáticamente el POST de alta. El médico revisa la nota y
   debe enviar de nuevo; el backend conserva su comprobación de episodio ACTIVE.

El texto debe corresponder a lo que el médico escribió. No guardar respuesta
clínica completa, historial, QR, token ni objetos de sesión dentro del borrador.
Antes de ofertar restauración y antes de ejecutarla, comprobar otra vez el plazo.
Un reloj que retrocede respecto al momento guardado invalida la recuperación.
Mientras el alta está en curso, impedir duplicados como ya hace el formulario.
Un error de red no permite asumir que el alta fue aceptada: consultar el estado
antes de restaurar; si ya está CLOSED, eliminar la nota recuperable.

## Eliminación

Eliminar la nota recuperable al cerrar sesión voluntariamente, autenticar otra
identidad, perder el rol DOCTOR, vencer el plazo, descartar, cerrar el episodio
o completar el alta. También desaparece al recargar o cerrar la página por
estar solo en memoria. No conservarla entre navegaciones fuera del alcance.
Tras restaurar, vaciar la copia de recuperación; el formulario mantiene la nota.

## Separación de responsabilidades futura

- Cliente HTTP: notificar pérdida de sesión de manera centralizada, sin
  almacenar texto clínico ni decidir qué formulario recuperar.
- App: gestionar sesión y reautenticación, identidad y episodio actualizado;
  coordinar un único borrador y su eliminación.
- EpisodePage: capturar y restaurar la nota mediante un contrato explícito;
  conservar validación, bloqueo de envío y manejo de errores de alta.
- Tipos compartidos: no mezclar el estado local del borrador con los modelos
  clínicos de la API. No requiere endpoints nuevos ni cambios en SQLite.
- Invalidar respuestas antiguas y agrupar 401 concurrentes para evitar que
  peticiones de la sesión anterior sobrescriban una sesión o un episodio nuevo.

## Criterios para autorizar una implementación posterior

La tarea futura debe definir su alcance y superar frontend test, lint y build.
Debe incluir pruebas de:

- 401, mismo médico y episodio ACTIVE: oferta y restauración fiel del texto.
- Restauración descartada y ausencia de reenvío automático del alta.
- Login fallido, distinta identidad, rol distinto y plazo vencido.
- Episodio CLOSED, inexistente o consulta fallida tras reautenticación.
- Logout voluntario, alta exitosa, recarga y navegación: eliminación conforme
  al alcance; sin texto persistido en almacenamiento del navegador.
- 401 concurrentes y respuestas tardías de una sesión anterior.
- Conservación de la recuperación de sesión y formularios existentes.

Este documento cierra la decisión de diseño acordada. La aplicación conserva
su comportamiento actual hasta una autorización independiente de implementación.
