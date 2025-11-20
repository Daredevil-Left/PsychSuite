import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    Calculator,
    FileSpreadsheet,
    Settings,
    ArrowLeftRight,
    Save,
    Upload,
    Trash2,
    Plus,
    Download,
    CheckCircle,
    AlertCircle,
    Table,
    BarChart3,
    Menu,
    X,
    RefreshCw,
    FileText,
    Activity,
    ArrowLeft,
    MessageCircle,
    Send
} from 'lucide-react';
import ChatbotAI from './ChatbotAI';

// --- UTILIDADES Y CONFIGURACIÓN ---

// Hook modificado para usar la librería importada en lugar de CDN
const useXLSX = () => {
    // En este entorno de build, XLSX siempre está disponible via import
    return true;
};

const Card = ({ children, className = "" }) => (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 ${className}`}>
        {children}
    </div>
);

const Button = ({ children, onClick, variant = "primary", icon: Icon, className = "", disabled = false }) => {
    const baseStyle = "flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
        primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
        secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-slate-400",
        danger: "bg-red-50 text-red-600 hover:bg-red-100 focus:ring-red-500",
        outline: "border border-slate-300 text-slate-600 hover:bg-slate-50",
        success: "bg-emerald-600 text-white hover:bg-emerald-700"
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`${baseStyle} ${variants[variant]} ${className}`}
        >
            {Icon && <Icon size={18} className="mr-2" />}
            {children}
        </button>
    );
};

// --- HERRAMIENTA 1: CALCULADORA V DE AIKEN ---

const AikenCalculator = ({ xlsxReady }) => {
    const [config, setConfig] = useState({
        judges: 5,
        items: 5,
        confidence: 0.95
    });
    const [scale, setScale] = useState([
        { name: 'Nada', value: 0 },
        { name: 'Poco', value: 1 },
        { name: 'Mucho', value: 2 }
    ]);
    const [data, setData] = useState([]);
    const [results, setResults] = useState(null);
    const [copySuccess, setCopySuccess] = useState(false);

    // Inicializar matriz de datos
    useEffect(() => {
        // Solo resetear si cambian las dimensiones drásticamente o está vacío
        if (data.length !== config.items || (data[0] && data[0].length !== config.judges)) {
            const newData = Array(config.items).fill(0).map(() => Array(config.judges).fill(0));
            setData(newData);
            setResults(null);
        }
    }, [config.judges, config.items]);

    const handleScaleChange = (idx, field, val) => {
        const newScale = [...scale];
        newScale[idx][field] = field === 'value' ? parseInt(val) || 0 : val;
        setScale(newScale);
    };

    const addScaleOption = () => {
        const lastVal = scale.length > 0 ? scale[scale.length - 1].value : -1;
        setScale([...scale, { name: 'Nueva Opción', value: lastVal + 1 }]);
    };

    const removeScaleOption = (idx) => {
        if (scale.length <= 2) return; // Mínimo 2
        setScale(scale.filter((_, i) => i !== idx));
    };

    const handleCellChange = (r, c, val) => {
        const newData = [...data];
        newData[r] = [...newData[r]]; // Copia profunda de la fila
        newData[r][c] = parseInt(val) || 0;
        setData(newData);
    };

    const importExcel = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });

            // Intentar ajustar a la configuración
            if (rawData.length > 0) {
                // Asumimos que el excel trae solo los números
                const rows = rawData.length;
                const cols = rawData[0].length;

                // Actualizar config si es necesario o recortar
                setConfig(prev => ({ ...prev, items: rows, judges: cols }));

                // Sanear datos
                const sanitizedData = rawData.map(row => row.map(cell => parseInt(cell) || 0));
                setData(sanitizedData);
                setResults(null);
            }
        };
        reader.readAsBinaryString(file);
    };

    const calculateAiken = () => {
        if (scale.length < 2) return;
        const minVal = Math.min(...scale.map(s => s.value));
        const maxVal = Math.max(...scale.map(s => s.value));
        const range = maxVal - minVal;

        const newResults = data.map((row, idx) => {
            const sum = row.reduce((a, b) => a + b, 0);
            const mean = sum / config.judges;
            // Fórmula V de Aiken: V = (Media - Lo) / (Hi - Lo)
            // Ojo: La fórmula común es S / (n * (c-1)). Donde S = Sum(x - Lo). 
            // Es equivalente a (Mean - Min) / (Max - Min).
            const v = (mean - minVal) / range;

            // Veredicto simple basado en umbral conservador
            // Para rigor académico real se usarían tablas de probabilidad binomial.
            // Usaremos 0.70 como corte base, ajustado por confianza.
            const threshold = config.confidence === 0.99 ? 0.80 : 0.70;
            const verdict = v >= threshold ? "Válido" : "Revisar";

            return { item: idx + 1, mean, v: v.toFixed(3), verdict };
        });
        setResults(newResults);
    };

    const exportPDF = () => {
        if (!results) return;
        const doc = new jsPDF();
        doc.text("Resultados V de Aiken", 14, 16);
        autoTable(doc, {
            head: [['Ítem', 'Coef. V', 'Veredicto']],
            body: results.map(r => [r.item, r.v, r.verdict]),
            startY: 20
        });
        doc.save('resultados_v_aiken.pdf');
    };

    const copyAsAPA7 = () => {
        if (!results) return;

        let tableHTML = `
            <style>
                table {
                    border-collapse: collapse;
                    width: 100%;
                    font-family: "Times New Roman", serif;
                    font-size: 10pt;
                    border-top: 2px solid black;
                    border-bottom: 2px solid black;
                }
                th, td {
                    border: 0;
                    padding: 8px;
                    text-align: left;
                }
                thead th {
                    border-bottom: 1px solid black;
                }
                caption {
                    caption-side: top;
                    font-weight: bold;
                    text-align: left;
                    padding-bottom: 5px;
                }
                .title {
                    font-style: italic;
                }
                .note {
                    text-align: left;
                    font-size: 8pt;
                }
            </style>
            <table>
                <caption>Tabla 1</caption>
                <thead>
                    <tr><th colspan="3" class="title">Resultados V de Aiken</th></tr>
                    <tr>
                        <th>Ítem</th>
                        <th>Coef. V</th>
                        <th>Veredicto</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map(row => `
                        <tr>
                            <td>${row.item}</td>
                            <td>${row.v}</td>
                            <td>${row.verdict}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3" class="note">Nota.</td>
                    </tr>
                </tfoot>
            </table>
        `;

        const type = "text/html";
        const blob = new Blob([tableHTML], { type });
        const data = [new ClipboardItem({ [type]: blob })];

        navigator.clipboard.write(data).then(
            () => {
                setCopySuccess(true);
            },
            () => {
                console.error("Error al copiar");
            }
        );
    };

    useEffect(() => {
        if (copySuccess) {
            const timer = setTimeout(() => setCopySuccess(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [copySuccess]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Panel Izquierdo: Configuración */}
            <div className="lg:col-span-3 space-y-6">
                <Card className="p-5">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                        <Settings className="w-5 h-5 mr-2 text-blue-600" /> Configuración
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Jueces</label>
                            <input
                                type="number"
                                value={config.judges}
                                onChange={(e) => setConfig({ ...config, judges: parseInt(e.target.value) || 1 })}
                                className="w-full p-2 border rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Ítems</label>
                            <input
                                type="number"
                                value={config.items}
                                onChange={(e) => setConfig({ ...config, items: parseInt(e.target.value) || 1 })}
                                className="w-full p-2 border rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Confianza</label>
                            <select
                                value={config.confidence}
                                onChange={(e) => setConfig({ ...config, confidence: parseFloat(e.target.value) })}
                                className="w-full p-2 border rounded-md bg-white"
                            >
                                <option value={0.95}>95%</option>
                                <option value={0.99}>99%</option>
                            </select>
                        </div>
                    </div>
                </Card>

                <Card className="p-5">
                    <h3 className="font-bold text-slate-800 mb-4">Escala de Valoración</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {scale.map((opt, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                                <input
                                    type="text"
                                    value={opt.name}
                                    onChange={(e) => handleScaleChange(idx, 'name', e.target.value)}
                                    className="flex-1 p-1 text-sm border rounded"
                                    placeholder="Etiqueta"
                                />
                                <input
                                    type="number"
                                    value={opt.value}
                                    onChange={(e) => handleScaleChange(idx, 'value', e.target.value)}
                                    className="w-12 p-1 text-sm border rounded text-center"
                                />
                                <button
                                    onClick={() => removeScaleOption(idx)}
                                    className="text-red-400 hover:text-red-600"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <Button variant="outline" onClick={addScaleOption} className="w-full mt-4 text-sm py-1">
                        <Plus size={14} className="mr-1" /> Añadir Opción
                    </Button>
                </Card>
            </div>

            {/* Panel Central: Datos y Acciones */}
            <div className="lg:col-span-9 space-y-6">
                <div className="flex flex-wrap gap-3 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="font-bold text-xl text-slate-800">Matriz de Datos</h2>
                    <div className="flex gap-2">
                        <div className="relative">
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={importExcel}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                disabled={!xlsxReady}
                            />
                            <Button variant="secondary" icon={Upload} disabled={!xlsxReady}>Importar Excel</Button>
                        </div>
                        <Button variant="primary" icon={Calculator} onClick={calculateAiken}>Calcular V</Button>
                        <Button variant="danger" icon={RefreshCw} onClick={() => {
                            const empty = Array(config.items).fill(0).map(() => Array(config.judges).fill(0));
                            setData(empty);
                            setResults(null);
                        }}>Limpiar</Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Tabla de Entrada */}
                    <Card className={`p-0 overflow-hidden ${results ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
                        <div className="overflow-x-auto max-h-[500px]">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-700 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-3 border-b font-semibold w-16">Ítem</th>
                                        {Array.from({ length: config.judges }).map((_, i) => (
                                            <th key={i} className="p-3 border-b font-semibold text-center min-w-[60px]">J{i + 1}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {data.map((row, rIdx) => (
                                        <tr key={rIdx} className="hover:bg-slate-50">
                                            <td className="p-2 font-medium text-slate-500 text-center">{rIdx + 1}</td>
                                            {row.map((cell, cIdx) => (
                                                <td key={cIdx} className="p-1">
                                                    <input
                                                        type="number"
                                                        className="w-full text-center p-1 rounded border-transparent focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                        value={cell}
                                                        onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Resultados */}
                    {results && (
                        <Card className="p-0 overflow-hidden lg:col-span-1 h-fit animate-in fade-in slide-in-from-right-4">
                            <div className="bg-slate-800 text-white p-3 font-semibold flex justify-between items-center">
                                <span>Resultados (V de Aiken)</span>
                            </div>
                            <div className="overflow-auto max-h-[460px]">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-slate-600 sticky top-0">
                                        <tr>
                                            <th className="p-2 border-b text-left">Ítem</th>
                                            <th className="p-2 border-b text-center">Coef. V</th>
                                            <th className="p-2 border-b text-right">Veredicto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {results.map((res, idx) => (
                                            <tr key={idx}>
                                                <td className="p-2 font-medium text-slate-600">#{res.item}</td>
                                                <td className="p-2 text-center font-bold text-blue-600">{res.v}</td>
                                                <td className="p-2 text-right">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs ${res.verdict === 'Válido' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                        {res.verdict}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-2 bg-slate-50 border-t flex gap-2">
                                <Button
                                    variant="secondary"
                                    icon={Download}
                                    onClick={exportPDF}
                                    disabled={!results}
                                    className="w-full text-sm"
                                >
                                    Descargar PDF
                                </Button>
                                {copySuccess && <span className="text-xs text-emerald-500 animate-pulse">¡Copiado!</span>}
                                <Button
                                    variant="secondary"
                                    icon={FileText}
                                    onClick={copyAsAPA7}
                                    disabled={!results}
                                    className="w-full text-sm"
                                >
                                    Copiar APA 7
                                </Button>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- HERRAMIENTA 2: CALCULADORA DE RANGOS ---

const RangeCalculator = () => {
    const [itemScale, setItemScale] = useState({ min: 1, max: 5 });
    const [variables, setVariables] = useState([
        {
            id: 1,
            name: "Variable 1",
            dimensions: [{ id: 1, name: 'Dimensión 1', items: 10 }]
        },
        {
            id: 2,
            name: "Variable 2",
            dimensions: [{ id: 1, name: 'Dimensión 1', items: 10 }]
        }
    ]);
    const [levelConfig, setLevelConfig] = useState({ count: 3, template: 'levels' }); // levels: Bajo/Medio/Alto
    const [levelNames, setLevelNames] = useState(["Bajo", "Medio", "Alto"]);
    const [generatedTable, setGeneratedTable] = useState(null);
    const [copySuccess, setCopySuccess] = useState(false);

    const templates = {
        3: ["Bajo", "Medio", "Alto"],
        4: ["Muy Bajo", "Bajo", "Alto", "Muy Alto"],
        5: ["Muy Bajo", "Bajo", "Promedio", "Alto", "Muy Alto"]
    };

    // Actualizar nombres cuando cambia el conteo
    useEffect(() => {
        const defaultNames = templates[levelConfig.count] || Array(levelConfig.count).fill("Nivel");
        setLevelNames(defaultNames);
    }, [levelConfig.count]);

    const addVariable = () => {
        const newVariable = {
            id: Date.now(),
            name: `Variable ${variables.length + 1}`,
            dimensions: [{ id: Date.now(), name: 'Dimensión 1', items: 10 }]
        };
        setVariables([...variables, newVariable]);
    };

    const updateVariableName = (varId, newName) => {
        setVariables(variables.map(v => v.id === varId ? { ...v, name: newName } : v));
    };

    const addDimension = (varId) => {
        setVariables(variables.map(v => {
            if (v.id === varId) {
                const newDimension = { id: Date.now(), name: `Dimensión ${v.dimensions.length + 1}`, items: 5 };
                return { ...v, dimensions: [...v.dimensions, newDimension] };
            }
            return v;
        }));
    };

    const removeDimension = (varId, dimId) => {
        setVariables(variables.map(v => {
            if (v.id === varId) {
                return { ...v, dimensions: v.dimensions.filter(d => d.id !== dimId) };
            }
            return v;
        }));
    };

    const updateDimension = (varId, dimId, field, val) => {
        setVariables(variables.map(v => {
            if (v.id === varId) {
                const newDimensions = v.dimensions.map(d =>
                    d.id === dimId ? { ...d, [field]: field === 'items' ? parseInt(val) || 0 : val } : d
                );
                return { ...v, dimensions: newDimensions };
            }
            return v;
        }));
    };

    const generateRanges = () => {
        const results = variables.flatMap(variable => {
            const allDims = [...variable.dimensions, {
                id: 'total',
                name: `TOTAL (${variable.name})`,
                items: variable.dimensions.reduce((sum, d) => sum + d.items, 0)
            }];

            return allDims.map(dim => {
                const minRaw = dim.items * itemScale.min;
                const maxRaw = dim.items * itemScale.max;
                const range = maxRaw - minRaw;
                const interval = range / levelConfig.count; // Intervalo matemático

                const levels = [];
                let currentLower = minRaw;

                for (let i = 0; i < levelConfig.count; i++) {
                    // Lógica discreta simple
                    let upper = Math.floor(minRaw + interval * (i + 1));
                    // Ajuste fino para el último nivel para asegurar que toque el máximo
                    if (i === levelConfig.count - 1) upper = maxRaw;

                    // Ajuste para el siguiente nivel (si no es el primero, empieza donde terminó el anterior + 1 si son enteros)
                    // Aquí usamos una lógica inclusiva simple:
                    // Nivel 1: Min -> Corte 1
                    // Nivel 2: Corte 1 + 1 -> Corte 2
                    const displayLower = i === 0 ? minRaw : Math.floor(minRaw + interval * i) + 1;

                    levels.push({
                        name: levelNames[i] || `Nivel ${i + 1}`,
                        range: `${displayLower} - ${upper}`
                    });
                }
                return { name: dim.name, levels };
            });
        });
        setGeneratedTable(results);
    };

    const exportToExcel = () => {
        if (!generatedTable) return;

        const header = ["Componente", ...levelNames];
        const body = generatedTable.map(row => [
            row.name,
            ...row.levels.map(lvl => lvl.range)
        ]);

        const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Baremos");
        XLSX.writeFile(wb, "tabla_de_baremos.xlsx");
    };

    const copyAsAPA7 = () => {
        if (!generatedTable) return;

        const variableTitle = variables.map(v => v.name).join(' & ');

        let tableHTML = `
            <style>
                table {
                    border-collapse: collapse;
                    width: 100%;
                    font-family: "Times New Roman", serif;
                    font-size: 10pt;
                    border-top: 2px solid black;
                    border-bottom: 2px solid black;
                }
                th, td {
                    border: 0;
                    padding: 8px;
                    text-align: left;
                }
                thead th {
                    border-bottom: 1px solid black;
                }
                caption {
                    caption-side: top;
                    font-weight: bold;
                    text-align: left;
                    padding-bottom: 5px;
                }
            </style>
            <table>
                <caption>Tabla 1</caption>
                <thead>
                    <tr><th>${variableTitle}</th></tr>
                    <tr>
                        <th>Componente</th>
                        ${levelNames.map(n => `<th>${n}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${generatedTable.map(row => `
                        <tr>
                            <td>${row.name}</td>
                            ${row.levels.map(lvl => `<td>${lvl.range}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        const type = "text/html";
        const blob = new Blob([tableHTML], { type });
        const data = [new ClipboardItem({ [type]: blob })];

        navigator.clipboard.write(data).then(
            () => {
                setCopySuccess(true);
            },
            () => {
                console.error("Error al copiar");
            }
        );
    };

    useEffect(() => {
        if (copySuccess) {
            const timer = setTimeout(() => setCopySuccess(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [copySuccess]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-6">
                <Card className="p-5 space-y-4">
                    <h3 className="font-bold text-slate-800 border-b pb-2">1. Escala del Ítem</h3>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-xs uppercase font-bold text-slate-500">Puntaje Mín</label>
                            <input type="number" value={itemScale.min} onChange={e => setItemScale({ ...itemScale, min: parseInt(e.target.value) })} className="w-full p-2 border rounded mt-1" />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs uppercase font-bold text-slate-500">Puntaje Máx</label>
                            <input type="number" value={itemScale.max} onChange={e => setItemScale({ ...itemScale, max: parseInt(e.target.value) })} className="w-full p-2 border rounded mt-1" />
                        </div>
                    </div>
                </Card>

                <Card className="p-5 space-y-4">
                    <h3 className="font-bold text-slate-800 border-b pb-2">2. Estructura del Test</h3>
                    <div className="space-y-4">
                        {variables.map((v, vIdx) => (
                            <div key={v.id} className="p-3 bg-slate-50 rounded-lg">
                                <label className="text-sm text-slate-600">Nombre Variable {vIdx + 1}</label>
                                <input
                                    type="text"
                                    value={v.name}
                                    onChange={e => updateVariableName(v.id, e.target.value)}
                                    className="w-full p-2 border rounded mt-1 mb-3"
                                />
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {v.dimensions.map((d) => (
                                        <div key={d.id} className="flex gap-2 items-center bg-white p-2 rounded">
                                            <input type="text" value={d.name} onChange={e => updateDimension(v.id, d.id, 'name', e.target.value)} className="flex-1 p-1 text-sm border rounded" />
                                            <input type="number" value={d.items} onChange={e => updateDimension(v.id, d.id, 'items', e.target.value)} className="w-16 p-1 text-sm border rounded text-center" placeholder="Items" />
                                            {v.dimensions.length > 1 && (
                                                <button onClick={() => removeDimension(v.id, d.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <Button variant="outline" onClick={() => addDimension(v.id)} className="w-full py-1 text-sm mt-2"><Plus size={14} className="mr-1" /> Añadir Dimensión</Button>
                            </div>
                        ))}
                    </div>
                    <Button variant="secondary" onClick={addVariable} className="w-full py-2 text-sm"><Plus size={14} className="mr-1" /> Añadir Variable</Button>
                </Card>

                <Card className="p-5 space-y-4">
                    <h3 className="font-bold text-slate-800 border-b pb-2">3. Niveles Cualitativos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-slate-600 mb-1">Cant. Niveles</label>
                            <select value={levelConfig.count} onChange={e => setLevelConfig({ ...levelConfig, count: parseInt(e.target.value) })} className="w-full p-2 border rounded bg-white">
                                <option value={2}>2 (Dicotómico)</option>
                                <option value={3}>3 (Tricotómico)</option>
                                <option value={4}>4 (Cuartiles)</option>
                                <option value={5}>5 (Pentatómico)</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-600 mb-1">Etiquetas</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {levelNames.map((name, i) => (
                                    <input
                                        key={i}
                                        type="text"
                                        value={name}
                                        onChange={e => {
                                            const newNames = [...levelNames];
                                            newNames[i] = e.target.value;
                                            setLevelNames(newNames);
                                        }}
                                        className="w-full p-2 border rounded"
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                    <Button variant="primary" className="w-full" onClick={generateRanges}>Generar Tabla de Baremos</Button>
                </Card>
            </div>

            <div className="lg:col-span-7">
                {generatedTable ? (
                    <Card className="h-full p-0 overflow-hidden">
                        <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-lg">Tabla de Baremos</h3>
                                <p className="text-slate-400 text-sm">{variables.map(v => v.name).join(' & ')} • Escala {itemScale.min}-{itemScale.max}</p>
                            </div>
                            <div className="flex gap-2 items-center">
                                {copySuccess && <span className="text-xs text-emerald-500 animate-pulse">¡Copiado!</span>}
                                <Button variant="secondary" icon={FileText} onClick={copyAsAPA7} className="text-sm">
                                    APA7
                                </Button>
                                <Button variant="secondary" icon={Download} onClick={exportToExcel} className="text-sm">
                                    Excel
                                </Button>
                            </div>
                        </div>
                        <div className="overflow-auto">
                            <table className="w-full text-sm text-left" id="baremos-table">
                                <thead className="bg-slate-50 text-slate-700 border-b">
                                    <tr>
                                        <th className="p-3">Componente</th>
                                        {levelNames.map((n, i) => <th key={i} className="p-3 bg-blue-50/50">{n}</th>)}
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {generatedTable.map((row, i) => (
                                        <tr key={i} className={row.id === 'total' ? 'bg-slate-50 font-bold' : ''}>
                                            <td className="p-3 border-r">{row.name}</td>
                                            {row.levels.map((lvl, j) => (
                                                <td key={j} className="p-3 text-center text-slate-600 border-r last:border-0">
                                                    {lvl.range}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-300 rounded-xl p-10">
                        <Table size={48} className="mb-4 opacity-20" />
                        <p>Configura los parámetros y genera la tabla.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- HERRAMIENTA 3: CONFIGURACIÓN ENCUESTA ---

const SurveyConfig = ({ xlsxReady }) => {
    // Configuración inicial: Array de variables
    const [variables, setVariables] = useState([
        {
            id: 1,
            name: "Variable 1",
            dimensions: [{ id: 1, name: 'D1', items: 5 }]
        },
        {
            id: 2,
            name: "Variable 2",
            dimensions: [{ id: 1, name: 'D1', items: 5 }]
        }
    ]);

    const [structure, setStructure] = useState(null); // Estructura compilada para la tabla
    const [surveyData, setSurveyData] = useState([]);
    const [summaryMode, setSummaryMode] = useState('sum'); // avg | sum

    // Calcular rangos de preguntas para visualización
    const questionRanges = useMemo(() => {
        let current = 1;
        const map = {};
        variables.forEach(v => {
            v.dimensions.forEach(d => {
                const count = parseInt(d.items) || 0;
                const start = current;
                const end = current + count - 1;
                map[`${v.id}-${d.id}`] = count > 0 ? (start === end ? `P${start}` : `P${start} - P${end}`) : 'Sin ítems';
                current += count;
            });
        });
        return map;
    }, [variables]);

    // --- GESTIÓN DE CONFIGURACIÓN ---

    const addVariable = () => {
        const newVar = {
            id: Date.now(),
            name: `Variable ${variables.length + 1}`,
            dimensions: [{ id: Date.now(), name: 'D1', items: 5 }]
        };
        setVariables([...variables, newVar]);
    };

    const removeVariable = (id) => {
        if (variables.length <= 1) return;
        setVariables(variables.filter(v => v.id !== id));
    };

    const updateVariable = (id, field, val) => {
        setVariables(variables.map(v => v.id === id ? { ...v, [field]: val } : v));
    };

    const addDimension = (varId) => {
        setVariables(variables.map(v => {
            if (v.id === varId) {
                return {
                    ...v,
                    dimensions: [...v.dimensions, { id: Date.now(), name: `D${v.dimensions.length + 1}`, items: 5 }]
                };
            }
            return v;
        }));
    };

    const removeDimension = (varId, dimId) => {
        setVariables(variables.map(v => {
            if (v.id === varId) {
                if (v.dimensions.length <= 1) return v;
                return { ...v, dimensions: v.dimensions.filter(d => d.id !== dimId) };
            }
            return v;
        }));
    };

    const updateDimension = (varId, dimId, field, val) => {
        setVariables(variables.map(v => {
            if (v.id === varId) {
                return {
                    ...v,
                    dimensions: v.dimensions.map(d =>
                        d.id === dimId ? { ...d, [field]: field === 'items' ? parseInt(val) || 0 : val } : d
                    )
                };
            }
            return v;
        }));
    };

    // --- GENERACIÓN DE ESTRUCTURA ---

    const generateStructure = () => {
        // Aplanar la estructura para facilitar el mapeo de columnas
        let colIndex = 0;
        const flatDims = [];

        const compiledVars = variables.map(v => {
            const compiledDims = v.dimensions.map(d => {
                const dimObj = {
                    ...d,
                    startIndex: colIndex,
                    questions: Array.from({ length: d.items }).map((_, i) => `${d.name}_P${i + 1}`)
                };
                colIndex += d.items;
                flatDims.push(dimObj);
                return dimObj;
            });

            return {
                ...v,
                dimensions: compiledDims,
                totalItems: compiledDims.reduce((acc, d) => acc + d.items, 0)
            };
        });

        setStructure({
            variables: compiledVars,
            totalColumns: colIndex
        });
        setSurveyData([]); // Resetear datos al cambiar estructura
    };

    // --- IMPORTACIÓN DE DATOS ---

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file || !structure) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const wb = XLSX.read(evt.target.result, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(ws, { header: 1 });

            if (json.length > 1) {
                // Validación de columnas
                const detectedCols = json[0].length;
                if (detectedCols !== structure.totalColumns) {
                    const proceed = window.confirm(
                        `⚠️ Advertencia de Estructura\n\n` +
                        `El archivo Excel tiene ${detectedCols} columnas, pero la configuración espera ${structure.totalColumns} ítems.\n\n` +
                        `¿Desea continuar de todos modos? (Se tomarán las primeras ${structure.totalColumns} columnas)`
                    );
                    if (!proceed) return;
                }

                // Asumimos fila 1 headers.
                // Validar si tenemos suficientes columnas? Por ahora leemos lo que haya hasta totalColumns
                const dataRows = json.slice(1).map((row, i) => {
                    // Asegurar que tenemos valores numéricos
                    const cleanValues = row.slice(0, structure.totalColumns).map(v => parseFloat(v) || 0);
                    // Rellenar con 0 si faltan columnas en el excel
                    while (cleanValues.length < structure.totalColumns) cleanValues.push(0);

                    return {
                        id: i + 1,
                        values: cleanValues
                    };
                });
                setSurveyData(dataRows);
            }
        };
        reader.readAsBinaryString(file);
    };

    // --- CÁLCULOS Y RESUMEN ---

    const summaryData = useMemo(() => {
        if (!structure || surveyData.length === 0) return [];

        return surveyData.map(subject => {
            const subjectSummary = { id: subject.id, vars: [] };

            subjectSummary.vars = structure.variables.map(v => {
                const dimResults = v.dimensions.map(d => {
                    const qValues = subject.values.slice(d.startIndex, d.startIndex + d.items);
                    const sum = qValues.reduce((a, b) => a + b, 0);
                    return {
                        name: d.name,
                        val: summaryMode === 'sum' ? sum : parseFloat((sum / d.items).toFixed(2))
                    };
                });

                // Total Variable
                // Suma de los valores de todas las dimensiones de esta variable
                // Ojo: si es promedio, ¿es promedio de promedios o promedio de items?
                // Generalmente en psicometría se trabaja con sumas o promedios de items.
                // Haremos promedio de todos los items de la variable.

                // Recolectar todos los valores de la variable
                let allVarValues = [];
                v.dimensions.forEach(d => {
                    allVarValues = allVarValues.concat(subject.values.slice(d.startIndex, d.startIndex + d.items));
                });

                const totalSum = allVarValues.reduce((a, b) => a + b, 0);
                const totalVal = summaryMode === 'sum' ? totalSum : parseFloat((totalSum / (allVarValues.length || 1)).toFixed(2));

                return {
                    name: v.name,
                    dims: dimResults,
                    total: totalVal
                };
            });

            return subjectSummary;
        });
    }, [surveyData, structure, summaryMode]);

    // --- EXPORTACIÓN ---

    const exportSummaryToExcel = () => {
        if (!summaryData.length) return;

        // Construir headers
        // Nivel 1: Variable | ... | Variable | ...
        // Nivel 2: Dim1 | Dim2 | Total | Dim1 ...

        // Haremos una estructura plana para la hoja de cálculo:
        // Sujeto | Var1_Dim1 | Var1_Dim2 | Var1_Total | Var2_Dim1 ...

        const headers = ["Sujeto"];
        structure.variables.forEach(v => {
            v.dimensions.forEach(d => {
                headers.push(`${v.name} - ${d.name} (${summaryMode === 'sum' ? 'Suma' : 'Prom'})`);
            });
            headers.push(`${v.name} - TOTAL`);
        });

        const body = summaryData.map(row => {
            const rowData = [row.id];
            row.vars.forEach(v => {
                v.dims.forEach(d => rowData.push(d.val));
                rowData.push(v.total);
            });
            return rowData;
        });

        const ws = XLSX.utils.aoa_to_sheet([headers, ...body]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Resumen");
        XLSX.writeFile(wb, `resumen_encuesta_${summaryMode}.xlsx`);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Panel Izquierdo: Configuración */}
            <div className="lg:col-span-4 space-y-6">
                <Card className="p-5 max-h-[calc(100vh-200px)] overflow-y-auto">
                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <h3 className="font-bold text-slate-800 flex items-center">
                            <Settings className="w-5 h-5 mr-2 text-blue-600" /> Configuración
                        </h3>
                        <Button variant="secondary" onClick={addVariable} className="text-xs py-1 px-2">
                            <Plus size={14} className="mr-1" /> Variable
                        </Button>
                    </div>

                    <div className="space-y-6">
                        {variables.map((v, vIdx) => (
                            <div key={v.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <div className="flex justify-between items-center mb-2">
                                    <input
                                        type="text"
                                        value={v.name}
                                        onChange={(e) => updateVariable(v.id, 'name', e.target.value)}
                                        className="font-bold text-sm bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none w-full mr-2"
                                    />
                                    <button onClick={() => removeVariable(v.id)} className="text-slate-400 hover:text-red-500">
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="space-y-2 pl-2 border-l-2 border-slate-200">
                                    {v.dimensions.map((d) => (
                                        <div key={d.id} className="mb-2">
                                            <div className="flex gap-2 items-center mb-1">
                                                <input
                                                    type="text"
                                                    value={d.name}
                                                    onChange={(e) => updateDimension(v.id, d.id, 'name', e.target.value)}
                                                    className="flex-1 p-1 text-xs border rounded"
                                                    placeholder="Dimensión"
                                                />
                                                <input
                                                    type="number"
                                                    value={d.items}
                                                    onChange={(e) => updateDimension(v.id, d.id, 'items', e.target.value)}
                                                    className="w-14 p-1 text-xs border rounded text-center"
                                                    placeholder="Items"
                                                    title="Cantidad de preguntas"
                                                />
                                                <button onClick={() => removeDimension(v.id, d.id)} className="text-slate-300 hover:text-red-400">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                            <div className="text-[10px] text-slate-400 pl-1 flex items-center">
                                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                                                    {questionRanges[`${v.id}-${d.id}`]}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => addDimension(v.id)}
                                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center mt-2"
                                    >
                                        <Plus size={12} className="mr-1" /> Dimensión
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 pt-4 border-t">
                        <Button onClick={generateStructure} className="w-full">
                            <RefreshCw size={16} className="mr-2" /> Generar Estructura
                        </Button>
                    </div>
                </Card>
            </div>

            {/* Panel Derecho: Datos y Resultados */}
            <div className="lg:col-span-8 space-y-6">
                {structure ? (
                    <>
                        {/* Acciones y Carga */}
                        <Card className="p-4 flex flex-wrap gap-4 justify-between items-center bg-white">
                            <div className="flex items-center gap-4">
                                <div className="text-sm text-slate-600">
                                    <span className="font-bold text-slate-900">{structure.variables.length}</span> Variables |
                                    <span className="font-bold text-slate-900 ml-1">{structure.totalColumns}</span> Preguntas Totales
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="relative">
                                    <input type="file" accept=".xlsx" onChange={handleFileUpload} className="absolute inset-0 w-full opacity-0 cursor-pointer" disabled={!xlsxReady} />
                                    <Button variant="secondary" icon={Upload} disabled={!xlsxReady}>Cargar Excel</Button>
                                </div>
                            </div>
                        </Card>

                        {/* Tabla Resumen */}
                        <Card className="p-0 overflow-hidden flex flex-col h-[500px]">
                            <div className="p-3 bg-slate-50 border-b flex justify-between items-center">
                                <h3 className="font-bold text-slate-700 flex items-center">
                                    <Table className="w-4 h-4 mr-2" /> Tabla Resumen
                                </h3>
                                <div className="flex gap-3 items-center">
                                    <div className="flex bg-white rounded border overflow-hidden">
                                        <button onClick={() => setSummaryMode('avg')} className={`px-3 py-1 text-xs font-medium transition-colors ${summaryMode === 'avg' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>Promedios</button>
                                        <button onClick={() => setSummaryMode('sum')} className={`px-3 py-1 text-xs font-medium transition-colors ${summaryMode === 'sum' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>Sumas</button>
                                    </div>
                                    <Button variant="success" icon={Download} onClick={exportSummaryToExcel} disabled={summaryData.length === 0} className="text-xs py-1">
                                        Exportar Excel
                                    </Button>
                                </div>
                            </div>

                            <div className="overflow-auto flex-1">
                                {summaryData.length > 0 ? (
                                    <table className="w-full text-sm text-center border-collapse">
                                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th rowSpan={2} className="p-2 border-b border-r bg-slate-100 sticky left-0 z-20">Sujeto</th>
                                                {structure.variables.map((v, i) => (
                                                    <th key={i} colSpan={v.dimensions.length + 1} className="p-2 border-b border-r font-bold text-slate-700 bg-blue-50/50">
                                                        {v.name}
                                                    </th>
                                                ))}
                                            </tr>
                                            <tr>
                                                {structure.variables.map(v => (
                                                    <>
                                                        {v.dimensions.map((d, j) => (
                                                            <th key={`${v.id}-${d.id}`} className="p-2 border-b border-r text-xs text-slate-600 font-medium min-w-[80px]">
                                                                {d.name}
                                                            </th>
                                                        ))}
                                                        <th className="p-2 border-b border-r text-xs font-bold text-blue-700 bg-blue-50 min-w-[80px]">Total</th>
                                                    </>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {summaryData.map((row, i) => (
                                                <tr key={i} className="hover:bg-slate-50">
                                                    <td className="p-2 font-medium text-slate-500 border-r bg-slate-50 sticky left-0">#{row.id}</td>
                                                    {row.vars.map((v, j) => (
                                                        <React.Fragment key={j}>
                                                            {v.dims.map((d, k) => (
                                                                <td key={k} className="p-2 border-r text-slate-600">{d.val}</td>
                                                            ))}
                                                            <td className="p-2 border-r font-bold text-blue-700 bg-blue-50/30">{v.total}</td>
                                                        </React.Fragment>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                        <FileSpreadsheet size={48} className="mb-4 opacity-20" />
                                        <p>Carga un archivo Excel para ver los resultados</p>
                                        <p className="text-xs mt-2">El archivo debe tener al menos {structure.totalColumns} columnas de datos numéricos.</p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-300 rounded-xl p-10 bg-slate-50/50">
                        <Settings size={48} className="mb-4 opacity-20" />
                        <p className="font-medium text-lg text-slate-600">Configura tu Encuesta</p>
                        <p className="max-w-md text-center mt-2 text-sm">
                            Define las variables y sus dimensiones en el panel izquierdo. Luego haz clic en "Generar Estructura" para comenzar a procesar datos.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- HERRAMIENTA 4: RECODIFICACIÓN ---

const LikertRecoder = ({ xlsxReady }) => {
    const [config, setConfig] = useState({ min: 1, max: 5 });
    const [rawData, setRawData] = useState({ headers: [], rows: [] });
    const [selectedCols, setSelectedCols] = useState(new Set());

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const wb = XLSX.read(evt.target.result, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
            if (json.length > 0) {
                // Asumimos que NO hay headers, generamos P1, P2...
                const numCols = json[0].length;
                const headers = Array.from({ length: numCols }, (_, i) => `P${i + 1}`);

                setRawData({
                    headers: headers,
                    rows: json
                });
                setSelectedCols(new Set());
            }
        };
        reader.readAsBinaryString(file);
    };

    const toggleCol = (idx) => {
        const newSet = new Set(selectedCols);
        if (newSet.has(idx)) newSet.delete(idx);
        else newSet.add(idx);
        setSelectedCols(newSet);
    };

    const recodedRows = useMemo(() => {
        return rawData.rows.map(row => {
            return row.map((cell, idx) => {
                if (selectedCols.has(idx)) {
                    const val = parseFloat(cell);
                    if (!isNaN(val)) {
                        // Fórmula: (Max + Min) - Val
                        return (config.max + config.min) - val;
                    }
                }
                return cell;
            });
        });
    }, [rawData, selectedCols, config]);

    const exportData = () => {
        const ws = XLSX.utils.aoa_to_sheet([rawData.headers, ...recodedRows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Recodificado");
        XLSX.writeFile(wb, "datos_recodificados.xlsx");
    };

    return (
        <div className="space-y-6">
            <Card className="p-5 flex gap-6 items-end">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Escala Mín</label>
                    <input type="number" value={config.min} onChange={e => setConfig({ ...config, min: parseInt(e.target.value) })} className="p-2 border rounded w-24" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Escala Máx</label>
                    <input type="number" value={config.max} onChange={e => setConfig({ ...config, max: parseInt(e.target.value) })} className="p-2 border rounded w-24" />
                </div>
                <div className="relative">
                    <input type="file" accept=".xlsx, .csv" onChange={handleFileUpload} className="absolute inset-0 w-full opacity-0 cursor-pointer" disabled={!xlsxReady} />
                    <Button variant="primary" icon={Upload} disabled={!xlsxReady}>Cargar Archivo</Button>
                </div>
                {recodedRows.length > 0 && (
                    <Button variant="success" icon={Download} onClick={exportData}>Exportar Resultados</Button>
                )}
            </Card>

            {rawData.headers.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                    <Card className="p-0 overflow-hidden h-[500px] flex flex-col">
                        <div className="p-2 bg-red-50 text-red-800 font-bold text-center border-b">Originales (Selecciona para invertir)</div>
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-xs text-center">
                                <thead className="bg-slate-50 sticky top-0">
                                    <tr>
                                        {rawData.headers.map((h, i) => (
                                            <th key={i} className="p-2 border cursor-pointer hover:bg-blue-100" onClick={() => toggleCol(i)}>
                                                <div className="flex flex-col items-center gap-1">
                                                    <span>{h}</span>
                                                    <div className={`w-4 h-4 rounded border ${selectedCols.has(i) ? 'bg-blue-600 border-blue-600' : 'bg-white'}`} />
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rawData.rows.slice(0, 50).map((r, i) => (
                                        <tr key={i}>
                                            {r.map((c, j) => <td key={j} className={`p-1 border ${selectedCols.has(j) ? 'bg-red-50' : ''}`}>{c}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <Card className="p-0 overflow-hidden h-[500px] flex flex-col">
                        <div className="p-2 bg-emerald-50 text-emerald-800 font-bold text-center border-b">Vista Previa Recodificada</div>
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-xs text-center">
                                <thead className="bg-slate-50 sticky top-0">
                                    <tr>
                                        {rawData.headers.map((h, i) => (
                                            <th key={i} className="p-2 border bg-slate-50 text-slate-500">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {recodedRows.slice(0, 50).map((r, i) => (
                                        <tr key={i}>
                                            {r.map((c, j) => <td key={j} className={`p-1 border ${selectedCols.has(j) ? 'bg-emerald-50 font-bold text-emerald-700' : ''}`}>{c}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

// --- HERRAMIENTA 5: ALFA DE CRONBACH ---

const CronbachAlpha = ({ xlsxReady }) => {
    const [mode, setMode] = useState('global'); // 'global' | 'multi'
    const [variables, setVariables] = useState([]);
    const [totalCols, setTotalCols] = useState(0);
    const [surveyData, setSurveyData] = useState([]);
    const [results, setResults] = useState(null);
    const [copySuccess, setCopySuccess] = useState(false);

    // Al cargar archivo, detectamos columnas
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const wb = XLSX.read(evt.target.result, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(ws, { header: 1 });

            if (json.length > 1) {
                const detectedCols = json[0].length;
                setTotalCols(detectedCols);

                // Procesar datos (asumimos fila 1 headers)
                const dataRows = json.slice(1).map(row => {
                    // Asegurar que todas las filas tengan el mismo largo rellenando con 0 si falta
                    const fullRow = Array(detectedCols).fill(0);
                    row.forEach((val, idx) => {
                        if (idx < detectedCols) fullRow[idx] = parseFloat(val) || 0;
                    });
                    return fullRow;
                });
                setSurveyData(dataRows);
                setResults(null);
                setVariables([]); // Reset variables on new file
            } else {
                alert("El archivo parece vacío.");
            }
        };
        reader.readAsBinaryString(file);
    };

    const addVariable = () => {
        const nextId = variables.length + 1;
        // Sugerir rango basado en el anterior
        let start = 1;
        if (variables.length > 0) {
            start = variables[variables.length - 1].end + 1;
        }
        if (start > totalCols) start = totalCols;

        setVariables([...variables, {
            id: Date.now(),
            name: `Variable ${nextId}`,
            start: start,
            end: start // Default to single col
        }]);
    };

    const updateVariable = (id, field, val) => {
        setVariables(variables.map(v => {
            if (v.id === id) {
                let newVal = val;
                if (field === 'start' || field === 'end') {
                    newVal = parseInt(val) || 0;
                }
                return { ...v, [field]: newVal };
            }
            return v;
        }));
    };

    const removeVariable = (id) => {
        setVariables(variables.filter(v => v.id !== id));
    };

    const getInterpretation = (alpha) => {
        if (alpha >= 0.81) return { text: "Muy alta", color: "text-green-700 bg-green-100" };
        if (alpha >= 0.61) return { text: "Alta", color: "text-emerald-700 bg-emerald-100" };
        if (alpha >= 0.41) return { text: "Media*", color: "text-yellow-700 bg-yellow-100" };
        if (alpha >= 0.21) return { text: "Baja*", color: "text-orange-700 bg-orange-100" };
        return { text: "Muy baja*", color: "text-red-700 bg-red-100" };
    };

    const calculateAlphaForSubset = (data, startCol, endCol) => {
        // Indices 0-based, inputs 1-based
        const start = Math.max(0, startCol - 1);
        const end = Math.min(data[0].length, endCol); // slice is exclusive of end, so endCol is correct index

        const nItems = end - start;
        if (nItems < 2) return null; // Need at least 2 items

        const nSubjects = data.length;

        // 1. Varianza ítems
        let sumItemVariances = 0;
        for (let i = start; i < end; i++) {
            const itemScores = data.map(r => r[i]);
            const mean = itemScores.reduce((a, b) => a + b, 0) / nSubjects;
            const variance = itemScores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (nSubjects - 1);
            sumItemVariances += variance;
        }

        // 2. Varianza total
        const totalScores = data.map(row => {
            let sum = 0;
            for (let i = start; i < end; i++) sum += row[i];
            return sum;
        });
        const totalMean = totalScores.reduce((a, b) => a + b, 0) / nSubjects;
        const totalVariance = totalScores.reduce((a, b) => a + Math.pow(b - totalMean, 2), 0) / (nSubjects - 1);

        // 3. Alfa
        let alpha = 0;
        if (totalVariance > 0) {
            alpha = (nItems / (nItems - 1)) * (1 - (sumItemVariances / totalVariance));
        }

        return {
            items: nItems,
            alpha: alpha,
            interpretation: getInterpretation(alpha)
        };
    };

    const calculate = () => {
        if (surveyData.length === 0) return;

        let newResults = [];

        if (mode === 'global') {
            const res = calculateAlphaForSubset(surveyData, 1, totalCols);
            if (res) {
                newResults.push({ name: "Escala General", ...res });
            } else {
                alert("No se pudo calcular. Asegúrate de tener al menos 2 columnas.");
            }
        } else {
            // Multi variable
            if (variables.length === 0) {
                alert("Define al menos una variable.");
                return;
            }

            variables.forEach(v => {
                const res = calculateAlphaForSubset(surveyData, v.start, v.end);
                if (res) {
                    newResults.push({ name: v.name, ...res });
                } else {
                    newResults.push({ name: v.name, error: "Rango inválido (<2 ítems)" });
                }
            });
        }

        setResults(newResults);
    };

    const copyAPA7 = () => {
        if (!results) return;

        let rowsHTML = results.map(r => {
            if (r.error) return '';
            return `
                <tr>
                    <td>${r.name}</td>
                    <td style="text-align:center">${r.items}</td>
                    <td style="text-align:center">${r.alpha.toFixed(3).replace('.', ',')}</td>
                    <td>${r.interpretation.text}</td>
                </tr>
            `;
        }).join('');

        let tableHTML = `
            <style>
                table { border-collapse: collapse; width: 100%; font-family: "Times New Roman", serif; font-size: 12pt; }
                th, td { padding: 8px; text-align: left; border: 0; }
                thead th { border-bottom: 1px solid black; border-top: 1px solid black; }
                tbody tr:last-child td { border-bottom: 1px solid black; }
                caption { text-align: left; font-weight: bold; margin-bottom: 10px; }
                .note { font-size: 10pt; margin-top: 5px; font-style: italic; }
            </style>
            <table>
                <caption>Tabla 2<br><span style="font-weight:normal; font-style:italic">Coeficientes de consistencia interna Alfa de Cronbach</span></caption>
                <thead>
                    <tr>
                        <th>Variable</th>
                        <th style="text-align:center">Nº Elementos</th>
                        <th style="text-align:center">α</th>
                        <th>Interpretación</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHTML}
                </tbody>
            </table>
            <div class="note">Nota. Interpretación basada en Palella y Martins (2012).</div>
        `;

        const type = "text/html";
        const blob = new Blob([tableHTML], { type });
        const data = [new ClipboardItem({ [type]: blob })];
        navigator.clipboard.write(data).then(() => setCopySuccess(true));
    };

    useEffect(() => {
        if (copySuccess) {
            const timer = setTimeout(() => setCopySuccess(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [copySuccess]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Configuración */}
            <div className="lg:col-span-5 space-y-6">
                <Card className="p-5">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                        <Settings className="w-5 h-5 mr-2 text-blue-600" /> Configuración de Análisis
                    </h3>

                    {/* 1. Carga */}
                    <div className="mb-6">
                        <label className="block text-sm font-bold text-slate-700 mb-2">1. Cargar Datos</label>
                        <div className="relative">
                            <input type="file" accept=".xlsx" onChange={handleFileUpload} className="absolute inset-0 w-full opacity-0 cursor-pointer" disabled={!xlsxReady} />
                            <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${surveyData.length > 0 ? 'border-green-300 bg-green-50' : 'border-slate-300 hover:bg-slate-50'}`}>
                                {surveyData.length > 0 ? (
                                    <div className="text-green-700">
                                        <CheckCircle className="mx-auto mb-1" size={24} />
                                        <span className="font-bold text-sm">Datos Cargados</span>
                                        <p className="text-xs mt-1">{surveyData.length} filas, {totalCols} columnas detectadas</p>
                                    </div>
                                ) : (
                                    <div className="text-slate-500">
                                        <Upload className="mx-auto mb-1" size={24} />
                                        <span className="text-sm">Seleccionar Excel (.xlsx)</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 2. Modo */}
                    {surveyData.length > 0 && (
                        <div className="animate-in fade-in slide-in-from-top-2 space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">2. Tipo de Análisis</label>
                                <div className="flex gap-4">
                                    <label className={`flex-1 p-3 border rounded-lg cursor-pointer transition-all ${mode === 'global' ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'hover:bg-slate-50'}`}>
                                        <input type="radio" name="mode" value="global" checked={mode === 'global'} onChange={() => setMode('global')} className="sr-only" />
                                        <div className="text-center">
                                            <span className="block font-bold text-sm text-slate-800">Global</span>
                                            <span className="text-xs text-slate-500">Todas las columnas (1-{totalCols})</span>
                                        </div>
                                    </label>
                                    <label className={`flex-1 p-3 border rounded-lg cursor-pointer transition-all ${mode === 'multi' ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'hover:bg-slate-50'}`}>
                                        <input type="radio" name="mode" value="multi" checked={mode === 'multi'} onChange={() => setMode('multi')} className="sr-only" />
                                        <div className="text-center">
                                            <span className="block font-bold text-sm text-slate-800">Por Variables</span>
                                            <span className="text-xs text-slate-500">Definir rangos específicos</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* 3. Definición de Variables (Solo Multi) */}
                            {mode === 'multi' && (
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-sm font-bold text-slate-700">3. Definir Variables</label>
                                        <button onClick={addVariable} className="text-xs flex items-center text-blue-600 font-bold hover:underline">
                                            <Plus size={14} className="mr-1" /> Agregar
                                        </button>
                                    </div>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                        {variables.map((v, idx) => (
                                            <div key={v.id} className="bg-slate-50 p-2 rounded border flex items-center gap-2 text-sm">
                                                <span className="font-bold text-slate-400 w-4">{idx + 1}.</span>
                                                <input
                                                    type="text"
                                                    value={v.name}
                                                    onChange={(e) => updateVariable(v.id, 'name', e.target.value)}
                                                    className="flex-1 p-1.5 border rounded outline-none focus:border-blue-500"
                                                    placeholder="Nombre"
                                                />
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs text-slate-500">Col:</span>
                                                    <input
                                                        type="number"
                                                        value={v.start}
                                                        onChange={(e) => updateVariable(v.id, 'start', e.target.value)}
                                                        className="w-12 p-1.5 border rounded text-center outline-none focus:border-blue-500"
                                                    />
                                                    <span className="text-slate-400">-</span>
                                                    <input
                                                        type="number"
                                                        value={v.end}
                                                        onChange={(e) => updateVariable(v.id, 'end', e.target.value)}
                                                        className="w-12 p-1.5 border rounded text-center outline-none focus:border-blue-500"
                                                    />
                                                </div>
                                                <button onClick={() => removeVariable(v.id)} className="text-red-400 hover:text-red-600 p-1">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                        {variables.length === 0 && (
                                            <div className="text-center p-4 text-slate-400 text-xs italic border-2 border-dashed rounded">
                                                Agrega variables para definir qué columnas analizar.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <Button variant="primary" onClick={calculate} className="w-full">
                                <Activity size={18} className="mr-2" /> Calcular Alfa de Cronbach
                            </Button>
                        </div>
                    )}
                </Card>
            </div>

            {/* Resultados */}
            <div className="lg:col-span-7 space-y-6">
                {results ? (
                    <Card className="p-0 overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
                            <h3 className="font-bold flex items-center">
                                <Activity className="mr-2" size={18} /> Resultados
                            </h3>
                            <div className="flex gap-2 items-center">
                                {copySuccess && <span className="text-xs text-emerald-500 animate-pulse font-bold">¡Copiado!</span>}
                                <Button variant="secondary" icon={FileText} onClick={copyAPA7} className="text-xs">Copiar Tabla APA 7</Button>
                            </div>
                        </div>
                        <div className="p-6">
                            <table className="w-full text-sm text-left border rounded-lg overflow-hidden">
                                <thead className="bg-slate-50 border-b">
                                    <tr>
                                        <th className="p-3 text-slate-600">Variable</th>
                                        <th className="p-3 text-center text-slate-600">Nº Elementos</th>
                                        <th className="p-3 text-center text-slate-600">Alfa (α)</th>
                                        <th className="p-3 text-slate-600">Interpretación</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {results.map((r, i) => (
                                        <tr key={i}>
                                            <td className="p-3 font-medium">{r.name}</td>
                                            {r.error ? (
                                                <td colSpan={3} className="p-3 text-red-500 text-xs italic">{r.error}</td>
                                            ) : (
                                                <>
                                                    <td className="p-3 text-center text-slate-500">{r.items}</td>
                                                    <td className="p-3 text-center font-bold text-slate-800">{r.alpha.toFixed(3).replace('.', ',')}</td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${r.interpretation.color}`}>
                                                            {r.interpretation.text}
                                                        </span>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="mt-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <h4 className="font-bold text-slate-700 mb-3 text-xs uppercase tracking-wide">Escala de Interpretación (Palella y Martins, 2012)</h4>
                                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs text-slate-600">
                                    <div className="flex justify-between"><span>0,81 - 1.00:</span> <span className="font-bold text-green-700">Muy alta</span></div>
                                    <div className="flex justify-between"><span>0,61 - 0.80:</span> <span className="font-bold text-emerald-700">Alta</span></div>
                                    <div className="flex justify-between"><span>0,41 - 0.60:</span> <span className="font-bold text-yellow-700">Media*</span></div>
                                    <div className="flex justify-between"><span>0,21 - 0.40:</span> <span className="font-bold text-orange-700">Baja*</span></div>
                                    <div className="flex justify-between"><span>0.00 - 0.20:</span> <span className="font-bold text-red-700">Muy baja*</span></div>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-3 italic border-t pt-2">
                                    * Se sugiere repetir la validación del instrumento puesto que es recomendable que el resultado sea mayor a 0,61.
                                </p>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-300 rounded-xl p-10 bg-slate-50/30">
                        <Activity size={48} className="mb-4 opacity-20" />
                        <p className="font-medium text-lg text-slate-600">Resultados del Análisis</p>
                        <p className="max-w-sm text-center mt-2 text-sm">
                            Configura el análisis en el panel izquierdo y haz clic en "Calcular" para ver los resultados.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};


const App = () => {
    const [activeTab, setActiveTab] = useState('aiken');
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const xlsxReady = useXLSX();

    const menuItems = [
        { id: 'aiken', label: 'Calculadora V de Aiken', icon: Calculator },
        { id: 'cronbach', label: 'Alfa de Cronbach', icon: Activity },
        { id: 'ranges', label: 'Baremos y Rangos', icon: Table },
        { id: 'survey', label: 'Gestión de Encuesta', icon: FileSpreadsheet },
        { id: 'recode', label: 'Recodificador Likert', icon: ArrowLeftRight },
    ];

    return (
        <div className="min-h-screen bg-slate-100 flex font-sans text-slate-900">
            {/* Sidebar */}
            <aside
                className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-white transition-all duration-300 flex flex-col sticky top-0 h-screen z-30 shadow-xl`}
            >
                <div className="p-4 flex items-center justify-between border-b border-slate-800">
                    {isSidebarOpen && <span className="font-bold text-xl tracking-tight">PsychSuite</span>}
                    <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-1 hover:bg-slate-800 rounded">
                        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>

                <nav className="flex-1 py-6 px-2 space-y-2">
                    {menuItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center p-3 rounded-lg transition-colors ${activeTab === item.id
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <item.icon size={20} className={`${isSidebarOpen ? 'mr-3' : 'mx-auto'}`} />
                            {isSidebarOpen && <span className="font-medium">{item.label}</span>}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <div className={`flex items-center ${!isSidebarOpen ? 'justify-center' : ''}`}>
                        <div className={`w-2 h-2 rounded-full mr-2 ${xlsxReady ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                        {isSidebarOpen && <span className="text-xs text-slate-400">{xlsxReady ? 'Sistema Listo' : 'Cargando libs...'}</span>}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-4 lg:p-8 overflow-y-auto h-screen">
                <div className="max-w-7xl mx-auto">
                    <header className="mb-8">
                        <h1 className="text-3xl font-bold text-slate-800">
                            {menuItems.find(i => i.id === activeTab)?.label}
                        </h1>
                        <p className="text-slate-500 mt-1">Herramienta de análisis psicométrico profesional</p>
                    </header>

                    <div className="animate-in fade-in duration-500">
                        {activeTab === 'aiken' && <AikenCalculator xlsxReady={xlsxReady} />}
                        {activeTab === 'cronbach' && <CronbachAlpha xlsxReady={xlsxReady} />}
                        {activeTab === 'ranges' && <RangeCalculator />}
                        {activeTab === 'survey' && <SurveyConfig xlsxReady={xlsxReady} />}
                        {activeTab === 'recode' && <LikertRecoder xlsxReady={xlsxReady} />}
                    </div>
                </div>
            </main>

            {/* Chatbot de Ayuda */}
            <ChatbotAI activeTab={activeTab} />
        </div>
    );
};

export default App;
