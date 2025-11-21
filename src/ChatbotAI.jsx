import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { X, MessageCircle, Send } from 'lucide-react';

const ChatbotAI = ({ activeTab }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const genAI = useRef(null);

    // Inicializar Gemini AI
    useEffect(() => {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (apiKey && apiKey !== 'tu_api_key_aqui') {
            genAI.current = new GoogleGenerativeAI(apiKey);
        }
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Contexto de cada herramienta para Gemini
    const toolContext = {
        aiken: `Eres un asistente experto en la Calculadora V de Aiken. Esta herramienta permite:
- Calcular el coeficiente V de Aiken para validación de contenido por jueces expertos
- Los valores van de 0 a 1, siendo 1 la mayor validez
- Se considera válido si V ≥ 0.70 (95% confianza) o V ≥ 0.80 (99% confianza)
- Permite configurar número de jueces, ítems y escala de valoración
- Puede importar datos desde Excel
- Exporta resultados en PDF y formato APA 7`,

        cronbach: `Eres un asistente experto en Alfa de Cronbach. Esta herramienta permite:
- Medir la consistencia interna de instrumentos psicométricos
- Valores entre 0.70-0.90 son considerados aceptables
- Ofrece análisis Global (todas las columnas) o Por Variables (rangos específicos)
- Interpretación según Palella y Martins (2012):
  * 0.81-1.00: Muy alta
  * 0.61-0.80: Alta
  * 0.41-0.60: Media
  * 0.21-0.40: Baja
  * 0.00-0.20: Muy baja
- Exporta tablas en formato APA 7`,

        ranges: `Eres un asistente experto en Baremos y Rangos. Esta herramienta permite:
- Crear tablas de baremos para clasificar puntuaciones en niveles cualitativos
- Configurar escala del ítem (mínimo y máximo)
- Definir variables y dimensiones con número de ítems
- Generar 2, 3, 4 o 5 niveles cualitativos (Bajo, Medio, Alto, etc.)
- Calcula rangos automáticamente dividiendo el puntaje total en intervalos iguales
- Exporta a Excel y formato APA 7`,

        survey: `Eres un asistente experto en Gestión de Encuesta. Esta herramienta permite:
- Configurar estructura de encuestas con variables y dimensiones
- Procesar archivos Excel para calcular sumas o promedios por dimensión
- Validar que el archivo Excel coincida con la estructura configurada
- Exportar resultados procesados a Excel
- Visualizar rangos de preguntas (P1, P2-P5, etc.) por dimensión`,

        recode: `Eres un asistente experto en Recodificación Likert. Esta herramienta permite:
- Invertir ítems redactados de forma inversa en escalas Likert
- Fórmula: Nuevo Valor = (Máximo + Mínimo) - Valor Original
- Seleccionar columnas específicas para invertir
- Vista previa de datos originales y recodificados
- Exportar archivo recodificado a Excel
- El archivo original nunca se modifica`
    };

    const currentContext = toolContext[activeTab] || toolContext.aiken;

    // FAQs como respaldo
    const helpContent = {
        aiken: {
            welcome: "¡Hola! Soy tu asistente con IA para la Calculadora V de Aiken. Puedo responder cualquier pregunta sobre esta herramienta. ¿En qué puedo ayudarte?",
            faqs: [
                { q: "¿Qué es la V de Aiken?", a: "La V de Aiken es un coeficiente que permite cuantificar la relevancia de un ítem respecto a un dominio de contenido a partir de las valoraciones de N jueces." },
                { q: "¿Cómo configuro los jueces e ítems?", a: "En el panel de Configuración, ajusta el número de jueces y el número de ítems. Luego define tu escala de valoración." },
                { q: "¿Cómo interpreto los resultados?", a: "Generalmente se considera válido si V ≥ 0.70 (95% confianza) o V ≥ 0.80 (99% confianza)." }
            ]
        },
        cronbach: {
            welcome: "¡Hola! Soy tu asistente con IA para el Alfa de Cronbach. Puedo responder cualquier pregunta sobre consistencia interna. ¿Qué necesitas saber?",
            faqs: [
                { q: "¿Qué es el Alfa de Cronbach?", a: "Es un coeficiente que mide la consistencia interna de un instrumento. Valores entre 0.70-0.90 son aceptables." },
                { q: "¿Diferencia entre Global y Por Variables?", a: "Global calcula el alfa para todas las columnas. Por Variables permite definir rangos específicos." },
                { q: "¿Cómo interpreto el resultado?", a: "Según Palella y Martins: 0.81-1.00 = Muy alta, 0.61-0.80 = Alta, 0.41-0.60 = Media." }
            ]
        },
        ranges: {
            welcome: "¡Hola! Soy tu asistente con IA para Baremos y Rangos. Puedo ayudarte con cualquier duda. ¿Cómo puedo ayudarte?",
            faqs: [
                { q: "¿Para qué sirven los baremos?", a: "Permiten clasificar puntuaciones en niveles cualitativos (Bajo, Medio, Alto, etc.)." },
                { q: "¿Cómo configuro la escala?", a: "Define el puntaje mínimo y máximo que puede obtener cada ítem (ej: 1 a 5)." },
                { q: "¿Cómo se calculan los rangos?", a: "Se divide el puntaje total en intervalos iguales según el número de niveles elegidos." }
            ]
        },
        survey: {
            welcome: "¡Hola! Soy tu asistente con IA para Gestión de Encuesta. Estoy aquí para ayudarte. ¿En qué puedo ayudarte?",
            faqs: [
                { q: "¿Qué hace esta herramienta?", a: "Configura la estructura de tu encuesta y procesa archivos Excel para calcular sumas o promedios." },
                { q: "¿Cómo configuro mi encuesta?", a: "Define variables y dimensiones, especifica ítems por dimensión, luego genera la estructura." },
                { q: "¿Puedo exportar resultados?", a: "Sí, puedes exportar la tabla resumen a Excel con sumas o promedios." }
            ]
        },
        recode: {
            welcome: "¡Hola! Soy tu asistente con IA para el Recodificador Likert. Puedo resolver tus dudas. ¿Qué necesitas?",
            faqs: [
                { q: "¿Para qué sirve recodificar?", a: "Para invertir ítems redactados de forma inversa en escalas Likert." },
                { q: "¿Cómo funciona la inversión?", a: "Fórmula: Nuevo Valor = (Máximo + Mínimo) - Valor Original." },
                { q: "¿Se modifica el archivo original?", a: "No, debes descargar el archivo recodificado con el botón 'Exportar Resultados'." }
            ]
        }
    };

    const currentHelp = helpContent[activeTab] || helpContent.aiken;

    useEffect(() => {
        // Mensaje de bienvenida cuando se abre el chat
        if (isOpen && messages.length === 0) {
            setMessages([{
                type: 'bot',
                text: currentHelp.welcome,
                timestamp: new Date()
            }]);
        }
    }, [isOpen]);

    useEffect(() => {
        // Reset messages cuando cambia de pestaña
        setMessages([]);
        setIsOpen(false);
    }, [activeTab]);

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || isLoading) return;

        // Agregar mensaje del usuario
        const userMessage = {
            type: 'user',
            text: inputMessage,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsLoading(true);

        try {
            let response = '';

            // Intentar usar Gemini AI si está disponible
            if (genAI.current) {
                const model = genAI.current.getGenerativeModel({ model: "gemini-pro" });

                const prompt = `${currentContext}

Usuario pregunta: ${inputMessage.trim()}

Instrucciones:
1. Responde de forma clara, concisa y profesional en español.
2. Si la pregunta es sobre la herramienta actual, usa el contexto técnico proporcionado.
3. Si la pregunta es de conocimiento general (por ejemplo: "¿Quién es Aiken?", "¿Qué es la psicometría?", "¿Cómo estás?"), RESPÓNDELA amablemente usando tu conocimiento general.
4. NO te limites solo a la herramienta. Eres un asistente integral de psicometría.`;

                const result = await model.generateContent(prompt);
                const aiResponse = await result.response;
                response = aiResponse.text();
            } else {
                // Fallback a FAQs si no hay API key
                const lowerInput = inputMessage.toLowerCase();
                const matchedFaq = currentHelp.faqs.find(faq =>
                    lowerInput.includes(faq.q.toLowerCase().split('¿')[1]?.split('?')[0].toLowerCase()) ||
                    faq.q.toLowerCase().includes(lowerInput)
                );

                if (matchedFaq) {
                    response = matchedFaq.a;
                } else {
                    response = "Lo siento, no tengo una respuesta específica. Aquí están las preguntas frecuentes:\n\n" +
                        currentHelp.faqs.map((faq, i) => `${i + 1}. ${faq.q}`).join('\n') +
                        "\n\n💡 Tip: Configura tu API key de Gemini para obtener respuestas más inteligentes.";
                }
            }

            // Agregar respuesta del bot
            const botMessage = {
                type: 'bot',
                text: response,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, botMessage]);

        } catch (error) {
            console.error('Error al generar respuesta:', error);

            // Mensaje de error amigable
            const errorMessage = {
                type: 'bot',
                text: "Lo siento, hubo un error al procesar tu pregunta. Por favor, intenta de nuevo o verifica tu conexión a internet.",
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickQuestion = (question) => {
        setInputMessage(question);
        setTimeout(() => handleSendMessage(), 100);
    };

    return (
        <>
            {/* Botón flotante */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-all hover:scale-110 z-50"
                title="Ayuda con IA"
            >
                {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
            </button>

            {/* Ventana de chat */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col z-50 animate-in slide-in-from-bottom-4 fade-in">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-xl flex items-center justify-between">
                        <div className="flex items-center">
                            <MessageCircle className="mr-2" size={20} />
                            <div>
                                <h3 className="font-bold">Asistente con IA</h3>
                                <p className="text-xs text-blue-100">
                                    {genAI.current ? '✨ Powered by Gemini' : '📚 Modo FAQ'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-lg ${msg.type === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-slate-800 border border-slate-200'}`}>
                                    <p className="text-sm whitespace-pre-line">{msg.text}</p>
                                    <span className={`text-[10px] mt-1 block ${msg.type === 'user' ? 'text-blue-100' : 'text-slate-400'}`}>
                                        {msg.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white text-slate-800 border border-slate-200 p-3 rounded-lg">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Questions */}
                    {messages.length <= 1 && !isLoading && (
                        <div className="p-3 border-t bg-white">
                            <p className="text-xs font-bold text-slate-600 mb-2">Preguntas frecuentes:</p>
                            <div className="space-y-1">
                                {currentHelp.faqs.slice(0, 3).map((faq, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleQuickQuestion(faq.q)}
                                        className="w-full text-left text-xs p-2 bg-slate-50 hover:bg-blue-50 rounded border border-slate-200 hover:border-blue-300 transition-colors"
                                    >
                                        {faq.q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Input */}
                    <div className="p-3 border-t bg-white rounded-b-xl">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
                                placeholder="Escribe tu pregunta..."
                                disabled={isLoading}
                                className="flex-1 p-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 disabled:bg-slate-100"
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={isLoading || !inputMessage.trim()}
                                className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ChatbotAI;
