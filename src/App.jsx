import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  CheckCircle, 
  AlertTriangle, 
  Percent, 
  RefreshCw, 
  Clock, 
  Database,
  ShieldAlert,
  Server
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import './App.css';

// Configuración inteligente del Host de API (Local vs Producción)
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8000'
  : 'https://detection-attacks-whatsapp.onrender.com';

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // Filtros de la tabla
  const [verdictFilter, setVerdictFilter] = useState('all');

  const fetchMetrics = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/api/metrics`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const json = await response.json();
      setData(json);
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError('No se pudo establecer conexión con la API del servidor. Verifica que el backend esté en ejecución y accesible.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(() => {
      fetchMetrics(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Cargando Panel de Monitoreo de Ataques...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container text-center">
        <ShieldAlert size={48} className="error-text" style={{ marginBottom: '16px' }} />
        <p className="error-text" style={{ marginBottom: '24px' }}>{error}</p>
        <button className="refresh-button" onClick={() => fetchMetrics()}>
          <RefreshCw size={16} /> Reintentar Conexión
        </button>
      </div>
    );
  }

  const { kpis, score_distribution, daily_predictions, execution_times, history } = data;

  // 1. Formatear datos de Histograma Frontal y Reverso por separado (rango 0 a 1)
  const binLabels = ['0.0', '0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '0.7', '0.8', '0.9', '1.0'];
  const frontHistogram = binLabels.map((label, idx) => ({
    score: label,
    Count: score_distribution.front[idx] || 0
  }));
  const backHistogram = binLabels.map((label, idx) => ({
    score: label,
    Count: score_distribution.back[idx] || 0
  }));

  // 2. Gráfico 100% Stacked para Porcentaje Diario de Fotocopias
  const dailyPercentages = daily_predictions.map(day => {
    const totalImage = day.front + day.back;
    const photocopy = day.photocopy;
    const real = Math.max(0, totalImage - photocopy);
    const photocopyPct = totalImage > 0 ? (photocopy / totalImage) * 100 : 0;
    const realPct = totalImage > 0 ? (real / totalImage) * 100 : 100;
    return {
      date: day.date,
      Real: parseFloat(realPct.toFixed(2)),
      'Color Photocopy': parseFloat(photocopyPct.toFixed(2))
    };
  });

  // Gráfico de cantidad diaria
  const dailyCounts = daily_predictions.map(day => {
    const totalImage = day.front + day.back;
    const photocopy = day.photocopy;
    const real = Math.max(0, totalImage - photocopy);
    return {
      date: day.date,
      Real: real,
      'Color Photocopy': photocopy
    };
  });

  // 3. Consolidación de Historial en Validaciones únicas (Frontal + Reverso agrupados por sesión del usuario)
  const groupValidations = () => {
    const groups = {};
    // Procesamos en orden cronológico (inverso a history que viene descendente)
    const sortedHistory = [...history].reverse();

    for (const log of sortedHistory) {
      const phone = log.phone;
      if (log.node === 'reset_flow') {
        groups[phone] = null;
        continue;
      }

      if (log.node === 'process_front') {
        groups[phone] = {
          timestamp: log.timestamp,
          phone: phone,
          validation_id: log.message_id ? log.message_id.substring(6, 26) + '...' : `VLD-${log.timestamp.substring(11, 19)}`,
          predicted_front: log.is_photocopy ? 'COLOR_PHOTOCOPY' : 'REAL',
          predicted_reverse: '-',
          predicted_color_photocopy: log.is_photocopy ? 1 : 0,
          model_version: 'COL-CO-5'
        };
      } else if (log.node === 'process_back') {
        if (groups[phone]) {
          groups[phone].predicted_reverse = log.is_photocopy ? 'COLOR_PHOTOCOPY' : 'REAL';
          if (log.is_photocopy) {
            groups[phone].predicted_color_photocopy = 1;
          }
        } else {
          groups[phone] = {
            timestamp: log.timestamp,
            phone: phone,
            validation_id: log.message_id ? log.message_id.substring(6, 26) + '...' : `VLD-${log.timestamp.substring(11, 19)}`,
            predicted_front: '-',
            predicted_reverse: log.is_photocopy ? 'COLOR_PHOTOCOPY' : 'REAL',
            predicted_color_photocopy: log.is_photocopy ? 1 : 0,
            model_version: 'COL-CO-5'
          };
        }
      }
    }
    return Object.values(groups).filter(Boolean).reverse();
  };

  const consolidatedValidations = groupValidations();

  // Filtrar el historial consolidado
  const filteredValidations = consolidatedValidations.filter(val => {
    if (verdictFilter === 'all') return true;
    if (verdictFilter === 'real') return val.predicted_color_photocopy === 0;
    if (verdictFilter === 'photocopy') return val.predicted_color_photocopy === 1;
    return true;
  });

  return (
    <div className="app-container animate-fade-in">
      {/* Header */}
      <header className="app-header">
        <div className="brand-section">
          <h1 className="brand-logo">NeoAstrum</h1>
          <span className="brand-tagline">Panel de Monitoreo de Ataques (Copias de Cédula)</span>
        </div>
        <button 
          className={`refresh-button ${refreshing ? 'spinning' : ''}`} 
          onClick={() => fetchMetrics(true)}
          disabled={refreshing}
        >
          <RefreshCw size={16} /> 
          {refreshing ? 'Actualizando...' : 'Actualizar'}
        </button>
      </header>

      {/* KPIs Superiores (Alineación con Elastic) */}
      <section className="kpi-grid">
        <div className="glass-panel kpi-card total">
          <div className="kpi-header">
            <span className="kpi-title">Total validations with color photocopy active</span>
            <div className="kpi-icon-wrapper">
              <Activity size={20} />
            </div>
          </div>
          <div className="kpi-value">{kpis.total_validations}</div>
          <span className="kpi-desc">Eventos totales procesados</span>
        </div>

        <div className="glass-panel kpi-card real">
          <div className="kpi-header">
            <span className="kpi-title">Predicted Real</span>
            <div className="kpi-icon-wrapper">
              <CheckCircle size={20} />
            </div>
          </div>
          <div className="kpi-value">{kpis.predicted_real}</div>
          <span className="kpi-desc">Documentos válidos verificados</span>
        </div>

        <div className="glass-panel kpi-card photocopy">
          <div className="kpi-header">
            <span className="kpi-title">Predicted Color Photocopy</span>
            <div className="kpi-icon-wrapper">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="kpi-value">{kpis.predicted_photocopy}</div>
          <span className="kpi-desc">Intentos de fotocopias o fraudes</span>
        </div>

        <div className="glass-panel kpi-card percentage" style={{ display: 'flex', flexDirection: 'row', gap: '16px', gridColumn: 'span 1' }}>
          <div style={{ flex: 1 }}>
            <div className="kpi-title" style={{ fontSize: '11px', marginBottom: '8px' }}>Percentage of Real Predictions (%)</div>
            <div className="kpi-value" style={{ fontSize: '24px', color: 'var(--success)' }}>{kpis.real_percentage}%</div>
          </div>
          <div style={{ flex: 1, borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
            <div className="kpi-title" style={{ fontSize: '11px', marginBottom: '8px' }}>Percentage of Photocopy Predictions (%)</div>
            <div className="kpi-value" style={{ fontSize: '24px', color: 'var(--danger)' }}>{kpis.photocopy_percentage}%</div>
          </div>
        </div>
      </section>

      {/* Gráficos de Distribución de Score (Front vs Reverse Histograms) */}
      <section className="charts-grid">
        {/* Front Prediction Score Distribution */}
        <div className="glass-panel chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Front Prediction Score Distribution</h3>
              <p className="chart-subtitle">Prediction Score [0 = Real | 1 = Color Photocopy]</p>
            </div>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={frontHistogram} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="score" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(10, 12, 18, 0.95)', borderColor: 'rgba(255,255,255,0.08)' }}
                  labelStyle={{ color: '#f8fafc', fontWeight: 600 }}
                />
                <Bar name="Count of Records" dataKey="Count" fill="#14b8a6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Reverse Prediction Score Distribution */}
        <div className="glass-panel chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Reverse Prediction Score Distribution</h3>
              <p className="chart-subtitle">Prediction Score [0 = Real | 1 = Color Photocopy]</p>
            </div>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={backHistogram} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="score" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(10, 12, 18, 0.95)', borderColor: 'rgba(255,255,255,0.08)' }}
                  labelStyle={{ color: '#f8fafc', fontWeight: 600 }}
                />
                <Bar name="Count of Records" dataKey="Count" fill="#14b8a6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Gráficos de Volumen Diario (Daily predictions and daily percentages) */}
      <section className="charts-grid">
        {/* Daily Number of Color Photocopy Predictions */}
        <div className="glass-panel chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Daily Number of Color Photocopy Predictions</h3>
              <p className="chart-subtitle">Volumen de validaciones diarias clasificadas</p>
            </div>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyCounts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(10, 12, 18, 0.95)', borderColor: 'rgba(255,255,255,0.08)' }} />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Area name="Real" type="monotone" dataKey="Real" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                <Area name="Color Photocopy" type="monotone" dataKey="Color Photocopy" stackId="1" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Percentage of Color Photocopy Detections */}
        <div className="glass-panel chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Daily Percentage of Color Photocopy Detections</h3>
              <p className="chart-subtitle">Proporción porcentual acumulada por día</p>
            </div>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyPercentages} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} tickFormatter={(tick) => `${tick}%`} />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(10, 12, 18, 0.95)', borderColor: 'rgba(255,255,255,0.08)' }} />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Area name="Real" type="monotone" dataKey="Real" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                <Area name="Color Photocopy" type="monotone" dataKey="Color Photocopy" stackId="1" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Rendimiento (AWS vs Gemini latencies) */}
      <section className="charts-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div className="glass-panel chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Validation Execution Time Performance</h3>
              <p className="chart-subtitle">Tiempos de respuesta históricos medidos en milisegundos (ms)</p>
            </div>
            <div className="latency-header-info">
              <div className="latency-badge aws">
                <Server size={14} /> Rekognition Promedio: {execution_times.avg_aws} ms
              </div>
              <div className="latency-badge gemini">
                <Clock size={14} /> Gemini Promedio: {execution_times.avg_gemini} ms
              </div>
            </div>
          </div>
          <div className="chart-wrapper" style={{ height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={execution_times.history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="timestamp" stroke="#64748b" fontSize={9} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(10, 12, 18, 0.95)', borderColor: 'rgba(255,255,255,0.08)' }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                <Line name="AWS Lambda (Rekognition)" type="monotone" dataKey="aws" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 2 }} />
                <Line name="Google Gemini (Conversacional)" type="monotone" dataKey="gemini" stroke="#a855f7" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Historial de Validaciones Consolidado (Summary of color photocopy detection) */}
      <section className="glass-panel table-card">
        <header className="table-header">
          <div className="table-title-area">
            <h3 className="chart-title">Summary of color photocopy detection</h3>
            <p className="chart-subtitle">Historial consolidado de validaciones por usuario en WhatsApp</p>
          </div>
          <div className="table-filter-area">
            <select 
              className="table-select" 
              value={verdictFilter}
              onChange={e => setVerdictFilter(e.target.value)}
            >
              <option value="all">Todos los Veredictos</option>
              <option value="real">Real (Aprobadas)</option>
              <option value="photocopy">Ataques / Copias</option>
            </select>
          </div>
        </header>

        <div className="table-wrapper">
          <table className="logs-table">
            <thead>
              <tr>
                <th>Model Version</th>
                <th>Creation Date per minute</th>
                <th>Client ID</th>
                <th>Validation ID</th>
                <th>Predicted Front</th>
                <th>Predicted Reverse</th>
                <th>Predicted Color Photocopy</th>
              </tr>
            </thead>
            <tbody>
              {filteredValidations.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No se han registrado sesiones de validación completadas.
                  </td>
                </tr>
              ) : (
                filteredValidations.map((val, idx) => (
                  <tr key={idx}>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{val.model_version}</td>
                    <td>{val.timestamp.substring(11, 16)}</td>
                    <td className="phone-text">+{val.phone}</td>
                    <td className="wamid-text" title={val.validation_id}>{val.validation_id}</td>
                    <td>
                      <span className={`badge ${val.predicted_front === 'REAL' ? 'real' : 'photocopy'}`}>
                        {val.predicted_front}
                      </span>
                    </td>
                    <td>
                      {val.predicted_reverse === '-' ? (
                        <span className="badge node-unsupported">-</span>
                      ) : (
                        <span className={`badge ${val.predicted_reverse === 'REAL' ? 'real' : 'photocopy'}`}>
                          {val.predicted_reverse}
                        </span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', textAlign: 'center' }}>
                      {val.predicted_color_photocopy}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default App;
