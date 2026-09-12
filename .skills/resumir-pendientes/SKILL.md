---
name: resumir-pendientes
description: Consultar y resumir compromisos abiertos por persona o proyecto cuando el usuario pregunta qué falta hacer.
---

# Resumir pendientes

Consultar los acuerdos guardados accesibles para el usuario y chat
actuales, usando los filtros solicitados.

## Procedimiento

1. Identificar la persona o proyecto solicitado.
   Para "mis pendientes", usar la identidad autenticada del remitente.
2. Consultar los registros mediante la herramienta disponible.
3. Incluir compromisos pendientes; excluir completados y cancelados.
4. Agrupar por responsable y mostrar primero los vencidos,
   después los próximos a vencer y finalmente los que no tienen fecha.
5. Mostrar descripción, vencimiento e identificador o referencia
   de origen para cada compromiso.

## Integración pendiente

Conectar con listar_acuerdos según el contrato acordado por el equipo.
Si no está disponible, indicar que no se pudieron consultar los datos.

## Reglas

- No cambiar estados al resumir.
- Mostrar responsables o fechas ausentes como "sin asignar" o "sin fecha".
- Distinguir una consulta vacía de una consulta fallida.
- Si los datos son de prueba o parciales, indicarlo.
