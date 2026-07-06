# Guía del Panel de Control para Agentes de Código — Frontend (detection_attacks_frontend)

Bienvenido. Este repositorio contiene la interfaz web de monitoreo para el proyecto **Detection Attacks**, construida en **React** con **Vite**.

Este documento describe la estructura y componentes del panel de control para facilitar el mantenimiento y futuras modificaciones por otros agentes de IA.

---

## 1. Tecnologías y Estructura
- **Framework:** React 19 + Vite.
- **Gráficos:** **Recharts** (SVG charts interactivos).
- **Iconografía:** **Lucide React**.
- **Estilos:** Vanilla CSS moderno con soporte para:
  - Diseño responsivo (móvil, tablet, escritorio).
  - Efectos visuales premium (Dark theme, glassmorphism con `backdrop-filter`, gradientes dinámicos y micro-animaciones).
  - Estilos globales centralizados en `src/index.css` y específicos en `src/App.css`.

---

## 2. Consumo Inteligente de la API
El dashboard consume el endpoint `GET /api/metrics` provisto por el backend en FastAPI. La constante `API_BASE` se ajusta automáticamente según el entorno del navegador:

```javascript
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8000'
  : 'https://detection-attacks-whatsapp.onrender.com';
```

- En desarrollo local apunta a `http://localhost:8000`.
- Al desplegarse en producción (ej. Vercel) se conecta al servidor de Render.
- Realiza un auto-refresh automático de los datos cada 30 segundos, además de contar con un botón manual de actualización que muestra una animación de rotación al cargar.

---

## 3. Componentes Visuales del Dashboard

### A. Tarjetas de Indicadores (KPIs)
- **Total Validations (Active Engine):** Volumen general acumulado de solicitudes.
- **Predicted Real / Authentic:** Cantidad de cédulas validadas como auténticas.
- **Predicted Fraud / Fake:** Cantidad total de sospechas o intentos de fraude detectados.
- **Percentages:** Muestra de forma dividida la tasa porcentual de aprobados y fraudes, formateada a 3 decimales para coincidir con la precisión requerida (ej. `98.104%` / `1.896%`).

### B. Histogramas de Score de Confianza
- **Front / Reverse Prediction Score Distribution:** Dos histogramas separados colocados lado a lado. Grafican el conteo de registros en bins fijos de `0.1` en el rango de `0.0` a `1.0`. 
- Ayuda a visualizar el comportamiento del clasificador respecto al umbral de decisión a **`0.5`** (los documentos a la izquierda de la línea imaginaria de `0.5` son reales, y a la derecha son fraudes).

### C. Gráficos de Tendencias Diarias
- **Daily Number of Fraud Predictions:** Gráfico de área apilada que muestra las cantidades absolutas diarias de transacciones aprobadas vs fraudes.
- **Daily Percentage of Fraud Detections:** Gráfico de área apilada al 100% que visualiza de forma proporcional la tasa de fraude diaria.

### D. Monitoreo de Desempeño
- Gráfica lineal que muestra de forma simultánea los tiempos de procesamiento medidos en milisegundos ($ms$) consumidos por la Lambda en AWS (Rekognition) y por Google Gemini.

### E. Tabla de Validaciones Consolidadas
- **Summary of Document Validation:** A partir de los registros transaccionales devueltos por la API, el cliente de React agrupa y mapea las fotos frontal y trasera del usuario basándose en su número de teléfono.
- Muestra una única fila para la sesión de validación del cliente con las columnas: `Model Version` (`COL-CO-5`), `Creation Date`, `Client ID`, `Validation ID`, `Predicted Front`, `Predicted Reverse` y el indicador binario `Fraud Detected` (`1` o `0`).
