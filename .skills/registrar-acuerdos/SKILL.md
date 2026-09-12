---
name: registrar-acuerdos
description: Registrar decisiones y compromisos de trabajo cuando el usuario pide guardar un acuerdo surgido de una conversación.
---

# Registrar acuerdos

Usar los mensajes proporcionados y sus metadatos para identificar
qué se acordó y quién asumió cada compromiso.

## Procedimiento

1. Distinguir decisiones confirmadas de propuestas o preguntas.
2. Extraer descripción, responsable, proyecto y fecha límite.
   No inventar datos ausentes.
3. Usar los identificadores de chat, mensaje y usuario que entrega
   la aplicación. No deducir identidades por el nombre visible.
4. Si una ambigüedad cambia lo que se guardaría, hacer una pregunta
   breve. Los datos opcionales ausentes pueden quedar sin definir.
5. Si el usuario pidió guardar el acuerdo y está claro, ejecutar
   la herramienta de guardado disponible.
6. Confirmar el registro solo si la herramienta informa éxito.
   Mostrar identificador, descripción, responsable y vencimiento.

## Integración pendiente

Conectar con guardar_acuerdo según el contrato acordado por el equipo.
Si no está disponible, presentar un borrador y decir que no fue guardado.

## Reglas

- Conservar la referencia al mensaje de origen.
- Resolver fechas relativas usando la fecha del mensaje y la zona
  horaria proporcionada por la aplicación.
- No convertir una decisión sin acción asociada en una tarea pendiente.
- Si falla el guardado, no afirmar que el acuerdo quedó registrado.
