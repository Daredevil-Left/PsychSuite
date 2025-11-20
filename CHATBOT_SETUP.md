# Configuración del Chatbot con Google Gemini AI

## Paso 1: Obtener tu API Key de Google Gemini

1. Ve a [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Inicia sesión con tu cuenta de Google
3. Haz clic en "Create API Key"
4. Copia la API key generada

## Paso 2: Configurar la API Key

1. Abre el archivo `.env.local` en la raíz del proyecto
2. Reemplaza `tu_api_key_aqui` con tu API key real:
   ```
   VITE_GEMINI_API_KEY=TU_API_KEY_AQUI
   ```
3. Guarda el archivo

## Paso 3: Reiniciar el servidor de desarrollo

```bash
npm run dev
```

## Características del Chatbot con IA:

✅ **Respuestas inteligentes** - Gemini AI proporciona respuestas contextuales
✅ **Conocimiento especializado** - El chatbot conoce todas las herramientas de PsychSuite
✅ **Conversación natural** - Puedes hacer preguntas en lenguaje natural
✅ **Historial de conversación** - Mantiene el contexto de la conversación
✅ **Fallback a FAQs** - Si no hay API key, usa las preguntas frecuentes predefinidas

## Notas Importantes:

- La API key es **GRATUITA** con límites generosos (60 requests/minuto)
- El archivo `.env.local` está en `.gitignore` para proteger tu API key
- Nunca compartas tu API key públicamente
- Si subes el código a GitHub, la API key NO se subirá

## Solución de Problemas:

**Error: API key no válida**
- Verifica que copiaste la API key completa
- Asegúrate de que no hay espacios antes o después de la key

**Error: Límite de requests excedido**
- Espera un minuto y vuelve a intentar
- El límite gratuito es de 60 requests por minuto

**El chatbot no responde**
- Verifica que el servidor de desarrollo esté corriendo
- Abre la consola del navegador para ver errores
- Asegúrate de que la API key esté configurada correctamente
