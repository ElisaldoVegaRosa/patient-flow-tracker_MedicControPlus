# Cuentas personales: primer alcance propuesto

Base inspeccionada: ce16ed8. Usuario autorizo implementar este primer bloque.
Implementado localmente: [guia y limites](PERSONAL_ACCOUNTS.md); validacion
completa aprobada segun guia. Prueba manual completada y commit autorizado;
push pendiente de autorizacion explicita. Usuario eligio administrador de cuentas separado,
con permiso propio, en lugar de atribuir esa facultad al supervisor clinico.

## Problema y base existente

El acceso demo ofrece seis usuarios fijos por rol. Hay users con username unico,
hash/salt de contrasena, role, active y created_at; sesiones persistentes con
token_hash, expiracion y revocacion. validate_session ya rechaza cuentas inactivas.
No hay administrador de cuentas, API de gestion ni registro especifico de cambios
administrativos. LoginPage presenta un selector fijo y clave demo prellenada.

Las colas individuales necesitan usuarios personales antes de calcular carga o
asignar responsabilidad. Una cuenta de rol compartida no identifica a cada
profesional del turno. Este bloque no implementa reparto ni decisiones clinicas.

## Decision confirmada

Administrador de cuentas separado y permiso explicito de gestion. Ese permiso
no concede registrar ingresos, verificar identidades, escribir datos clinicos
ni consultar episodios por si solo. La implementacion debe revisar tambien
las consultas hoy autenticadas sin filtro de rol; ocultar botones no basta.
No reutilizar el permiso clinico SUPERVISOR como autorizacion administrativa.

## Primer bloque propuesto

- Cuentas personales con nombre visible, usuario unico estable y perfil permitido.
  Conservar IDs, username historico y autoria existente; no renombrar ni fusionar
  cuentas para reasignar registros anteriores.
- Listar y crear cuentas, activar/desactivar y restablecer contrasena con motivo.
  Permisos controlados por servidor; ninguna elevacion mediante campos del cliente.
- Baja logica sin borrar usuarios ni historial. Desactivar o restablecer revoca
  sesiones pertinentes; reactivar no revive tokens revocados.
- Auditoria de administrador, cuenta afectada, accion, campos administrativos
  anteriores/nuevos, motivo y fecha. Nunca contrasenas, hashes, tokens o sales.
- Impedir desactivacion propia accidental y dejar el demo sin administrador activo;
  comprobar la proteccion dentro de la misma transaccion incluso con concurrencia.
- Inicio de sesion por usuario personal; conservar acceso demo claramente marcado
  durante esta transicion. No convertir demo123 en credencial de uso real.
- Alta inicial del administrador mediante procedimiento local controlado y
  documentado. Evitar una puerta publica de registro o credenciales universales.
- Reutilizar controles comunes de solicitudes duplicadas, resultados inciertos,
  versiones y sesiones, adaptando el destino de recibos administrativos sin
  inventar un episodio ni mezclar acciones administrativas con historial clinico.

## Exclusiones

Turnos, areas y disponibilidad; coordinacion operacional; sugerencia de carga;
colas personales; reevaluaciones; fusion; SSO; correo de recuperacion; usuarios
reales y despliegue de campo. Las facultades de coordinacion se definiran despues
y no se conceden al administrador de cuentas por inferencia.

## Criterios de aceptacion y validacion

1. Administrador crea dos cuentas ficticias del mismo perfil con autores distintos.
2. Cada cuenta obtiene sesion propia y conserva permisos del perfil asignado.
3. Otros perfiles no administran cuentas; administrador separado no consulta ni
   escribe historia clinica solo por ser administrador.
4. Desactivacion/restablecimiento invalidan sesiones afectadas. Reactivacion no
   recupera sesiones viejas. Auditoria e historial anterior permanecen intactos.
5. Solicitudes repetidas y cambios concurrentes no duplican cuentas ni desactivan
   al ultimo administrador. Errores no exponen credenciales ni existen atajos UI.
6. Borradores/envios de otra cuenta no se restauran ni atribuyen al usuario nuevo.
7. Migracion ensayada en copia y respaldo verificado antes de aplicarla al demo.
8. Pruebas dirigidas durante desarrollo y validacion completa aplicable al cierre.
   Acordar prueba manual antes de operar la app; commit/push requieren autorizacion.

El paquete del plan global (cuentas, turnos, areas y coordinacion) tenia una
estimacion preliminar conjunta de 40-72 horas; no atribuirla entera a esta primera
parte ni convertirla en compromiso. Implementacion local usa ACCOUNT_ADMIN
exclusivo y alta inicial interactiva mediante script, sin credencial sembrada.
Ver procedimiento y limites en la guia; no cambia la decision anterior.

Referencia: [plan del piloto](URGENCIAS_PILOT_PLAN.md).
