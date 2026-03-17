import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import { db } from './db' 
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, BarChart, Bar, Cell } from 'recharts';

const PremiumStyles = () => (
  <style>{`
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .animate-fade-in { animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-fade-in-fast { animation: fadeIn 0.2s ease-out forwards; }
    .stagger-1 { animation-delay: 100ms; opacity: 0; }
    .stagger-2 { animation-delay: 200ms; opacity: 0; }
    .stagger-3 { animation-delay: 300ms; opacity: 0; }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    input[type=number] { -moz-appearance: textfield; }
    body { overscroll-behavior-y: none; }
  `}</style>
)

const ActivityIcon = () => <svg className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
const ChartIcon = () => <svg className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;

const playBeep = (freq = 440, duration = 200, type = 'sine') => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
  } catch (e) { console.log('Audio bloqueado', e); }
};

const calcular1RM = (peso, reps) => {
  const p = parseFloat(peso) || 0;
  const r = parseInt(reps) || 0;
  if (p === 0 || r === 0) return 0;
  if (r === 1) return p;
  return p * (1 + (r / 30));
}

const getWeekNumber = (dateStr, startDateStr) => {
  if(!dateStr || !startDateStr) return 1;
  const d = new Date(dateStr.split('T')[0] + 'T12:00:00');
  const s = new Date(startDateStr.split('T')[0] + 'T12:00:00');
  const diffTime = d - s;
  if (diffTime < 0) return 1; 
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
};

const baseBiomecanica = [
  { keywords: ['press', 'banca', 'pecho', 'chest'], target: 'Pectoral Mayor, Deltoides Frontal, Tríceps', setup: 'Acuéstate con los ojos bajo la barra. Retrae escápulas.', ejecucion: 'Baja controlado. Empuja explosivamente.', respiracion: 'Inhala al bajar. Exhala al empujar.' },
  { keywords: ['sentadilla', 'squat', 'pierna'], target: 'Cuádriceps, Glúteos, Core', setup: 'Pies al ancho de hombros. Pecho arriba.', ejecucion: 'Rompe el paralelo y sube empujando el suelo.', respiracion: 'Inhala antes de bajar. Exhala al subir.' },
  { keywords: ['muerto', 'deadlift', 'dl'], target: 'Isquiosurales, Glúteos, Espalda Baja', setup: 'Barra sobre medio del pie. Espalda recta.', ejecucion: 'Empuja el suelo llevando cadera adelante.', respiracion: 'Inhala abajo. Sube aguantando y exhala al final.' },
  { keywords: ['remo', 'row', 'espalda'], target: 'Dorsal Ancho, Romboides, Bíceps', setup: 'Torso inclinado. Espalda neutra.', ejecucion: 'Jala codos hacia cadera. Aprieta arriba.', respiracion: 'Inhala al bajar. Exhala al jalar.' },
  { keywords: ['militar', 'hombro', 'shoulder'], target: 'Deltoides Anterior y Medio, Tríceps', setup: 'Barra a clavículas. Codos ligeramente adelante.', ejecucion: 'Empuja peso hacia arriba. Controla bajada.', respiracion: 'Inhala abajo. Exhala al empujar.' },
  { keywords: ['dominada', 'pull', 'jalon', 'lats'], target: 'Dorsal Ancho, Bíceps', setup: 'Agarre prono. Retrae escápulas.', ejecucion: 'Lleva codos hacia costillas. Baja lento.', respiracion: 'Inhala colgado. Exhala al subir.' },
  { keywords: ['bicep', 'curl', 'brazo'], target: 'Bíceps Braquial', setup: 'Codos pegados a costillas. Sin impulso.', ejecucion: 'Sube apretando y baja en 3 segundos.', respiracion: 'Inhala al bajar. Exhala al subir.' },
  { keywords: ['tricep', 'extension', 'copa', 'frances'], target: 'Tríceps', setup: 'Codos fijos. Solo se mueve el antebrazo.', ejecucion: 'Extiende el codo por completo. Controla la bajada.', respiracion: 'Inhala al flexionar. Exhala al extender.' },
  { keywords: ['eliptica', 'caminar', 'correr', 'bici', 'cardio'], target: 'Sistema Cardiovascular', setup: 'Ajusta la máquina a tus proporciones.', ejecucion: 'Mantén un ritmo constante (Z2) o haz intervalos (HIIT).', respiracion: 'Respiración fluida. Si no puedes hablar, vas muy rápido (Z3+).' }
];

const guiaUniversal = { target: 'Músculo Objetivo', setup: 'Asegura base estable. Espalda neutra.', ejecucion: 'Movimiento controlado. 1s concéntrica, 3s excéntrica.', respiracion: 'Inhala al estirar. Exhala al esfuerzo.' };

const buscarGuia = (nombreEjercicio) => {
  const nl = nombreEjercicio.toLowerCase();
  for (const g of baseBiomecanica) if (g.keywords.some(k => nl.includes(k))) return g;
  return guiaUniversal;
};

const AppWrapper = ({ children }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-slate-200 font-sans selection:bg-cyan-500/30 pb-12 overflow-x-hidden">
    <PremiumStyles />
    {children}
  </div>
)

export default function App() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [step, setStep] = useState('email')
  const [view, setView] = useState('login')
  const [dashTab, setDashTab] = useState('resumen')

  const [loading, setLoading] = useState(false)
  const [unidad, setUnidad] = useState('kg') 
  const [mostrarConversion, setMostrarConversion] = useState(true)

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingSyncs, setPendingSyncs] = useState(0);

  const [infoModal, setInfoModal] = useState({ isOpen: false, title: '', content: '' })
  const openInfo = (title, content) => { triggerHaptic(); setInfoModal({ isOpen: true, title, content }); }
  const InfoIcon = ({ title, content }) => (
    <button type="button" onClick={(e) => { e.preventDefault(); openInfo(title, content); }} className="ml-1.5 inline-flex items-center justify-center w-3.5 h-3.5 md:w-4 md:h-4 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[8px] md:text-[9px] font-black hover:bg-cyan-500/30 transition-all active:scale-90">i</button>
  )
  const [bioModal, setBioModal] = useState({ isOpen: false, nombre: '', guia: null })
  const openBiomecanica = (nombreEjercicio) => { triggerHaptic(); setBioModal({ isOpen: true, nombre: nombreEjercicio, guia: buscarGuia(nombreEjercicio) }); }

  const [programaActivo, setProgramaActivo] = useState(null)
  const [estadisticas, setEstadisticas] = useState({ asistencias: 0, ausencias: 0, totalSesiones: 0 })
  const [catalogo, setCatalogo] = useState([])
  const [historialGlobal, setHistorialGlobal] = useState([]) 
  const [historialActivo, setHistorialActivo] = useState([]) 
  const [semanaExpandida, setSemanaExpandida] = useState(null) 
  const [logExpandido, setLogExpandido] = useState(null) 
  const [fatiga, setFatiga] = useState({ Pecho: 100, Espalda: 100, Piernas: 100, Hombros: 100, Brazos: 100, Core: 100 })
  const [metricas, setMetricas] = useState({})
  const [rendimientoPrevio, setRendimientoPrevio] = useState({}) 

  const [diaToca, setDiaToca] = useState(1)
  const [ejerciciosHoy, setEjerciciosHoy] = useState([])
  const [workoutData, setWorkoutData] = useState({}) 
  const [timerDescanso, setTimerDescanso] = useState(0)
  const intervalRef = useRef(null)
  const [ejercicioExpandido, setEjercicioExpandido] = useState(null)

  const hoy = new Date();
  const fDate = (d) => d.toISOString().split('T')[0];
  
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('T')[0].split('-');
      const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
      return `${d}-${months[parseInt(m, 10) - 1]}-${y.slice(-2)}`;
    } catch(e) { return dateStr; }
  }

  const getValorConvertido = (valor, desdeUnidad) => {
    if (!valor) return '';
    const num = parseFloat(valor);
    if (isNaN(num)) return '';
    if (desdeUnidad === 'kg') return (num * 2.20462).toFixed(1).replace(/\.0$/, '') + ' lbs';
    return (num / 2.20462).toFixed(1).replace(/\.0$/, '') + ' kg';
  }

  const [formNombre, setFormNombre] = useState('Fuerza Base')
  const [formFecha, setFormFecha] = useState(fDate(hoy))
  const [formSemanas, setFormSemanas] = useState(6)
  const [formDias, setFormDias] = useState(3)
  const [catDias, setCatDias] = useState([1]) 
  const [catEj, setCatEj] = useState('')
  const [catSeries, setCatSeries] = useState(3)
  const [catReps, setCatReps] = useState(10)
  const [catDescanso, setCatDescanso] = useState(60)
  const [catTipo, setCatTipo] = useState('fuerza') 
  const [catPeso, setCatPeso] = useState('') 
  const [fechaRegistro, setFechaRegistro] = useState(fDate(hoy))

  const triggerHaptic = () => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15); }

  const checkPendingData = async () => {
    try {
      const count = await db.sesionesPendientes.count();
      setPendingSyncs(count);
    } catch (e) { console.log("Error leyendo Dexie", e); }
  }

  const syncDataToCloud = async () => {
    if (!navigator.onLine) return;
    try {
      const pendientes = await db.sesionesPendientes.toArray();
      if (pendientes.length === 0) return;

      for (const pSesion of pendientes) {
        const { data: newSession, error: sessionError } = await supabase.from('sesiones_familiares').insert([{
          email_usuario: pSesion.email_usuario, es_asistencia: pSesion.es_asistencia, programa_id: pSesion.programa_id, dia_rutina: pSesion.dia_rutina, fecha_registro: pSesion.fecha_registro
        }]).select().single();

        if (!sessionError && newSession) {
          const pSeries = await db.seriesPendientes.where('sesion_local_id').equals(pSesion.id).toArray();
          const ejerciciosNombres = [...new Set(pSeries.map(s => s.nombre_ejercicio))];
          
          for (const nombreEj of ejerciciosNombres) {
            const serieRef = pSeries.find(s => s.nombre_ejercicio === nombreEj);
            const { data: newEj } = await supabase.from('ejercicios_rutina').insert([{ 
              sesion_id: newSession.id, nombre_ejercicio: nombreEj, tipo_ejercicio: serieRef.tipo_ejercicio 
            }]).select().single();

            if (newEj) {
              const seriesToInsert = pSeries.filter(s => s.nombre_ejercicio === nombreEj).map(s => ({
                ejercicio_id: newEj.id, numero_serie: s.numero_serie, peso_kg: s.peso_kg, repeticiones: s.repeticiones, tipo_serie: s.tipo_serie
              }));
              await supabase.from('series_ejercicio').insert(seriesToInsert);
            }
          }
          await db.seriesPendientes.where('sesion_local_id').equals(pSesion.id).delete();
          await db.sesionesPendientes.delete(pSesion.id);
        }
      }
      checkPendingData();
      if(session?.user?.email) cargarPrograma(session.user.email);
    } catch (e) { console.log("Error en sincronización", e); }
  }

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); syncDataToCloud(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    checkPendingData();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); if(session?.user?.email) cargarPrograma(session.user.email);
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session); if(session?.user?.email) cargarPrograma(session.user.email); else setView('login');
    })
    return () => { 
      subscription.unsubscribe(); detenerTimer(); 
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
  }, [])

  const cargarPrograma = async (userEmail) => {
    const { data: prog } = await supabase.from('programas_entrenamiento').select('*').eq('email_usuario', userEmail).eq('estado', 'ACTIVO').order('id', { ascending: false }).limit(1).maybeSingle();
    const { data: historialDataCompleto } = await supabase.from('sesiones_familiares')
      .select('id, fecha_registro, es_asistencia, dia_rutina, programa_id, ejercicios_rutina(nombre_ejercicio, tipo_ejercicio, series_ejercicio(numero_serie, peso_kg, repeticiones, tipo_serie))')
      .eq('email_usuario', userEmail).order('fecha_registro', { ascending: false });

    let statsEjGlobal = {}; 
    let musculosFatigaGlobal = { Pecho: 100, Espalda: 100, Piernas: 100, Hombros: 100, Brazos: 100, Core: 100 };
    let historialGlobalLimpio = [];
    let fantasmasPrevios = {};

    if (historialDataCompleto) {
      historialDataCompleto.forEach(sesion => {
        let tonelaje_kg = 0; 
        let musculosTocados = new Set();
        if (sesion.ejercicios_rutina) {
          sesion.ejercicios_rutina.forEach(ej => {
            const name = ej.nombre_ejercicio.toLowerCase();
            const nameKey = ej.nombre_ejercicio.trim().toUpperCase(); 
            const tipoEj = ej.tipo_ejercicio || 'fuerza';

            if (name.match(/press|pecho|apertura|fly|push|pectoral/)) musculosTocados.add('Pecho');
            if (name.match(/remo|jalon|espalda|pull|dominada|dorsal/)) musculosTocados.add('Espalda');
            if (name.match(/sentadilla|pierna|prensa|curl|extension|femoral|gluteo/)) musculosTocados.add('Piernas');
            if (name.match(/hombro|militar|lateral|frontal|deltoide/)) musculosTocados.add('Hombros');
            if (name.match(/bicep|tricep|brazo|copa|martillo/)) musculosTocados.add('Brazos');
            if (name.match(/abs|core|plancha|abdomen|crunch/)) musculosTocados.add('Core');
            
            if (!statsEjGlobal[nameKey]) statsEjGlobal[nameKey] = { maxPeso: 0 };
            
            if (ej.series_ejercicio && ej.series_ejercicio.length > 0) {
              const seriesValidas = ej.series_ejercicio.filter(s => s.tipo_serie === 'N' || !s.tipo_serie);
              if (tipoEj === 'fuerza') {
                seriesValidas.forEach(serie => {
                  tonelaje_kg += (serie.peso_kg * serie.repeticiones);
                  if (serie.peso_kg > statsEjGlobal[nameKey].maxPeso) statsEjGlobal[nameKey].maxPeso = serie.peso_kg; 
                });
              }
              if (sesion.es_asistencia && !fantasmasPrevios[nameKey] && seriesValidas.length > 0) {
                if (tipoEj === 'cardio_tiempo') {
                  fantasmasPrevios[nameKey] = `${seriesValidas[0].repeticiones} min @ Nivel ${seriesValidas[0].peso_kg}`;
                } else {
                  const maxPesoSesion = Math.max(...seriesValidas.map(s => s.peso_kg));
                  const repsOfMax = seriesValidas.find(s => s.peso_kg === maxPesoSesion)?.repeticiones || 0;
                  fantasmasPrevios[nameKey] = `${seriesValidas.length} sets (Max: ${maxPesoSesion}kg x ${repsOfMax})`;
                }
              }
            }
          });
        }
        historialGlobalLimpio.push({ ...sesion, tonelaje: tonelaje_kg });
        if (sesion.es_asistencia && sesion.fecha_registro) {
          const fechaSesionStr = sesion.fecha_registro.substring(0, 10);
          const fHoy = fDate(hoy);
          const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1);
          const antier = new Date(hoy); antier.setDate(antier.getDate() - 2);

          musculosTocados.forEach(m => {
            if (fechaSesionStr === fHoy) musculosFatigaGlobal[m] = 0; 
            else if (fechaSesionStr === fDate(ayer) || fechaSesionStr === fDate(antier)) musculosFatigaGlobal[m] = Math.min(musculosFatigaGlobal[m], 50);
          });
        }
      });
    }

    setHistorialGlobal(historialGlobalLimpio); setFatiga(musculosFatigaGlobal); setMetricas(statsEjGlobal); setRendimientoPrevio(fantasmasPrevios);

    if (prog) {
      setProgramaActivo(prog);
      const total = prog.semanas_duracion * prog.dias_por_semana;
      const historialDelPrograma = historialGlobalLimpio.filter(h => h.programa_id === prog.id);
      const asisCount = historialDelPrograma.filter(h => h.es_asistencia).length;
      setEstadisticas({ asistencias: asisCount, ausencias: 0, totalSesiones: total });
      setDiaToca((asisCount % prog.dias_por_semana) + 1);
      
      const { data: cat } = await supabase.from('catalogo_rutina').select('*').eq('programa_id', prog.id).order('dia_asignado', { ascending: true });
      if(cat) setCatalogo(cat);
      setHistorialActivo(historialDelPrograma);

      if (historialDelPrograma.length > 0) {
        const mostRecentSessionWeek = getWeekNumber(historialDelPrograma[0].fecha_registro, prog.fecha_inicio);
        setSemanaExpandida(mostRecentSessionWeek);
      }

      if (!cat || cat.length === 0) setView('create_program'); else setView('dashboard');
    } else {
      setProgramaActivo(null); setCatalogo([]); setHistorialActivo([]); setView('create_program');
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault(); triggerHaptic();
    if (email === "dev") { setSession({ user: { email: "admin@titanium.local" } }); cargarPrograma("admin@titanium.local"); return; }
    setLoading(true); 
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) alert(error.message); else setStep('token');
    setLoading(false);
  }

  const handleVerify = async (e) => {
    e.preventDefault(); triggerHaptic(); setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) alert('❌ El código es incorrecto o ha expirado. Intenta de nuevo.');
    setLoading(false);
  }

  const crearPrograma = async () => {
    triggerHaptic();
    const inicio = new Date(formFecha);
    const fin = new Date(inicio); fin.setDate(fin.getDate() + (formSemanas * 7));
    const { error } = await supabase.from('programas_entrenamiento').insert([{ email_usuario: session.user.email, nombre_programa: formNombre, fecha_inicio: inicio.toISOString().split('T')[0], semanas_duracion: formSemanas, dias_por_semana: formDias, fecha_fin_teorica: fin.toISOString().split('T')[0], fecha_fin_estimada: fin.toISOString().split('T')[0], estado: 'ACTIVO' }]);
    if (!error) cargarPrograma(session.user.email);
  }

  const archivarPrograma = async () => {
    triggerHaptic();
    if(!window.confirm("📦 ¿Archivar este programa? Tu historial se conservará para métricas globales.")) return;
    await supabase.from('programas_entrenamiento').update({ estado: 'ARCHIVADO' }).eq('id', programaActivo.id);
    setProgramaActivo(null); setCatalogo([]); setHistorialActivo([]); setView('create_program');
  }

  const agregarEjercicioCatalogo = async (e) => {
    e.preventDefault(); triggerHaptic();
    if(!catEj) return alert("Escribe un ejercicio");
    if(catDias.length === 0) return alert("Selecciona al menos un día para asignar el ejercicio.");

    let pesoSQL = 0;
    if (catTipo === 'fuerza' && catPeso !== '') {
       const val = parseFloat(catPeso) || 0;
       pesoSQL = unidad === 'lbs' ? (val / 2.20462) : val;
    }

    const inserts = catDias.map(dia => ({
      programa_id: programaActivo.id, dia_asignado: dia, nombre_ejercicio: catEj, series_objetivo: catSeries, reps_objetivo: catReps.toString(), descanso_segundos: catDescanso, tipo_ejercicio: catTipo, peso_objetivo: pesoSQL 
    }));

    const { error } = await supabase.from('catalogo_rutina').insert(inserts);
    if(!error) { 
      setCatEj(''); 
      const { data: cat } = await supabase.from('catalogo_rutina').select('*').eq('programa_id', programaActivo.id).order('dia_asignado', { ascending: true }); 
      if (cat) setCatalogo(cat); 
    }
  }

  const eliminarEjercicioCatalogo = async (idEjercicio) => { triggerHaptic(); await supabase.from('catalogo_rutina').delete().eq('id', idEjercicio); const { data: cat } = await supabase.from('catalogo_rutina').select('*').eq('programa_id', programaActivo.id).order('dia_asignado', { ascending: true }); if (cat) setCatalogo(cat); }
  
  const eliminarSesionHistorica = async (idSesion) => {
    triggerHaptic(); if(!window.confirm("¿Eliminar este registro de operaciones? Se recalculará tu progreso al instante.")) return;
    await supabase.from('sesiones_familiares').delete().eq('id', idSesion); cargarPrograma(session.user.email);
  }

  const toggleSemanaLog = (semana) => { triggerHaptic(); setSemanaExpandida(prev => prev === semana ? null : semana); }
  const toggleLog = (idSesion) => { triggerHaptic(); setLogExpandido(prev => prev === idSesion ? null : idSesion); }

  const exportarDatosCSV = () => {
    triggerHaptic(); if (!historialGlobal || historialGlobal.length === 0) return alert("No hay datos históricos para exportar.");
    let csvContent = "Fecha_Registro,Dia_Entrenamiento,Nombre_Ejercicio,Tipo_Ejercicio,Numero_Serie,Tipo_Serie,Peso_Nivel,Repeticiones_Minutos,Estimacion_1RM_KG\n";
    historialGlobal.forEach(sesion => {
      const fecha = sesion.fecha_registro.substring(0, 10);
      const dia = sesion.dia_rutina || 0;
      if (sesion.ejercicios_rutina) {
        sesion.ejercicios_rutina.forEach(ej => {
          if (ej.series_ejercicio) {
            ej.series_ejercicio.forEach(serie => {
               const p = serie.peso_kg; const r = serie.repeticiones;
               const tEj = ej.tipo_ejercicio || 'fuerza'; const tSer = serie.tipo_serie || 'N';
               const oneRM = tEj === 'fuerza' ? calcular1RM(p, r).toFixed(1) : 'N/A';
               const nombreLimpio = ej.nombre_ejercicio.replace(/,/g, ''); 
               csvContent += `${fecha},${dia},${nombreLimpio},${tEj},${serie.numero_serie},${tSer},${p},${r},${oneRM}\n`;
            });
          }
        });
      }
    });
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", `Data_TitaniumCore_${fDate(hoy)}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  }

  const registrarAusencia = async () => {
    triggerHaptic(); if(!window.confirm("¿Registrar ausencia y estirar el calendario?")) return;
    const dateIso = new Date(fechaRegistro + 'T12:00:00Z').toISOString();
    await supabase.from('sesiones_familiares').insert([{ email_usuario: session.user.email, es_asistencia: false, programa_id: programaActivo.id, fecha_registro: dateIso }]);
    const nuevaFechaFin = new Date(programaActivo.fecha_fin_estimada); nuevaFechaFin.setDate(nuevaFechaFin.getDate() + 1);
    await supabase.from('programas_entrenamiento').update({ fecha_fin_estimada: nuevaFechaFin.toISOString().split('T')[0] }).eq('id', programaActivo.id);
    setFechaRegistro(fDate(hoy)); cargarPrograma(session.user.email);
  }

  const iniciarEntrenamiento = () => {
    triggerHaptic(); setEjercicioExpandido(null); 
    const ejHoy = catalogo.filter(c => c.dia_asignado === diaToca);
    const dataInicial = {};
    ejHoy.forEach(ej => {
      const nameKey = ej.nombre_ejercicio.trim().toUpperCase();
      const maxPeso_kg = metricas[nameKey]?.maxPeso || 0; 
      let pesoSugerido = '';
      if (ej.tipo_ejercicio === 'cardio_tiempo') { 
         pesoSugerido = 0; 
      } else { 
         const pesoBaseKg = maxPeso_kg > 0 ? maxPeso_kg : (ej.peso_objetivo || 0);
         if (pesoBaseKg > 0) {
             pesoSugerido = unidad === 'lbs' ? (pesoBaseKg * 2.20462).toFixed(1).replace(/\.0$/, '') : pesoBaseKg;
         }
      }
      dataInicial[ej.id] = Array.from({ length: ej.series_objetivo }, () => ({ peso: pesoSugerido, reps: ej.reps_objetivo, completado: false, tipoSerie: 'N' }));
    });
    setEjerciciosHoy(ejHoy); setWorkoutData(dataInicial); setView('workout'); 
  }

  const updateSet = (ejId, setIndex, field, value) => {
    setWorkoutData(prev => { const newData = { ...prev }; newData[ejId] = [...newData[ejId]]; newData[ejId][setIndex] = { ...newData[ejId][setIndex], [field]: value }; return newData; });
  }

  const toggleTipoSerie = (ejId, setIndex) => {
    triggerHaptic();
    setWorkoutData(prev => {
      const newData = { ...prev }; newData[ejId] = [...newData[ejId]];
      const actual = newData[ejId][setIndex].tipoSerie;
      let next = 'N'; if (actual === 'N') next = 'W'; else if (actual === 'W') next = 'D';
      newData[ejId][setIndex] = { ...newData[ejId][setIndex], tipoSerie: next };
      return newData;
    });
  }

  const toggleSet = (ejId, setIndex, descanso) => {
    triggerHaptic();
    setWorkoutData(prev => {
      const newData = { ...prev }; newData[ejId] = [...newData[ejId]];
      const isCompleted = !newData[ejId][setIndex].completado;
      newData[ejId][setIndex] = { ...newData[ejId][setIndex], completado: isCompleted };
      if (isCompleted && descanso > 0) iniciarTimer(descanso); else detenerTimer();
      return newData;
    });
  }

  const finalizarEntrenamientoHoy = async () => {
    triggerHaptic(); detenerTimer();
    const dateIso = new Date(fechaRegistro + 'T12:00:00Z').toISOString();
    
    const ejerciciosConData = [];
    for (const ej of ejerciciosHoy) {
      const sets = workoutData[ej.id] || [];
      const completedSets = sets.filter(s => s.completado); 
      if (completedSets.length > 0) ejerciciosConData.push({ ej, completedSets });
    }

    if (ejerciciosConData.length === 0) {
      alert("⚠️ No has marcado ninguna serie como completada.");
      return;
    }

    let savedToCloud = false;

    if (isOnline) {
      try {
        const { data: newSession, error: sessionError } = await supabase.from('sesiones_familiares').insert([{ email_usuario: session.user.email, es_asistencia: true, programa_id: programaActivo.id, dia_rutina: diaToca, fecha_registro: dateIso }]).select().single();
        
        if (!sessionError && newSession) {
          for (const item of ejerciciosConData) {
              const { data: newEj } = await supabase.from('ejercicios_rutina').insert([{ sesion_id: newSession.id, nombre_ejercicio: item.ej.nombre_ejercicio, tipo_ejercicio: item.ej.tipo_ejercicio || 'fuerza' }]).select().single();
              if (newEj) {
                  const seriesToInsert = item.completedSets.map((s, index) => {
                      const valorDigitado = parseFloat(s.peso) || 0;
                      const pesoParaSQL = (item.ej.tipo_ejercicio === 'cardio_tiempo') ? valorDigitado : (unidad === 'lbs' ? (valorDigitado / 2.20462) : valorDigitado);
                      return { ejercicio_id: newEj.id, numero_serie: index + 1, peso_kg: pesoParaSQL, repeticiones: parseInt(s.reps) || 0, tipo_serie: s.tipoSerie || 'N' };
                  });
                  await supabase.from('series_ejercicio').insert(seriesToInsert);
              }
          }
          savedToCloud = true;
          alert("🏆 ¡Sesión guardada en la Bóveda de Titanio (Nube)!");
        }
      } catch(e) { console.log("Fallo la nube, activando búnker", e); }
    }

    if (!savedToCloud) {
      try {
        const localSessionId = await db.sesionesPendientes.add({ email_usuario: session.user.email, es_asistencia: true, programa_id: programaActivo.id, dia_rutina: diaToca, fecha_registro: dateIso, estado_sync: 'pendiente' });
        
        for (const item of ejerciciosConData) {
            for(let i=0; i<item.completedSets.length; i++) {
                const s = item.completedSets[i];
                const valorDigitado = parseFloat(s.peso) || 0;
                const pesoParaSQL = (item.ej.tipo_ejercicio === 'cardio_tiempo') ? valorDigitado : (unidad === 'lbs' ? (valorDigitado / 2.20462) : valorDigitado);
                await db.seriesPendientes.add({
                    sesion_local_id: localSessionId, nombre_ejercicio: item.ej.nombre_ejercicio, tipo_ejercicio: item.ej.tipo_ejercicio || 'fuerza', numero_serie: i + 1, peso_kg: pesoParaSQL, repeticiones: parseInt(s.reps) || 0, tipo_serie: s.tipoSerie || 'N'
                });
            }
        }
        alert("📡 Sin conexión. Tu sesión está en el Búnker Local. Subirá automáticamente al detectar WiFi/4G.");
        checkPendingData();
      } catch(e) {
        alert("❌ Error crítico: No se pudo guardar ni en la nube ni localmente.");
      }
    }

    setFechaRegistro(fDate(hoy)); 
    if(savedToCloud && session?.user?.email) cargarPrograma(session.user.email); 
    setView('dashboard');
  }

  const iniciarTimer = (segundos) => {
    clearInterval(intervalRef.current); setTimerDescanso(segundos);
    intervalRef.current = setInterval(() => { 
      setTimerDescanso((prev) => { 
        if (prev === 4) playBeep(600, 150, 'sine');
        if (prev === 3) playBeep(600, 150, 'sine');
        if (prev === 2) playBeep(600, 150, 'sine');
        if (prev === 1) { playBeep(900, 600, 'square'); clearInterval(intervalRef.current); triggerHaptic(); return 0; } 
        return prev - 1; 
      }); 
    }, 1000);
  }
  
  const detenerTimer = () => { clearInterval(intervalRef.current); setTimerDescanso(0); }
  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const TopBarControles = () => (
    <div className="flex gap-2 items-center flex-wrap justify-end z-50">
      <div className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 md:px-3 md:py-2 rounded-lg md:rounded-xl flex items-center gap-1.5 border ${isOnline ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
         <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${isOnline ? (pendingSyncs > 0 ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400') : 'bg-amber-500'}`}></span>
         {isOnline ? (pendingSyncs > 0 ? `${pendingSyncs} PEND.` : 'NUBE') : 'BÚNKER'}
      </div>
      <button onClick={() => { triggerHaptic(); setUnidad(u => u === 'kg' ? 'lbs' : 'kg'); }} className="text-[8px] md:text-[10px] font-black uppercase tracking-widest bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl transition-all">{unidad === 'kg' ? 'Kg' : 'Lbs'}</button>
      <button onClick={() => { triggerHaptic(); setMostrarConversion(!mostrarConversion); }} className="text-[8px] md:text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl transition-all text-slate-300">{mostrarConversion ? '🔀 Dual' : '1️⃣ Único'}</button>
      <button onClick={() => { triggerHaptic(); setSession(null); supabase.auth.signOut(); }} className="text-[8px] md:text-[10px] font-black uppercase tracking-widest bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl transition-all">Salir</button>
    </div>
  )

  const renderTooltipArea = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-white/10 p-3 rounded-xl shadow-xl">
          <p className="text-white font-bold text-xs uppercase tracking-widest mb-1">{label}</p>
          <p className="text-cyan-400 font-black">{`${payload[0].value} ${unidad}`}</p>
        </div>
      );
    }
    return null;
  };

  const renderTooltipBar = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-white/10 p-3 rounded-xl shadow-xl">
          <p className="text-white font-bold text-xs uppercase tracking-widest mb-1">{label}</p>
          <p className="text-cyan-400 font-black">{`${payload[0].value}% Cumplimiento`}</p>
        </div>
      );
    }
    return null;
  };

  if (view === 'login') {
    return (
      <AppWrapper>
        <div className="min-h-screen flex items-center justify-center p-4 md:p-6">
          <form onSubmit={step === 'email' ? handleLogin : handleVerify} className="w-full max-w-md bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] p-6 md:p-10 rounded-[2rem] shadow-2xl animate-fade-in relative overflow-hidden">
            <div className="absolute top-[-50px] right-[-50px] w-32 h-32 bg-cyan-500/20 rounded-full blur-[50px] pointer-events-none"></div>
            <h1 className="text-3xl md:text-4xl font-black mb-8 md:mb-10 text-center tracking-tighter relative z-10">TITANIUM <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">CORE</span></h1>
            {step === 'email' ? (
              <div className="animate-fade-in">
                <input type="email" placeholder="Correo electrónico (o dev)" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl md:rounded-2xl px-5 py-4 mb-6 focus:border-cyan-400/50 outline-none text-white placeholder-slate-500 transition-colors text-sm md:text-base" required />
                <button type="submit" className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-black font-black uppercase tracking-widest py-4 rounded-xl md:rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] active:scale-95 transition-all text-sm">{loading ? 'Conectando...' : 'Acceso Seguro'}</button>
              </div>
            ) : (
              <div className="animate-fade-in">
                <p className="text-[10px] md:text-xs text-slate-400 text-center mb-6 font-bold uppercase tracking-widest">Ingresa el código que enviamos a<br/><span className="text-cyan-400 block mt-2">{email}</span></p>
                <input type="text" placeholder="--------" value={token} onChange={(e) => setToken(e.target.value)} maxLength={8} className="w-full bg-black/50 border border-white/10 rounded-xl md:rounded-2xl px-5 py-4 mb-6 focus:border-cyan-400/50 outline-none text-white placeholder-slate-500 transition-colors text-center text-2xl md:text-3xl tracking-[0.5em] font-black" required />
                <button type="submit" className="w-full bg-gradient-to-r from-emerald-400 to-emerald-600 text-black font-black uppercase tracking-widest py-4 rounded-xl md:rounded-2xl shadow-[0_0_20px_rgba(52,211,153,0.3)] hover:shadow-[0_0_30px_rgba(52,211,153,0.5)] active:scale-95 transition-all mb-6 text-sm">{loading ? 'Verificando...' : 'Verificar y Entrar'}</button>
                <button type="button" onClick={() => setStep('email')} className="w-full text-[10px] text-slate-500 font-black uppercase tracking-widest hover:text-white transition-colors">← Usar otro correo</button>
              </div>
            )}
          </form>
        </div>
      </AppWrapper>
    )
  }

  return (
    <AppWrapper>
      {infoModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in-fast" onClick={() => setInfoModal({ isOpen: false, title: '', content: '' })}>
          <div className="bg-slate-900 border border-white/10 p-6 md:p-8 rounded-[2rem] max-w-sm w-full shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg md:text-xl font-black text-cyan-400 mb-4 uppercase tracking-widest">{infoModal.title}</h3>
            <p className="text-slate-300 text-xs md:text-sm leading-relaxed mb-8">{infoModal.content}</p>
            <button onClick={() => { triggerHaptic(); setInfoModal({ isOpen: false, title: '', content: '' }); }} className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition-all text-sm">Entendido</button>
          </div>
        </div>
      )}

      {bioModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in-fast" onClick={() => setBioModal({ isOpen: false, nombre: '', guia: null })}>
          <div className="bg-slate-900 border border-cyan-500/30 p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] max-w-lg w-full shadow-[0_0_50px_rgba(6,182,212,0.15)] relative overflow-y-auto max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-[9px] md:text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] block mb-1">Enciclopedia Biomecánica</span>
                <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">{bioModal.nombre}</h3>
              </div>
              <button onClick={() => { triggerHaptic(); setBioModal({ isOpen: false, nombre: '', guia: null }); }} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-slate-400 transition-colors">✕</button>
            </div>
            <div className="space-y-4 md:space-y-6">
              <div className="bg-black/30 p-4 rounded-xl md:rounded-2xl border border-white/5">
                <div className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">🎯 Músculo Objetivo</div>
                <div className="text-xs md:text-sm font-bold text-emerald-400">{bioModal.guia.target}</div>
              </div>
              <div className="bg-black/30 p-4 rounded-xl md:rounded-2xl border border-white/5">
                <div className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">⚙️ Setup (Postura)</div>
                <div className="text-xs md:text-sm text-slate-300 leading-relaxed">{bioModal.guia.setup}</div>
              </div>
              <div className="bg-black/30 p-4 rounded-xl md:rounded-2xl border border-white/5">
                <div className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">🚀 Ejecución</div>
                <div className="text-xs md:text-sm text-slate-300 leading-relaxed">{bioModal.guia.ejecucion}</div>
              </div>
              <div className="bg-cyan-500/10 p-4 rounded-xl md:rounded-2xl border border-cyan-500/20">
                <div className="text-[9px] md:text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-2 flex items-center gap-2">🫁 Respiración & Pro-Tip</div>
                <div className="text-xs md:text-sm text-cyan-100 leading-relaxed">{bioModal.guia.respiracion}</div>
              </div>
            </div>
            <button onClick={() => { triggerHaptic(); setBioModal({ isOpen: false, nombre: '', guia: null }); }} className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-widest py-3 md:py-4 rounded-xl md:rounded-2xl transition-all mt-6 md:mt-8 text-sm">Cerrar Guía</button>
          </div>
        </div>
      )}

      {view === 'create_program' && (
        <div className="p-4 md:p-6 max-w-5xl mx-auto pt-6 md:pt-10 pb-20">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <h2 className="text-2xl md:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 tracking-tight animate-fade-in text-center md:text-left">Diseño Rápido de Arquitectura</h2>
            <TopBarControles />
          </div>
          
          {!programaActivo ? (
            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] p-5 md:p-10 rounded-3xl md:rounded-[2.5rem] grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 shadow-2xl animate-fade-in stagger-1">
              <div className="space-y-6 md:space-y-8">
                  <div>
                    <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center">Enfoque Principal <InfoIcon title="Enfoques" content="Fuerza Base: Entrenar pesado para ganar fuerza. / Hipertrofia: Peso moderado para ganar tamaño." /></label>
                    <div className="flex flex-wrap gap-2 md:gap-3">
                      {['Fuerza Base', 'Hipertrofia', 'Recomposición', 'Mantenimiento'].map(n => (
                        <button key={n} onClick={() => {setFormNombre(n); triggerHaptic();}} className={`px-4 py-2 md:px-5 md:py-2.5 rounded-full text-xs md:text-sm font-bold transition-all duration-300 ${formNombre === n ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'}`}>{n}</button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center">Inicio del Ciclo</label>
                    <div className="relative">
                      <div className="w-full py-3 md:py-4 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm flex items-center justify-center transition-all duration-300 border bg-white/5 border-white/10 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:bg-white/10">
                        📅 {formatDisplayDate(formFecha) || 'Seleccionar Fecha'}
                      </div>
                      <input type="date" value={formFecha} onChange={(e) => {setFormFecha(e.target.value); triggerHaptic();}} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </div>
                  </div>

              </div>
              <div className="space-y-6 md:space-y-8">
                  <div>
                    <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center">Duración (Semanas)</label>
                    <div className="relative">
                      <select value={formSemanas} onChange={e => {setFormSemanas(Number(e.target.value)); triggerHaptic();}} className="w-full bg-white/5 border border-white/10 rounded-xl md:rounded-2xl px-5 py-3 md:py-4 font-black outline-none appearance-none focus:border-cyan-400/50 cursor-pointer transition-colors text-center text-white text-base md:text-lg">
                        {[...Array(24)].map((_, i) => (<option key={i+1} value={i+1} className="bg-slate-900">{i + 1}</option>))}
                      </select>
                      <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-cyan-400">▼</div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center">Frecuencia (Días/Sem)</label>
                    <div className="relative">
                      <select value={formDias} onChange={e => {setFormDias(Number(e.target.value)); triggerHaptic();}} className="w-full bg-white/5 border border-white/10 rounded-xl md:rounded-2xl px-5 py-3 md:py-4 font-black outline-none appearance-none focus:border-cyan-400/50 cursor-pointer transition-colors text-center text-white text-base md:text-lg">
                        {[...Array(7)].map((_, i) => (<option key={i+1} value={i+1} className="bg-slate-900">{i + 1}</option>))}
                      </select>
                      <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-cyan-400">▼</div>
                    </div>
                  </div>
                  <button onClick={crearPrograma} className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-black font-black uppercase tracking-widest py-4 rounded-xl md:rounded-2xl mt-2 md:mt-4 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] active:scale-95 transition-all text-sm">Forjar Calendario</button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 md:space-y-8 max-w-4xl mx-auto animate-fade-in stagger-1">
              <div className="bg-cyan-500/10 border border-cyan-500/20 py-2.5 md:py-3 px-4 md:px-6 rounded-xl md:rounded-2xl text-cyan-400 text-xs md:text-sm font-bold text-center flex items-center justify-center gap-2"><span className="text-lg md:text-xl">✨</span> Programa '{programaActivo.nombre_programa}' en memoria.</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                <form onSubmit={agregarEjercicioCatalogo} className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] p-5 md:p-8 rounded-3xl md:rounded-[2rem] space-y-5 md:space-y-6 shadow-xl h-fit">
                    
                    <div>
                      <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 md:mb-4 flex items-center">Asignar a los días <InfoIcon title="Selección Múltiple" content="Toca varios días para copiar el ejercicio en todos ellos."/></label>
                      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                        {[...Array(programaActivo.dias_por_semana)].map((_, i) => {
                          const diaNum = i + 1;
                          const isSelected = catDias.includes(diaNum);
                          return (
                            <button 
                              key={i} 
                              type="button" 
                              onClick={() => {
                                triggerHaptic();
                                if (isSelected) {
                                  if (catDias.length > 1) setCatDias(catDias.filter(d => d !== diaNum));
                                } else {
                                  setCatDias([...catDias, diaNum].sort());
                                }
                              }} 
                              className={`px-4 py-2 md:px-5 md:py-2.5 rounded-full font-bold text-xs md:text-sm whitespace-nowrap transition-all duration-300 flex-shrink-0 border ${isSelected ? 'bg-cyan-500 border-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'}`}
                            >
                              Día {diaNum}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 md:mb-4 block">Modalidad de Ejercicio</label>
                      <div className="flex gap-2 mb-3 md:mb-4">
                        <button type="button" onClick={() => setCatTipo('fuerza')} className={`flex-1 py-2 md:py-2.5 rounded-xl text-[10px] md:text-xs font-black tracking-widest uppercase transition-all ${catTipo === 'fuerza' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-white/5 text-slate-500 border border-white/5 hover:bg-white/10'}`}>Fuerza (Kg)</button>
                        <button type="button" onClick={() => setCatTipo('cardio_tiempo')} className={`flex-1 py-2 md:py-2.5 rounded-xl text-[10px] md:text-xs font-black tracking-widest uppercase transition-all ${catTipo === 'cardio_tiempo' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50' : 'bg-white/5 text-slate-500 border border-white/5 hover:bg-white/10'}`}>Cardio/Tiempo</button>
                      </div>
                      <input type="text" placeholder={catTipo === 'fuerza' ? "Ej. Press de Banca..." : "Ej. Elíptica, Caminadora..."} value={catEj} onChange={e => setCatEj(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl md:rounded-2xl px-4 md:px-5 py-3 md:py-4 font-bold outline-none focus:border-cyan-400/50 transition-colors text-white placeholder-slate-600 text-sm md:text-base" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                      <div>
                        <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 flex items-center">Series</label>
                        <select value={catSeries} onChange={e => {setCatSeries(Number(e.target.value)); triggerHaptic();}} className="w-full bg-white/5 border border-white/10 rounded-xl md:rounded-2xl px-2 py-3 md:py-3.5 font-bold text-center text-white focus:border-cyan-400/50 text-sm md:text-base">
                          {[1,2,3,4,5,6,7,8,9,10].map(s => (<option key={s} value={s} className="bg-slate-900">{s}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 flex items-center">{catTipo === 'fuerza' ? 'Reps' : 'Minutos'}</label>
                        <select value={catReps} onChange={e => {setCatReps(Number(e.target.value)); triggerHaptic();}} className="w-full bg-white/5 border border-white/10 rounded-xl md:rounded-2xl px-2 py-3 md:py-3.5 font-bold text-center text-white focus:border-cyan-400/50 text-sm md:text-base">
                          {[...Array(90)].map((_, i) => (<option key={i+1} value={i+1} className="bg-slate-900">{i + 1}</option>))}
                        </select>
                      </div>
                      
                      {catTipo === 'fuerza' && (
                        <div>
                          <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 flex items-center">Peso Base</label>
                          <input type="number" value={catPeso} onChange={e => setCatPeso(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl md:rounded-2xl px-2 py-3 md:py-3.5 font-bold text-center text-white outline-none focus:border-cyan-400/50 transition-colors placeholder-slate-600 text-sm md:text-base" placeholder={`Ej. 20 ${unidad}`} />
                        </div>
                      )}

                      <div>
                        <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 flex items-center">Desc (s)</label>
                        <select value={catDescanso} onChange={e => {setCatDescanso(Number(e.target.value)); triggerHaptic();}} className="w-full bg-white/5 border border-white/10 rounded-xl md:rounded-2xl px-2 py-3 md:py-3.5 font-bold text-center text-white focus:border-cyan-400/50 text-sm md:text-base">
                          <option value="0" className="bg-slate-900">0s (N/A)</option><option value="30" className="bg-slate-900">30s</option><option value="60" className="bg-slate-900">60s</option><option value="90" className="bg-slate-900">90s</option><option value="120" className="bg-slate-900">120s</option>
                        </select>
                      </div>
                    </div>
                    <button type="submit" className="w-full bg-white/10 text-white font-black uppercase tracking-widest py-3.5 md:py-4 rounded-xl md:rounded-2xl mt-2 md:mt-4 hover:bg-white/20 border border-white/10 active:scale-95 transition-all text-xs md:text-sm">+ Agregar Ejercicio</button>
                </form>

                <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] p-5 md:p-8 rounded-3xl md:rounded-[2rem] shadow-xl flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Arsenal Registrado</label>
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[300px] md:max-h-[400px] pr-2 space-y-2 md:space-y-3 no-scrollbar mb-4 md:mb-6">
                    {catalogo.length === 0 ? (
                      <div className="text-slate-500 text-xs md:text-sm italic text-center py-8 md:py-10">Aún no hay ejercicios cargados.</div>
                    ) : (
                      catalogo.map(ej => {
                        const esCardio = ej.tipo_ejercicio === 'cardio_tiempo';
                        return (
                        <div key={ej.id} className="bg-white/5 border border-white/5 p-3 md:p-4 rounded-xl md:rounded-2xl flex justify-between items-center hover:border-white/20 transition-colors">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="bg-cyan-500/20 text-cyan-400 text-[8px] md:text-[10px] font-black px-2 py-0.5 md:py-1 rounded-md">DÍA {ej.dia_asignado}</span>
                              <span className="font-bold text-white text-xs md:text-sm">{ej.nombre_ejercicio}</span>
                            </div>
                            <div className={`text-[10px] md:text-xs font-bold ml-10 md:ml-12 ${esCardio ? 'text-rose-400/80' : 'text-slate-400'}`}>
                              {ej.series_objetivo}x{ej.reps_objetivo} {esCardio?'min':'reps'} 
                              {!esCardio && ej.peso_objetivo > 0 && ` • Base: ${unidad === 'lbs' ? (ej.peso_objetivo * 2.20462).toFixed(1).replace(/\.0$/, '') : ej.peso_objetivo} ${unidad}`}
                              {ej.descanso_segundos>0 && ` • ⏱️${ej.descanso_segundos}s`}
                            </div>
                          </div>
                          <button onClick={() => eliminarEjercicioCatalogo(ej.id)} className="w-8 h-8 md:w-10 md:h-10 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center hover:bg-red-500/20 active:scale-90 transition-all border border-red-500/20">✕</button>
                        </div>
                      )})
                    )}
                  </div>
                  <button onClick={() => {setView('dashboard'); triggerHaptic();}} className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-black font-black uppercase tracking-widest py-4 md:py-5 rounded-xl md:rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] active:scale-95 transition-all mt-auto text-xs md:text-sm">✅ Guardar y Activar Programa</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'dashboard' && (() => {
        
        const progresoPct = estadisticas.totalSesiones > 0 ? Math.min((estadisticas.asistencias / estadisticas.totalSesiones) * 100, 100) : 0;
        const resumenEjerciciosHoy = catalogo.filter(c => c.dia_asignado === diaToca);
        
        // --- COHORTES SEMANALES ---
        let cohortesSemanales = [];
        let semanaActualNum = 1;
        let statusSemanaActual = { asistencias: 0, meta: 1, pct: 0 };
        let datosGraficoCumplimiento = [];

        if (programaActivo) {
            const metaSemanal = programaActivo.dias_por_semana;
            semanaActualNum = getWeekNumber(fDate(hoy), programaActivo.fecha_inicio);
            const maxWeeks = Math.max(programaActivo.semanas_duracion, semanaActualNum);
            
            cohortesSemanales = Array.from({ length: maxWeeks }, (_, i) => ({
                semana: i + 1,
                sesiones: [],
                asistencias: 0,
                volumenTotal: 0,
                cumplimientoPct: 0
            }));

            historialActivo.forEach(sesion => {
                const w = getWeekNumber(sesion.fecha_registro, programaActivo.fecha_inicio);
                if(w >= 1 && w <= maxWeeks) {
                    cohortesSemanales[w - 1].sesiones.push(sesion);
                    if(sesion.es_asistencia) {
                        cohortesSemanales[w - 1].asistencias += 1;
                        cohortesSemanales[w - 1].volumenTotal += sesion.tonelaje;
                    }
                }
            });

            cohortesSemanales.forEach(c => {
                c.cumplimientoPct = Math.min((c.asistencias / metaSemanal) * 100, 100);
                c.sesiones.sort((a,b) => new Date(b.fecha_registro) - new Date(a.fecha_registro)); 
            });

            if(semanaActualNum <= maxWeeks) {
                const currentC = cohortesSemanales[semanaActualNum - 1];
                statusSemanaActual = { asistencias: currentC.asistencias, meta: metaSemanal, pct: currentC.cumplimientoPct };
            }

            datosGraficoCumplimiento = cohortesSemanales.filter(c => c.semana <= semanaActualNum).map(c => ({
                name: `Sem ${c.semana}`, cumplimiento: c.cumplimientoPct
            }));
        }

        const chartData = historialActivo.filter(h => h.es_asistencia).sort((a,b) => new Date(a.fecha_registro) - new Date(b.fecha_registro)).slice(-10);
        const chartDataFormatted = chartData.map(d => ({
            fecha: formatDisplayDate(d.fecha_registro).substring(0,5),
            volumen: unidad === 'lbs' ? Math.round(d.tonelaje * 2.20462) : Math.round(d.tonelaje)
        }));

        const semanasConData = cohortesSemanales.filter(c => c.semana <= semanaActualNum && c.sesiones.length > 0).slice().reverse();

        return (
          <div className="p-4 md:p-6 max-w-6xl mx-auto pt-6 md:pt-12">
            
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-8 animate-fade-in gap-4 md:gap-4">
              <div>
                <h1 className="text-2xl md:text-5xl font-black uppercase bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 tracking-tighter text-center md:text-left">{programaActivo.nombre_programa}</h1>
                <p className="text-[10px] md:text-sm text-slate-500 font-bold uppercase mt-1 md:mt-2 tracking-[0.2em] text-center md:text-left">Semana {Math.floor(estadisticas.asistencias / programaActivo.dias_por_semana) + 1} de {programaActivo.semanas_duracion}</p>
              </div>
              <TopBarControles />
            </div>

            <div className="flex gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5 mb-6 md:mb-10 w-full max-w-md mx-auto md:mx-0 animate-fade-in">
              <button onClick={() => {setDashTab('resumen'); triggerHaptic();}} className={`flex-1 py-2.5 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center ${dashTab === 'resumen' ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                <ActivityIcon /> Entrenar
              </button>
              <button onClick={() => {setDashTab('analiticas'); triggerHaptic();}} className={`flex-1 py-2.5 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center ${dashTab === 'analiticas' ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                <ChartIcon /> Analíticas
              </button>
            </div>

            {/* ========================================================= */}
            {/* PESTAÑA 1: ENTRENAMIENTO */}
            {/* ========================================================= */}
            {dashTab === 'resumen' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10 animate-fade-in">
                
                <div className="md:col-span-6 flex flex-col gap-5 md:gap-6">
                  <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-3xl md:rounded-[2.5rem] p-5 md:p-8 shadow-xl">
                    <div className="flex justify-between text-[9px] md:text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-4 items-center">
                      <span>Progreso Total <InfoIcon title="Progreso" content="Sesiones completadas vs faltantes del plan actual."/></span>
                      <span className="text-white">{estadisticas.asistencias} / {estadisticas.totalSesiones} Sesiones</span>
                    </div>
                    <div className="w-full bg-black/50 rounded-full h-3 mb-6 border border-white/5 p-0.5">
                        <div className="bg-gradient-to-r from-blue-600 to-cyan-400 h-full rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(6,182,212,0.5)]" style={{ width: `${progresoPct}%` }}></div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <div className="text-[8px] md:text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1 flex items-center">Fin Teórico <InfoIcon title="Fin Teórico" content="Si vas todos los días sin fallar."/></div>
                        <div className="font-black text-xs md:text-sm text-white">{formatDisplayDate(programaActivo.fecha_fin_teorica)}</div>
                      </div>
                      <div className="bg-red-500/5 p-3 rounded-xl border border-red-500/20">
                        <div className="text-[8px] md:text-[9px] text-red-400/80 font-black uppercase tracking-[0.2em] mb-1 flex items-center">Fin Ajustado <InfoIcon title="Fin Ajustado" content="La realidad. Si faltas, esto se estira."/></div>
                        <div className="font-black text-xs md:text-sm text-red-300">{formatDisplayDate(programaActivo.fecha_fin_estimada)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-6 flex flex-col gap-4 md:gap-5">
                  
                  {/* UX FIX: Máquina del Tiempo Restaurada en Pestaña Entrenamiento */}
                  <div className="bg-white/[0.02] backdrop-blur-xl p-5 md:p-6 rounded-3xl md:rounded-[2rem] border border-white/[0.05] shadow-xl relative">
                    <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-3 md:mb-4 flex items-center">Fecha de Transacción <InfoIcon title="Máquina del Tiempo" content="Selecciona la fecha exacta de tu entrenamiento antes de iniciarlo."/></label>
                    <div className="relative">
                      <div className="w-full py-3 md:py-4 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm flex items-center justify-center transition-all duration-300 border bg-white/5 border-white/10 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:bg-white/10">
                        📅 {formatDisplayDate(fechaRegistro) || 'Seleccionar Fecha'}
                      </div>
                      <input type="date" value={fechaRegistro} onChange={(e) => {setFechaRegistro(e.target.value); triggerHaptic();}} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </div>
                  </div>

                  <div className="bg-white/[0.02] backdrop-blur-xl p-5 md:p-6 rounded-3xl md:rounded-[2rem] border border-white/[0.05] shadow-xl flex-1 flex flex-col">
                    <div>
                      <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 flex items-center">Rutina Seleccionada</label>
                      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-2 md:mb-4">
                        {[...Array(programaActivo.dias_por_semana)].map((_, i) => (
                          <button key={i} onClick={() => { setDiaToca(i + 1); triggerHaptic(); }} className={`px-4 py-2 md:px-5 md:py-2.5 rounded-full font-bold text-xs md:text-sm whitespace-nowrap transition-all duration-300 flex-shrink-0 border ${diaToca === i + 1 ? 'bg-cyan-500 border-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'}`}>
                            Día {i + 1}
                          </button>
                        ))}
                      </div>
                    </div>

                    {resumenEjerciciosHoy.length > 0 ? (
                      <ul className="space-y-2 md:space-y-3 mb-4 md:mb-6">
                        {resumenEjerciciosHoy.map(ej => {
                          const isC = ej.tipo_ejercicio === 'cardio_tiempo';
                          return (
                          <li key={ej.id} className="flex justify-between items-center bg-white/5 p-3 rounded-xl md:rounded-2xl border border-white/5">
                            <span className="font-bold text-xs md:text-sm text-white">{ej.nombre_ejercicio}</span>
                            <span className={`text-[10px] md:text-xs font-bold ${isC ? 'text-rose-400':'text-cyan-400'}`}>{ej.series_objetivo}x{ej.reps_objetivo} {isC?'min':''}</span>
                          </li>
                        )})}
                      </ul>
                    ) : (
                      <div className="text-slate-500 text-xs italic text-center py-8 flex-1 flex items-center justify-center">Sin catálogo asignado para el Día {diaToca}.</div>
                    )}
                    <button onClick={iniciarEntrenamiento} className="w-full h-16 md:h-20 bg-gradient-to-r from-cyan-500 to-blue-500 text-black font-black uppercase tracking-[0.2em] text-sm md:text-lg rounded-xl md:rounded-2xl hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] active:scale-95 transition-all mt-auto">▶ Iniciar Día {diaToca}</button>
                  </div>
                </div>
              </div>
            )}


            {/* ========================================================= */}
            {/* PESTAÑA 2: ANALÍTICAS */}
            {/* ========================================================= */}
            {dashTab === 'analiticas' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10 animate-fade-in">
                
                <div className="md:col-span-6 flex flex-col gap-5 md:gap-6">
                  
                  <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-3xl md:rounded-[2.5rem] p-5 md:p-8 shadow-xl">
                    <div className="flex justify-between text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] mb-4 items-center">
                        <span className="text-slate-500 flex items-center">Progreso de la Semana {semanaActualNum} <InfoIcon title="Cumplimiento" content="Basado en tu fecha de inicio."/></span>
                        <span className={`${statusSemanaActual.pct >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>{statusSemanaActual.asistencias} / {statusSemanaActual.meta} Días</span>
                    </div>
                    <div className="w-full bg-black/50 rounded-full h-2 md:h-3 border border-white/5 p-0.5">
                        <div className={`h-full rounded-full transition-all duration-1000 ${statusSemanaActual.pct >= 100 ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]'}`} style={{ width: `${statusSemanaActual.pct}%` }}></div>
                    </div>
                  </div>

                  <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-3xl md:rounded-[2.5rem] p-5 md:p-8 shadow-xl">
                    <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 flex items-center">
                      Disciplina Semanal Histórica <InfoIcon title="Disciplina" content="Verde: Completaste la meta. Naranja: A medias. Gris: Faltaste."/>
                    </label>
                    <div className="h-40 md:h-48 w-full mt-4 md:mt-6 -ml-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={datosGraficoCumplimiento} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                          <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip content={renderTooltipBar} cursor={{ fill: '#ffffff05' }} />
                          <Bar dataKey="cumplimiento" radius={[4, 4, 0, 0]} maxBarSize={40}>
                            {datosGraficoCumplimiento.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.cumplimiento >= 100 ? '#34d399' : (entry.cumplimiento > 0 ? '#fbbf24' : '#334155')} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-3xl md:rounded-[2.5rem] p-5 md:p-8 shadow-xl">
                    <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 flex items-center">
                      Tendencia de Sobrecarga (Fuerza) <InfoIcon title="Curva de Volumen" content="Suma del peso x repeticiones de tus series normales (N). Excluye calentamientos y cardio."/>
                    </label>
                    {chartDataFormatted.length > 0 ? (
                      <div className="h-48 md:h-56 w-full mt-4 md:mt-6 -ml-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartDataFormatted} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                              <defs>
                                <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                              <XAxis dataKey="fecha" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                              <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => val} />
                              <Tooltip content={renderTooltipArea} cursor={{ stroke: '#ffffff20', strokeWidth: 2 }} />
                              <Area type="monotone" dataKey="volumen" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorVol)" activeDot={{ r: 6, fill: "#06b6d4", stroke: "#020617", strokeWidth: 3 }}>
                                 <LabelList dataKey="volumen" position="top" fill="#22d3ee" fontSize={9} fontWeight="bold" offset={10} />
                              </Area>
                            </AreaChart>
                          </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-48 md:h-56 flex items-center justify-center text-slate-500 text-xs italic">Completa una sesión para generar tu gráfica.</div>
                    )}
                  </div>
                </div>

                <div className="md:col-span-6 flex flex-col gap-5 md:gap-6">
                  
                  <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-3xl md:rounded-[2.5rem] p-5 md:p-8 shadow-xl">
                     <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center">
                        Estado de Recuperación Muscular <InfoIcon title="Fatiga Neural" content="100% = Descansado. Basado en tus sesiones de las últimas 48 horas."/>
                     </label>
                     <div className="space-y-4 mt-6">
                        {Object.entries(fatiga).map(([musculo, valor]) => (
                           <div key={musculo}>
                              <div className="flex justify-between text-[9px] md:text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">
                                 <span>{musculo}</span>
                                 <span className={valor < 50 ? 'text-amber-400' : 'text-emerald-400'}>{valor}%</span>
                              </div>
                              <div className="w-full bg-black/50 rounded-full h-1.5 border border-white/5">
                                  <div className={`h-full rounded-full transition-all duration-1000 ${valor < 50 ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]' : 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]'}`} style={{ width: `${valor}%` }}></div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>

                  <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-3xl md:rounded-[2.5rem] p-5 md:p-8 shadow-xl flex flex-col h-[500px] md:h-[650px] overflow-hidden">
                    
                    <div className="flex justify-between items-center mb-4 md:mb-5 shrink-0">
                      <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center">
                        Log de Transacciones <InfoIcon title="Cohortes Semanales" content="Tus sesiones agrupadas por semana."/>
                      </label>
                      <div className="relative">
                        <div className="text-cyan-400 text-[9px] font-black tracking-widest hover:text-cyan-300 transition-colors cursor-pointer bg-cyan-500/10 px-3 py-1.5 rounded-lg border border-cyan-500/20">
                           + INSERTAR
                        </div>
                        <input type="date" value={fechaRegistro} onChange={(e) => {setFechaRegistro(e.target.value); triggerHaptic();}} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      </div>
                    </div>

                    <div className="overflow-y-auto pr-2 space-y-3 no-scrollbar h-full pb-6">
                      {semanasConData.length === 0 ? (
                        <div className="text-slate-500 text-xs italic text-center py-10">La bóveda de transacciones está vacía.</div>
                      ) : (
                        semanasConData.map(cohorte => {
                          const isExpanded = semanaExpandida === cohorte.semana;
                          const volTotalDisplay = unidad === 'lbs' ? (cohorte.volumenTotal * 2.20462).toFixed(0) : Math.round(cohorte.volumenTotal);
                          
                          let headerColor = "text-slate-400 bg-white/5 border-white/5";
                          if (cohorte.cumplimientoPct >= 100) headerColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
                          else if (cohorte.cumplimientoPct > 0) headerColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";

                          return (
                            <div key={`sem-${cohorte.semana}`} className="bg-black/30 border border-white/5 rounded-2xl flex flex-col transition-colors group">
                               
                               <div className={`flex justify-between items-center cursor-pointer p-4 rounded-2xl transition-all border ${headerColor}`} onClick={() => toggleSemanaLog(cohorte.semana)}>
                                  <div>
                                     <div className="font-black text-xs md:text-sm uppercase tracking-widest mb-1">
                                        SEMANA {cohorte.semana}
                                     </div>
                                     <div className="text-[9px] md:text-[10px] font-bold opacity-80 uppercase tracking-widest flex gap-3">
                                        <span>✓ {cohorte.asistencias} Sesiones</span>
                                        <span>⚡ Vol: {volTotalDisplay} {unidad}</span>
                                     </div>
                                  </div>
                                  <div className="font-black text-[10px]">{isExpanded ? '▲' : '▼'}</div>
                               </div>

                               {isExpanded && (
                                  <div className="p-3 space-y-2 animate-fade-in-fast">
                                     {cohorte.sesiones.map(sesion => {
                                        const isDayExpanded = logExpandido === sesion.id;
                                        const tonelajeDisplay = unidad === 'lbs' ? (sesion.tonelaje * 2.20462).toFixed(1).replace(/\.0$/, '') : sesion.tonelaje;
                                        
                                        return (
                                          <div key={sesion.id} className="bg-white/[0.02] border border-white/5 p-3 rounded-xl flex flex-col hover:border-white/10 transition-colors">
                                            <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleLog(sesion.id)}>
                                              <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                  <span className={`text-[8px] md:text-[9px] font-black px-2 py-0.5 rounded-md ${sesion.es_asistencia ? 'bg-cyan-500/20 text-cyan-400' : 'bg-red-500/20 text-red-400'}`}>{sesion.es_asistencia ? `DÍA ${sesion.dia_rutina}` : 'AUSENCIA'}</span>
                                                  <span className="font-bold text-slate-300 text-[10px] md:text-xs">{formatDisplayDate(sesion.fecha_registro.substring(0, 10))}</span>
                                                </div>
                                                {sesion.es_asistencia && (
                                                  <div className="text-[9px] text-slate-500 font-bold ml-1">Total: <span className="text-slate-400 ml-1">{tonelajeDisplay} {unidad}</span></div>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-3">
                                                <button onClick={(e) => { e.stopPropagation(); eliminarSesionHistorica(sesion.id); }} className="w-6 h-6 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center hover:bg-red-500/20 active:scale-90 transition-all border border-red-500/20">✕</button>
                                              </div>
                                            </div>

                                            {isDayExpanded && sesion.es_asistencia && (
                                              <div className="mt-3 pt-3 border-t border-white/10 space-y-2 animate-fade-in-fast cursor-default" onClick={e => e.stopPropagation()}>
                                                {sesion.ejercicios_rutina?.map((ej, ejIdx) => {
                                                  const isCardio = ej.tipo_ejercicio === 'cardio_tiempo';
                                                  return (
                                                    <div key={ejIdx} className="bg-black/40 rounded-lg p-2 border border-white/5">
                                                      <div className="flex justify-between items-center mb-2">
                                                        <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-wider ${isCardio?'text-rose-400':'text-cyan-400'}`}>{ej.nombre_ejercicio}</span>
                                                      </div>
                                                      <div className="space-y-1">
                                                        {ej.series_ejercicio?.sort((a,b) => a.numero_serie - b.numero_serie).map((serie, sIdx) => {
                                                          const pesoDisplay = isCardio ? serie.peso_kg : (unidad === 'lbs' ? (serie.peso_kg * 2.20462).toFixed(1).replace(/\.0$/, '') : serie.peso_kg);
                                                          const tipoStr = serie.tipo_serie === 'W' ? '(W)' : (serie.tipo_serie === 'D' ? '(Drop)' : '');
                                                          return (
                                                            <div key={sIdx} className="flex justify-between text-[8px] md:text-[9px] text-slate-300 font-bold border-b border-white/5 pb-1 pt-0.5 last:border-0 last:pb-0">
                                                              <span className="text-slate-500 tracking-widest uppercase">Set {serie.numero_serie} <span className="text-amber-500">{tipoStr}</span></span>
                                                              {isCardio ? (
                                                                <span className="text-white">{serie.repeticiones} min <span className="text-slate-500 mx-1">@</span> Lvl <span className="text-rose-400">{pesoDisplay}</span></span>
                                                              ) : (
                                                                <span className="text-white">{serie.repeticiones} reps <span className="text-slate-500 mx-1">@</span> <span className="text-cyan-400">{pesoDisplay} {unidad}</span></span>
                                                              )}
                                                            </div>
                                                          )
                                                        })}
                                                      </div>
                                                    </div>
                                                  )
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        )
                                     })}
                                  </div>
                               )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        )
      })()}

      {view === 'workout' && (
        <div className="p-4 md:p-6 max-w-5xl mx-auto pt-6 md:pt-8 pb-20 md:pb-24 min-h-[80vh] flex flex-col relative">
          
          <div className="flex flex-row justify-between items-center mb-6 md:mb-8 animate-fade-in gap-4 z-50">
            <h2 className="text-xl md:text-3xl font-black uppercase bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 tracking-tight">🔴 Día {diaToca}</h2>
            <div className="flex gap-2 flex-wrap justify-end">
              <TopBarControles />
              <button onClick={() => {setView('dashboard'); triggerHaptic();}} className="text-[8px] md:text-[10px] font-black uppercase tracking-widest bg-white/10 hover:bg-white/20 border border-white/10 px-4 md:px-6 py-1.5 md:py-2 rounded-lg md:rounded-xl transition-all text-slate-300 flex items-center justify-center">Pausar / Salir</button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10 flex-1">
            
            <div className="lg:col-span-4 animate-fade-in stagger-1">
              <div className={`flex flex-row lg:flex-col items-center justify-between lg:justify-center p-4 lg:p-10 rounded-2xl lg:rounded-[2.5rem] border transition-all duration-500 sticky top-2 lg:top-8 backdrop-blur-2xl z-40 shadow-2xl ${timerDescanso > 0 ? 'bg-cyan-950/90 border-cyan-400/50 text-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.2)]' : 'bg-slate-900/90 border-white/10 text-slate-400'}`}>
                <div className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] lg:mb-4 text-left lg:text-center flex items-center gap-2">
                   {timerDescanso > 0 ? <span className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-cyan-400 animate-pulse"></span> : '⏱️'} Descanso
                </div>
                <div className="text-4xl lg:text-8xl font-black tabular-nums tracking-tighter text-right lg:text-center" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTime(timerDescanso)}</div>
              </div>
              <button onClick={finalizarEntrenamientoHoy} className="hidden lg:block w-full bg-gradient-to-r from-emerald-400 to-emerald-600 text-black font-black uppercase tracking-widest py-5 rounded-2xl mt-8 hover:shadow-[0_0_30px_rgba(52,211,153,0.4)] active:scale-95 transition-all">✅ Finalizar Rutina</button>
            </div>

            <div className="lg:col-span-8 space-y-5 md:space-y-6 flex flex-col">
              {ejerciciosHoy.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] animate-fade-in">
                  <p className="text-slate-500 text-center italic text-sm">El catálogo para el Día {diaToca} está vacío.</p>
                </div>
              ) : (
                !ejercicioExpandido ? (
                  <div className="space-y-3 md:space-y-4 animate-fade-in flex-1">
                     <div className="flex justify-between items-center mb-4 md:mb-6 px-1 md:px-2">
                        <h3 className="text-slate-500 font-black uppercase tracking-widest text-[10px] md:text-xs">Resumen de Operaciones</h3>
                        <span className="text-cyan-400 font-bold text-[10px] md:text-xs">{ejerciciosHoy.length} Asignados</span>
                     </div>
                     {ejerciciosHoy.map((ej, idx) => {
                       const completados = workoutData[ej.id]?.filter(s => s.completado && s.tipoSerie === 'N').length || 0;
                       const totalSeries = ej.series_objetivo;
                       const terminado = completados >= totalSeries;
                       const isCardio = ej.tipo_ejercicio === 'cardio_tiempo';

                       return (
                         <div key={ej.id} onClick={() => { setEjercicioExpandido(ej.id); triggerHaptic(); }} className={`p-4 md:p-6 rounded-3xl md:rounded-[2rem] border transition-all cursor-pointer flex items-center justify-between group animate-fade-in ${terminado ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.02] backdrop-blur-xl border-white/[0.05] hover:border-cyan-500/50 hover:bg-white/[0.05]'}`} style={{animationDelay: `${idx * 50}ms`}}>
                            <div>
                               <h4 className={`text-sm md:text-lg font-black uppercase ${terminado ? 'text-emerald-400' : 'text-white group-hover:text-cyan-400'} transition-colors`}>{ej.nombre_ejercicio}</h4>
                               <p className="text-[9px] md:text-xs text-slate-500 font-bold mt-1 tracking-widest uppercase">{completados} de {totalSeries} Sets {isCardio ? '(Cardio)' : ''}</p>
                            </div>
                            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full border-2 flex items-center justify-center transition-all ${terminado ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400' : 'border-white/10 group-hover:border-cyan-400/50 text-slate-600 group-hover:text-cyan-400'}`}>
                               {terminado ? <span className="font-black text-base md:text-lg">✓</span> : <span className="font-black text-sm md:text-base ml-0.5 md:ml-1">▶</span>}
                            </div>
                         </div>
                       )
                     })}
                  </div>
                ) : (
                  <div className="animate-fade-in flex flex-col flex-1">
                    <button onClick={() => { setEjercicioExpandido(null); triggerHaptic(); }} className="mb-4 md:mb-6 text-slate-400 font-black text-[9px] md:text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors w-full md:w-fit px-5 md:px-6 py-3 md:py-3 bg-white/5 rounded-xl md:rounded-2xl border border-white/5 shadow-lg active:scale-95">
                      ← Volver a la Lista
                    </button>
                    
                    {ejerciciosHoy.filter(e => e.id === ejercicioExpandido).map((ej) => {
                      const prKey = ej.nombre_ejercicio.trim().toUpperCase();
                      const esCardio = ej.tipo_ejercicio === 'cardio_tiempo';
                      const textoRendimientoAnterior = rendimientoPrevio[prKey];
                      const setsCompletados = workoutData[ej.id]?.filter(s => s.completado && s.tipoSerie === 'N') || [];
                      
                      let max1RM_kg = 0;
                      if (!esCardio) {
                        setsCompletados.forEach(set => {
                          const peso_kg = unidad === 'lbs' ? (parseFloat(set.peso) || 0) / 2.20462 : (parseFloat(set.peso) || 0);
                          const rm = calcular1RM(peso_kg, set.reps);
                          if (rm > max1RM_kg) max1RM_kg = rm;
                        });
                      }
                      const display1RM = max1RM_kg > 0 ? (unidad === 'lbs' ? (max1RM_kg * 2.20462).toFixed(1).replace(/\.0$/, '') : max1RM_kg.toFixed(1).replace(/\.0$/, '')) : null;

                      return (
                        <div key={ej.id} className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] p-5 md:p-8 rounded-3xl md:rounded-[2.5rem] flex flex-col flex-1 shadow-2xl">
                          <div className="mb-5 md:mb-6">
                            <div className="flex flex-col items-start gap-2">
                              <div className="flex items-center gap-2 md:gap-3">
                                <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white">{ej.nombre_ejercicio}</h3>
                                <button onClick={() => openBiomecanica(ej.nombre_ejercicio)} className="bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-400 text-[9px] md:text-[10px] font-black uppercase px-2 md:px-3 py-1 md:py-1.5 rounded-lg md:rounded-xl border border-cyan-500/30 transition-all active:scale-95 flex items-center gap-1"><span className="text-xs md:text-sm">🧬</span> Guía</button>
                              </div>
                              {textoRendimientoAnterior && (
                                 <div className="bg-white/5 border border-white/10 text-slate-400 text-[9px] md:text-[10px] font-black uppercase px-2 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg flex items-center gap-1.5 md:gap-2">👻 Última: {textoRendimientoAnterior} {esCardio?'':'kg'}</div>
                              )}
                            </div>
                            <p className="text-[10px] md:text-xs text-slate-500 font-bold mt-2 md:mt-3 tracking-[0.1em]">Objetivo: {ej.series_objetivo}x{ej.reps_objetivo} <span className="ml-2 text-cyan-400/70">• ⏱️ {ej.descanso_segundos}s</span></p>
                          </div>
                          
                          <div className="space-y-2 md:space-y-3 flex-1">
                            <div className="flex text-[9px] md:text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] px-1 md:px-2 mb-1 md:mb-2 gap-2">
                              <div className="w-12 md:w-16 text-center">Set <InfoIcon title="Tipos de Serie" content="N = Normal, W = Calentamiento (No suma a métricas), D = Drop-set"/></div>
                              <div className="flex-1 text-center flex items-center justify-center">{esCardio ? 'Nivel/Vel' : `Peso (${unidad})`}</div>
                              <div className="flex-1 text-center flex items-center justify-center">{esCardio ? 'Minutos' : 'Reps'}</div>
                              <div className="w-12 md:w-14 text-center">Status</div>
                            </div>
                            {workoutData[ej.id]?.map((set, i) => {
                              const esW = set.tipoSerie === 'W'; const esD = set.tipoSerie === 'D';
                              let badgeColor = "bg-white/10 text-slate-400 border-white/5";
                              if (esW) badgeColor = "bg-amber-500/20 text-amber-400 border-amber-500/30";
                              if (esD) badgeColor = "bg-rose-500/20 text-rose-400 border-rose-500/30";

                              return (
                              <div key={i} className={`flex items-center gap-2 p-1.5 md:p-2 rounded-xl md:rounded-2xl border transition-all duration-300 ${set.completado ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-black/40 border-white/5 hover:bg-white/5'}`}>
                                
                                <button onClick={() => toggleTipoSerie(ej.id, i)} disabled={set.completado || esCardio} className={`w-12 md:w-16 h-12 md:h-12 rounded-lg md:rounded-xl font-black text-xs md:text-sm flex flex-col items-center justify-center transition-all border ${badgeColor} disabled:opacity-50`}>
                                  {i + 1} <span className="text-[7px] md:text-[9px] mt-0.5">{set.tipoSerie}</span>
                                </button>

                                <div className="flex-1 flex flex-col items-center justify-center bg-black/20 rounded-lg h-12 overflow-hidden">
                                  <input type="number" step="0.5" value={set.peso} onChange={(e) => updateSet(ej.id, i, 'peso', e.target.value)} disabled={set.completado} className="w-full h-full bg-transparent disabled:opacity-50 text-center font-bold text-white outline-none focus:bg-white/5 transition-colors placeholder-slate-600 text-base md:text-sm" placeholder="0" />
                                  {mostrarConversion && set.peso && !esCardio && !set.completado && (<span className="text-[8px] text-cyan-500/50 absolute bottom-1 font-bold tracking-widest pointer-events-none">{getValorConvertido(set.peso, unidad)}</span>)}
                                </div>
                                <div className="flex-1 flex flex-col items-center justify-center bg-black/20 rounded-lg h-12 overflow-hidden">
                                  <input type="number" value={set.reps} onChange={(e) => updateSet(ej.id, i, 'reps', e.target.value)} disabled={set.completado} className="w-full h-full bg-transparent disabled:opacity-50 text-center font-bold text-white outline-none focus:bg-white/5 transition-colors placeholder-slate-600 text-base md:text-sm" placeholder="0" />
                                </div>
                                
                                <button onClick={() => toggleSet(ej.id, i, ej.descanso_segundos)} className={`w-12 md:w-14 h-12 rounded-lg md:rounded-xl font-black text-base flex items-center justify-center transition-all duration-300 active:scale-90 ${set.completado ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white'}`}>✓</button>
                              </div>
                            )})}
                          </div>

                          <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t border-white/5 flex justify-between items-center bg-black/20 p-3 md:p-4 rounded-xl md:rounded-2xl">
                            <span className="text-[9px] md:text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] flex items-center">
                              {!esCardio ? <>Estimación 1RM <InfoIcon title="One Rep Max" content="Se calcula solo con series Normales (N)."/></> : 'Modo Cardio'}
                            </span>
                            <span className={`text-xs md:text-sm font-black ${esCardio ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {!esCardio ? (display1RM ? `${display1RM} ${unidad}` : '--') : '❤️ Z2/Z3'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              )}
            </div>
          </div>
          
          {!ejercicioExpandido && (
             <button onClick={finalizarEntrenamientoHoy} className="lg:hidden w-full bg-gradient-to-r from-emerald-400 to-emerald-600 text-black font-black uppercase tracking-widest py-4 md:py-5 rounded-xl md:rounded-2xl mt-8 active:scale-95 transition-all shadow-[0_0_30px_rgba(52,211,153,0.3)] text-sm">✅ Finalizar Rutina</button>
          )}
        </div>
      )}
    </AppWrapper>
  )
}