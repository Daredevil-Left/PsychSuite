import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
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
    FileText
} from 'lucide-react';

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
        doc.autoTable({
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
            name: "Estrés Laboral",
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
    const [dims, setDims] = useState(3);
    const [qsPerDim, setQsPerDim] = useState(5);
    const [structure, setStructure] = useState(null);
    const [surveyData, setSurveyData] = useState([]);
    const [summaryMode, setSummaryMode] = useState('avg'); // avg | sum

    const createStructure = () => {
        const newStruct = {
            variable: "Variable Principal",
            dimensions: Array.from({ length: dims }).map((_, i) => ({
                name: `D${i + 1}`,
                questions: Array.from({ length: qsPerDim }).map((_, j) => `P${(i * qsPerDim) + j + 1}`)
            }))
        };
        setStructure(newStruct);
        setSurveyData([]);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const wb = XLSX.read(evt.target.result, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
            // Lógica simple: asumir fila 1 headers, resto datos.
            // Mapear datos a una estructura plana temporal para mostrar
            if (json.length > 1) {
                const dataRows = json.slice(1).map((row, i) => ({
                    id: i + 1,
                    values: row.slice(0, dims * qsPerDim).map(v => parseFloat(v) || 0)
                }));
                setSurveyData(dataRows);
            }
        };
        reader.readAsBinaryString(file);
    };

    const getSummary = useMemo(() => {
        if (!structure || surveyData.length === 0) return [];
        return surveyData.map(subject => {
            let offset = 0;
            const dimResults = structure.dimensions.map(d => {
                const qValues = subject.values.slice(offset, offset + d.questions.length);
                offset += d.questions.length;
                const sum = qValues.reduce((a, b) => a + b, 0);
                return {
                    name: d.name,
                    val: summaryMode === 'sum' ? sum : (sum / d.questions.length).toFixed(2)
                };
            });

            // Total
            const totalSum = subject.values.reduce((a, b) => a + b, 0);
            const totalVal = summaryMode === 'sum' ? totalSum : (totalSum / subject.values.length).toFixed(2);

            return { id: subject.id, dims: dimResults, total: totalVal };
        });
    }, [surveyData, structure, summaryMode]);

    return (
        <div className="space-y-6">
            <Card className="p-5">
                <div className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium mb-1">Dimensiones</label>
                        <input type="number" value={dims} onChange={e => setDims(parseInt(e.target.value))} className="p-2 border rounded w-32" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Preguntas x Dim</label>
                        <input type="number" value={qsPerDim} onChange={e => setQsPerDim(parseInt(e.target.value))} className="p-2 border rounded w-32" />
                    </div>
                    <Button onClick={createStructure}>Crear Estructura</Button>

                    {structure && (
                        <div className="ml-auto flex gap-2">
                            <div className="relative">
                                <input type="file" accept=".xlsx" onChange={handleFileUpload} className="absolute inset-0 w-full opacity-0 cursor-pointer" disabled={!xlsxReady} />
                                <Button variant="secondary" icon={Upload} disabled={!xlsxReady}>Cargar Datos</Button>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {structure && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Tabla Estructura */}
                    <Card className="p-0 overflow-hidden flex flex-col h-[500px]">
                        <div className="p-3 bg-slate-50 border-b font-bold text-slate-700">Estructura de Datos</div>
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-xs text-center border-collapse">
                                <thead>
                                    <tr>
                                        <th rowSpan={3} className="bg-slate-100 border p-2 sticky left-0 z-20 w-16">Sujeto</th>
                                        <th colSpan={dims * qsPerDim} className="bg-blue-50 border p-2">{structure.variable}</th>
                                    </tr>
                                    <tr>
                                        {structure.dimensions.map((d, i) => (
                                            <th key={i} colSpan={d.questions.length} className="bg-blue-100/50 border p-2">{d.name}</th>
                                        ))}
                                    </tr>
                                    <tr>
                                        {structure.dimensions.map(d => d.questions.map((q, j) => (
                                            <th key={`${d.name}-${j}`} className="bg-slate-50 border p-1 min-w-[30px]">{q}</th>
                                        )))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {surveyData.length > 0 ? surveyData.map((row, i) => (
                                        <tr key={i}>
                                            <td className="border p-1 bg-slate-50 sticky left-0 font-medium">#{row.id}</td>
                                            {row.values.map((v, k) => (
                                                <td key={k} className="border p-1">{v}</td>
                                            ))}
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={dims * qsPerDim + 1} className="p-8 text-slate-400">Sube un Excel para poblar</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Resumen */}
                    <Card className="p-0 overflow-hidden flex flex-col h-[500px]">
                        <div className="p-3 bg-slate-50 border-b flex justify-between items-center">
                            <span className="font-bold text-slate-700">Tabla Resumen</span>
                            <div className="flex bg-white rounded border overflow-hidden">
                                <button onClick={() => setSummaryMode('avg')} className={`px-3 py-1 text-xs ${summaryMode === 'avg' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>Promedios</button>
                                <button onClick={() => setSummaryMode('sum')} className={`px-3 py-1 text-xs ${summaryMode === 'sum' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>Sumas</button>
                            </div>
                        </div>
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-sm text-center">
                                <thead className="bg-slate-50 sticky top-0">
                                    <tr>
                                        <th className="p-2 border-b">Sujeto</th>
                                        {structure.dimensions.map((d, i) => <th key={i} className="p-2 border-b">{d.name}</th>)}
                                        <th className="p-2 border-b font-bold bg-slate-100">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {getSummary.map((row, i) => (
                                        <tr key={i}>
                                            <td className="p-2 font-medium">#{row.id}</td>
                                            {row.dims.map((d, j) => <td key={j} className="p-2">{d.val}</td>)}
                                            <td className="p-2 font-bold bg-slate-50">{row.total}</td>
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
                setRawData({
                    headers: json[0],
                    rows: json.slice(1)
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

// --- APP PRINCIPAL ---

const App = () => {
    const [activeTab, setActiveTab] = useState('aiken');
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const xlsxReady = useXLSX();

    const menuItems = [
        { id: 'aiken', label: 'Calculadora V de Aiken', icon: Calculator },
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
                        {activeTab === 'ranges' && <RangeCalculator />}
                        {activeTab === 'survey' && <SurveyConfig xlsxReady={xlsxReady} />}
                        {activeTab === 'recode' && <LikertRecoder xlsxReady={xlsxReady} />}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;
