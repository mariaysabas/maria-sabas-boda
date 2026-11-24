// Preguntas del formulario de confirmación (confirmacion.html). El panel de administración
// usa esta misma lista para los títulos de las columnas del Excel.

// =================================================================
// PREGUNTAS DEL FORMULARIO — editad libremente esta lista.
// type: "radio" (una opción), "checkbox" (varias), "text" (una línea) o "textarea" (párrafo).
// required: true si es obligatoria. help: texto pequeño de ayuda (opcional).
// El texto de "label" es el título de la columna en el Excel. El "id" es cómo se guarda la
// respuesta: si cambiáis el id de una pregunta que ya tiene respuestas, esas respuestas
// dejarán de aparecer en su columna (el label sí se puede cambiar sin problema).
// =================================================================
export const QUESTIONS = [
  {
    id: "transporte",
    label: "Transporte",
    help: "Habrá autobús entre Salamanca y el Palacio Carrascalino. ¿Lo vais a usar?",
    type: "radio",
    options: ["Autobús de ida y vuelta", "Solo ida", "Solo vuelta", "Iremos por nuestra cuenta"],
    required: true
  },
  {
    id: "alojamiento",
    label: "¿Necesitáis alojamiento en Salamanca?",
    type: "radio",
    options: ["Sí", "No"],
    required: false
  },
  {
    id: "cancion",
    label: "Una canción que no puede faltar",
    type: "text",
    required: false
  },
  {
    id: "comentarios",
    label: "¿Algo más que debamos saber?",
    type: "textarea",
    required: false
  }
];

// Opciones de menú para cada asistente.
export const MENUS = ["Adulto", "Infantil"];
export const MAX_ATTENDEES = 8;
