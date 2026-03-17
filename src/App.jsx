import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'

const PremiumStyles = () => (
  <style>{`
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .animate-fade-in { animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-fade-in-fast { animation: fadeIn 0.2s ease-out forwards; }
    .stagger-1 { animation-delay: 100ms; opacity: 0; }
    .stagger-2 { animation-delay: 200ms; opacity: 0; }
    .stagger-3 { animation-delay: 300ms; opacity: 0; }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    input[type=number] { -moz-appearance: textfield; }
  `}</style>
)

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
  <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-slate-200 font-sans selection:bg-cyan-500/30 pb-12">
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
  const [loading, setLoading] = useState(false)
  const [unidad, setUnidad] = useState('kg') 
  const [mostrarConversion, setMostrarConversion] = useState(true)

  const [infoModal, setInfoModal] = useState({ isOpen: false, title: '', content: '' })
  const openInfo = (title, content) => { triggerHaptic(); setInfoModal({ isOpen: true, title, content }); }
  const InfoIcon = ({ title, content }) => (
    <button type="button" onClick={(e) => { e.preventDefault(); openInfo(title, content); }} className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[9px] font-black hover:bg-cyan-500/30 transition-all active:scale-90">i</button>
  )
  const [bioModal, setBioModal] = useState({ isOpen: false, nombre: '', guia: null })
  const openBiomecanica = (nombreEjercicio) => { triggerHaptic(); setBioModal({ isOpen: true, nombre: nombreEjercicio, guia: buscarGuia(nombreEjercicio) }); }

  const [programaActivo, setProgramaActivo] = useState(null)
  const [estadisticas, setEstadisticas] = useState({ asistencias: 0, ausencias: 0, totalSesiones: 0 })
  const [catalogo, setCatalogo] = useState([])
  const [historialGlobal, setHistorialGlobal] = useState([]) 
  const [historialActivo, setHistorialActivo] = useState([]) 
  const [logExpandido, setLogExpandido] = useState(null) 
  const [fatiga, setFatiga] = useState({ Pecho: 100, Espalda: 100, Piernas: 100, Hombros: 100, Brazos: 100, Core: 100 })
  const [metricas, setMetricas] = useState({})
  const [rendimientoPrevio, setRendimientoPrevio] = useState({}) // NUEVO: Fantasma de Sobrecarga

  const [diaToca, setDiaToca] = useState(1)
  const [ejerciciosHoy, setEjerciciosHoy] = useState([])
  const [workoutData, setWorkoutData] = useState({}) 
  const [timerDescanso, setTimerDescanso] = useState(0)
  const intervalRef = useRef(null)

  const hoy = new Date();
  const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1);
  const antier = new Date(hoy); antier.setDate(antier.getDate() - 2);
  const fDate = (d) => d.toISOString().split('T')[0];
  
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('T')[0].split('-');
      const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
      return `${d}-${months[parseInt(m, 10) - 1]}-${y.slice(-2)}`;
    } catch(e) { return dateStr; }
  }

  const [formNombre, setFormNombre] = useState('Fuerza Base')
  const [formFecha, setFormFecha] = useState(fDate(hoy))
  const [formSemanas, setFormSemanas] = useState(6)
  const [formDias, setFormDias] = useState(3)
  const [catDia, setCatDia] = useState(1)
  const [catEj, setCatEj] = useState('')
  const [catSeries, setCatSeries] = useState(3)
  const [catReps, setCatReps] = useState(10)
  const [catDescanso, setCatDescanso] = useState(60)
  const [catTipo, setCatTipo] = useState('fuerza') // NUEVO: Selector de Cardio/Fuerza
  const [fechaRegistro, setFechaRegistro] = useState(fDate(hoy))

  const triggerHaptic = () => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15); }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); if(session?.user?.email) cargarPrograma(session.user.email);
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session); if(session?.user?.email) cargarPrograma(session.user.email); else setView('login');
    })
    return () => { subscription.unsubscribe(); detenerTimer(); }
  }, [])

  const cargarPrograma = async (userEmail) => {
    const { data: prog } = await supabase.from('programas_entrenamiento').select('*').eq('email_usuario', userEmail).eq('estado', 'ACTIVO').order('id', { ascending: false }).limit(1).maybeSingle();
    
    // NUEVO: Traemos tipo_ejercicio y tipo_serie de la BD
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
              // CÁLCULO DE TONELAJE (Solo sumamos series Normales 'N' o sin clasificar, no Warmups 'W')
              const seriesValidas = ej.series_ejercicio.filter(s => s.tipo_serie === 'N' || !s.tipo_serie);
              
              if (tipoEj === 'fuerza') {
                seriesValidas.forEach(serie => {
                  tonelaje_kg += (serie.peso_kg * serie.repeticiones);
                  if (serie.peso_kg > statsEjGlobal[nameKey].maxPeso) statsEjGlobal[nameKey].maxPeso = serie.peso_kg; 
                });
              }

              // SISTEMA FANTASMA: Guardar solo la última sesión completada para mostrarla en el UI
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
          musculosTocados.forEach(m => {
            if (fechaSesionStr === fDate(hoy)) musculosFatigaGlobal[m] = 0; 
            else if (fechaSesionStr === fDate(ayer) || fechaSesionStr === fDate(antier)) musculosFatigaGlobal[m] = Math.min(musculosFatigaGlobal[m], 50);
          });
        }
      });
    }

    setHistorialGlobal(historialGlobalLimpio);
    setFatiga(musculosFatigaGlobal);
    setMetricas(statsEjGlobal);
    setRendimientoPrevio(fantasmasPrevios);

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
    const { error } = await supabase.from('catalogo_rutina').insert([{ programa_id: programaActivo.id, dia_asignado: catDia, nombre_ejercicio: catEj, series_objetivo: catSeries, reps_objetivo: catReps.toString(), descanso_segundos: catDescanso, tipo_ejercicio: catTipo }]);
    if(!error) { 
      setCatEj(''); 
      const { data: cat } = await supabase.from('catalogo_rutina').select('*').eq('programa_id', programaActivo.id).order('dia_asignado', { ascending: true });
      if (cat) setCatalogo(cat);
    }
  }

  const eliminarEjercicioCatalogo = async (idEjercicio) => { triggerHaptic(); await supabase.from('catalogo_rutina').delete().eq('id', idEjercicio); const { data: cat } = await supabase.from('catalogo_rutina').select('*').eq('programa_id', programaActivo.id).order('dia_asignado', { ascending: true }); if (cat) setCatalogo(cat); }
  
  const eliminarSesionHistorica = async (idSesion) => {
    triggerHaptic();
    if(!window.confirm("¿Eliminar este registro de operaciones? Se recalculará tu progreso al instante.")) return;
    await supabase.from('sesiones_familiares').delete().eq('id', idSesion); cargarPrograma(session.user.email);
  }

  const toggleLog = (idSesion) => { triggerHaptic(); setLogExpandido(prev => prev === idSesion ? null : idSesion); }

  const exportarDatosCSV = () => {
    triggerHaptic();
    if (!historialGlobal || historialGlobal.length === 0) return alert("No hay datos históricos para exportar.");
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
    triggerHaptic();
    if(!window.confirm("¿Registrar ausencia y estirar el calendario?")) return;
    const dateIso = new Date(fechaRegistro + 'T12:00:00Z').toISOString();
    await supabase.from('sesiones_familiares').insert([{ email_usuario: session.user.email, es_asistencia: false, programa_id: programaActivo.id, fecha_registro: dateIso }]);
    const nuevaFechaFin = new Date(programaActivo.fecha_fin_estimada); nuevaFechaFin.setDate(nuevaFechaFin.getDate() + 1);
    await supabase.from('programas_entrenamiento').update({ fecha_fin_estimada: nuevaFechaFin.toISOString().split('T')[0] }).eq('id', programaActivo.id);
    setFechaRegistro(fDate(hoy)); cargarPrograma(session.user.email);
  }

  const iniciarEntrenamiento = () => {
    triggerHaptic();
    const ejHoy = catalogo.filter(c => c.dia_asignado === diaToca);
    const dataInicial = {};
    ejHoy.forEach(ej => {
      const nameKey = ej.nombre_ejercicio.trim().toUpperCase();
      const maxPeso_kg = metricas[nameKey]?.maxPeso || 0; 
      let pesoSugerido = '';
      if (ej.tipo_ejercicio === 'cardio_tiempo') {
         pesoSugerido = 0; // Nivel por defecto
      } else {
         if (maxPeso_kg > 0) pesoSugerido = unidad === 'lbs' ? (maxPeso_kg * 2.20462).toFixed(1).replace(/\.0$/, '') : maxPeso_kg;
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
    const { data: newSession, error: sessionError } = await supabase.from('sesiones_familiares').insert([{ email_usuario: session.user.email, es_asistencia: true, programa_id: programaActivo.id, dia_rutina: diaToca, fecha_registro: dateIso }]).select().single();
    if (sessionError) return alert("Fallo de comunicación con la base de datos.");
    
    for (const ej of ejerciciosHoy) {
      const sets = workoutData[ej.id] || [];
      const completedSets = sets.filter(s => s.completado); 
      if (completedSets.length > 0) {
          const { data: newEj } = await supabase.from('ejercicios_rutina').insert([{ sesion_id: newSession.id, nombre_ejercicio: ej.nombre_ejercicio, tipo_ejercicio: ej.tipo_ejercicio || 'fuerza' }]).select().single();
          if (newEj) {
              const seriesToInsert = completedSets.map((s, index) => {
                  const valorDigitado = parseFloat(s.peso) || 0;
                  // Si es cardio, guardamos el nivel directo sin convertir. Si es fuerza, convertimos si está en libras.
                  const pesoParaSQL = (ej.tipo_ejercicio === 'cardio_tiempo') ? valorDigitado : (unidad === 'lbs' ? (valorDigitado / 2.20462) : valorDigitado);
                  return { ejercicio_id: newEj.id, numero_serie: index + 1, peso_kg: pesoParaSQL, repeticiones: parseInt(s.reps) || 0, tipo_serie: s.tipoSerie || 'N' };
              });
              await supabase.from('series_ejercicio').insert(seriesToInsert);
          }
      }
    }
    alert("🏆 ¡Sesión guardada en la Bóveda de Titanio!");
    setFechaRegistro(fDate(hoy)); cargarPrograma(session.user.email); setView('dashboard');
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
    <div className="flex gap-2 items-center flex-wrap justify-center z-50">
      <button onClick={() => { triggerHaptic(); setUnidad(u => u === 'kg' ? 'lbs' : 'kg'); }} className="text-[10px] font-black uppercase tracking-widest bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-4 py-2 rounded-xl transition-all">{unidad === 'kg' ? 'Kg' : 'Lbs'}</button>
      <button onClick={() => { triggerHaptic(); setMostrarConversion(!mostrarConversion); }} className="text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl transition-all text-slate-300">{mostrarConversion ? '🔀 Dual' : '1️⃣ Único'}</button>
      <button onClick={() => { triggerHaptic(); setSession(null); supabase.auth.signOut(); }} className="text-[10px] font-black uppercase tracking-widest bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-4 py-2 rounded-xl transition-all">Salir</button>
    </div>
  )

  if (view === 'login') {
    return (
      <AppWrapper>
        <div className="min-h-screen flex items-center justify-center p-6">
          <form onSubmit={step === 'email' ? handleLogin : handleVerify} className="w-full max-w-md bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] p-10 rounded-[2rem] shadow-2xl animate-fade-in relative overflow-hidden">
            <div className="absolute top-[-50px] right-[-50px] w-32 h-32 bg-cyan-500/20 rounded-full blur-[50px] pointer-events-none"></div>
            <h1 className="text-4xl font-black mb-10 text-center tracking-tighter relative z-10">TITANIUM <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">CORE</span></h1>
            {step === 'email' ? (
              <div className="animate-fade-in">
                <input type="email" placeholder="Correo electrónico (o dev)" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-2xl px-5 py-4 mb-6 focus:border-cyan-400/50 outline-none text-white placeholder-slate-500 transition-colors" required />
                <button type="submit" className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-black font-black uppercase tracking-widest py-4 rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] active:scale-95 transition-all">{loading ? 'Conectando...' : 'Acceso Seguro'}</button>
              </div>
            ) : (
              <div className="animate-fade-in">
                <p className="text-xs text-slate-400 text-center mb-6 font-bold uppercase tracking-widest">Ingresa el código que enviamos a<br/><span className="text-cyan-400 block mt-2">{email}</span></p>
                <input type="text" placeholder="--------" value={token} onChange={(e) => setToken(e.target.value)} maxLength={8} className="w-full bg-black/50 border border-white/10 rounded-2xl px-5 py-4 mb-6 focus:border-cyan-400/50 outline-none text-white placeholder-slate-500 transition-colors text-center text-3xl tracking-[0.5em] font-black" required />
                <button type="submit" className="w-full bg-gradient-to-r from-emerald-400 to-emerald-600 text-black font-black uppercase tracking-widest py-4 rounded-2xl shadow-[0_0_20px_rgba(52,211,153,0.3)] hover:shadow-[0_0_30px_rgba(52,211,153,0.5)] active:scale-95 transition-all mb-6">{loading ? 'Verificando...' : 'Verificar y Entrar'}</button>
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
          <div className="bg-slate-900 border border-white/10 p-8 rounded-[2rem] max-w-sm w-full shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-black text-cyan-400 mb-4 uppercase tracking-widest">{infoModal.title}</h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-8">{infoModal.content}</p>
            <button onClick={() => { triggerHaptic(); setInfoModal({ isOpen: false, title: '', content: '' }); }} className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition-all">Entendido</button>
          </div>
        </div>
      )}

      {bioModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in-fast" onClick={() => setBioModal({ isOpen: false, nombre: '', guia: null })}>
          <div className="bg-slate-900 border border-cyan-500/30 p-8 rounded-[2.5rem] max-w-lg w-full shadow-[0_0_50px_rgba(6,182,212,0.15)] relative overflow-y-auto max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] block mb-1">Enciclopedia Biomecánica</span>
                <h3 className="text-2xl font-black text-white uppercase tracking-tight">{bioModal.nombre}</h3>
              </div>
              <button onClick={() => { triggerHaptic(); setBioModal({ isOpen: false, nombre: '', guia: null }); }} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-slate-400 transition-colors">✕</button>
            </div>
            <div className="space-y-6">
              <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">🎯 Músculo Objetivo</div>
                <div className="text-sm font-bold text-emerald-400">{bioModal.guia.target}</div>
              </div>
              <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">⚙️ Setup (Postura)</div>
                <div className="text-sm text-slate-300 leading-relaxed">{bioModal.guia.setup}</div>
              </div>
              <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">🚀 Ejecución</div>
                <div className="text-sm text-slate-300 leading-relaxed">{bioModal.guia.ejecucion}</div>
              </div>
              <div className="bg-cyan-500/10 p-4 rounded-2xl border border-cyan-500/20">
                <div className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-2 flex items-center gap-2">🫁 Respiración & Pro-Tip</div>
                <div className="text-sm text-cyan-100 leading-relaxed">{bioModal.guia.respiracion}</div>
              </div>
            </div>
            <button onClick={() => { triggerHaptic(); setBioModal({ isOpen: false, nombre: '', guia: null }); }} className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-widest py-4 rounded-2xl transition-all mt-8">Cerrar Guía</button>
          </div>
        </div>
      )}

      {view === 'create_program' && (
        <div className="p-6 max-w-5xl mx-auto pt-10 pb-20">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 tracking-tight animate-fade-in text-center md:text-left">Diseño Rápido de Arquitectura</h2>
            <TopBarControles />
          </div>
          
          {!programaActivo ? (
            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] p-8 md:p-10 rounded-[2.5rem] grid grid-cols-1 md:grid-cols-2 gap-10 shadow-2xl animate-fade-in stagger-1">
              <div className="space-y-8">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center">Enfoque Principal <InfoIcon title="Enfoques" content="Fuerza Base: Entrenar pesado para ganar fuerza. / Hipertrofia: Peso moderado para ganar tamaño." /></label>
                    <div className="flex flex-wrap gap-3">
                      {['Fuerza Base', 'Hipertrofia', 'Recomposición', 'Mantenimiento'].map(n => (
                        <button key={n} onClick={() => {setFormNombre(n); triggerHaptic();}} className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${formNombre === n ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'}`}>{n}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center">Inicio Histórico del Ciclo</label>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => {setFormFecha(fDate(hoy)); triggerHaptic();}} className={`flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 ${formFecha === fDate(hoy) ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'}`}>Hoy</button>
                      <button type="button" onClick={() => {setFormFecha(fDate(ayer)); triggerHaptic();}} className={`flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 ${formFecha === fDate(ayer) ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'}`}>Ayer</button>
                      <div className="flex-1 relative">
                        <div className={`w-full h-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center transition-all duration-300 border ${(![fDate(hoy), fDate(ayer)].includes(formFecha)) ? 'bg-cyan-500 text-black border-transparent shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
                          📅 {![fDate(hoy), fDate(ayer)].includes(formFecha) ? formatDisplayDate(formFecha) : 'Pasada'}
                        </div>
                        <input type="date" value={formFecha} onChange={(e) => setFormFecha(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      </div>
                    </div>
                  </div>
              </div>
              <div className="space-y-8">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center">Duración (Semanas)</label>
                    <div className="relative">
                      <select value={formSemanas} onChange={e => {setFormSemanas(Number(e.target.value)); triggerHaptic();}} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 font-black outline-none appearance-none focus:border-cyan-400/50 cursor-pointer transition-colors text-center text-white text-lg">
                        {[...Array(24)].map((_, i) => (<option key={i+1} value={i+1} className="bg-slate-900">{i + 1}</option>))}
                      </select>
                      <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-cyan-400">▼</div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center">Frecuencia (Días/Sem)</label>
                    <div className="relative">
                      <select value={formDias} onChange={e => {setFormDias(Number(e.target.value)); triggerHaptic();}} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 font-black outline-none appearance-none focus:border-cyan-400/50 cursor-pointer transition-colors text-center text-white text-lg">
                        {[...Array(7)].map((_, i) => (<option key={i+1} value={i+1} className="bg-slate-900">{i + 1}</option>))}
                      </select>
                      <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-cyan-400">▼</div>
                    </div>
                  </div>
                  <button onClick={crearPrograma} className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-black font-black uppercase tracking-widest py-4 rounded-2xl mt-4 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] active:scale-95 transition-all">Forjar Calendario</button>
              </div>
            </div>
          ) : (
            <div className="space-y-8 max-w-4xl mx-auto animate-fade-in stagger-1">
              <div className="bg-cyan-500/10 border border-cyan-500/20 py-3 px-6 rounded-2xl text-cyan-400 text-sm font-bold text-center flex items-center justify-center gap-2"><span className="text-xl">✨</span> Programa '{programaActivo.nombre_programa}' en memoria.</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <form onSubmit={agregarEjercicioCatalogo} className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] p-8 rounded-[2rem] space-y-6 shadow-xl h-fit">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center">Asignar al</label>
                      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                        {[...Array(programaActivo.dias_por_semana)].map((_, i) => (
                          <button key={i} type="button" onClick={() => {setCatDia(i+1); triggerHaptic();}} className={`px-5 py-2.5 rounded-full font-bold whitespace-nowrap transition-all duration-300 flex-shrink-0 ${catDia === i+1 ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'}`}>Día {i+1}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 block">Modalidad de Ejercicio</label>
                      <div className="flex gap-2 mb-4">
                        <button type="button" onClick={() => setCatTipo('fuerza')} className={`flex-1 py-2 rounded-xl text-xs font-black tracking-widest uppercase transition-all ${catTipo === 'fuerza' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-white/5 text-slate-500 border border-white/5 hover:bg-white/10'}`}>Fuerza (Kg)</button>
                        <button type="button" onClick={() => setCatTipo('cardio_tiempo')} className={`flex-1 py-2 rounded-xl text-xs font-black tracking-widest uppercase transition-all ${catTipo === 'cardio_tiempo' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50' : 'bg-white/5 text-slate-500 border border-white/5 hover:bg-white/10'}`}>Cardio/Tiempo</button>
                      </div>
                      <input type="text" placeholder={catTipo === 'fuerza' ? "Ej. Press de Banca..." : "Ej. Elíptica, Caminadora..."} value={catEj} onChange={e => setCatEj(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 font-bold outline-none focus:border-cyan-400/50 transition-colors text-white placeholder-slate-600" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 flex items-center">Series</label>
                        <select value={catSeries} onChange={e => {setCatSeries(Number(e.target.value)); triggerHaptic();}} className="w-full bg-white/5 border border-white/10 rounded-2xl px-2 py-3.5 font-bold text-center text-white focus:border-cyan-400/50">
                          {[1,2,3,4,5,6,7,8,9,10].map(s => (<option key={s} value={s} className="bg-slate-900">{s}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 flex items-center">{catTipo === 'fuerza' ? 'Reps' : 'Minutos'}</label>
                        <select value={catReps} onChange={e => {setCatReps(Number(e.target.value)); triggerHaptic();}} className="w-full bg-white/5 border border-white/10 rounded-2xl px-2 py-3.5 font-bold text-center text-white focus:border-cyan-400/50">
                          {[...Array(90)].map((_, i) => (<option key={i+1} value={i+1} className="bg-slate-900">{i + 1}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 flex items-center">Desc (s)</label>
                        <select value={catDescanso} onChange={e => {setCatDescanso(Number(e.target.value)); triggerHaptic();}} className="w-full bg-white/5 border border-white/10 rounded-2xl px-2 py-3.5 font-bold text-center text-white focus:border-cyan-400/50">
                          <option value="0" className="bg-slate-900">0s (N/A)</option><option value="30" className="bg-slate-900">30s</option><option value="60" className="bg-slate-900">60s</option><option value="90" className="bg-slate-900">90s</option><option value="120" className="bg-slate-900">120s</option>
                        </select>
                      </div>
                    </div>
                    <button type="submit" className="w-full bg-white/10 text-white font-black uppercase tracking-widest py-4 rounded-2xl mt-4 hover:bg-white/20 border border-white/10 active:scale-95 transition-all">+ Agregar Ejercicio</button>
                </form>

                <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] p-8 rounded-[2rem] shadow-xl flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Arsenal Registrado</label>
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[400px] pr-2 space-y-3 no-scrollbar mb-6">
                    {catalogo.length === 0 ? (
                      <div className="text-slate-500 text-sm italic text-center py-10">Aún no hay ejercicios cargados.</div>
                    ) : (
                      catalogo.map(ej => {
                        const esCardio = ej.tipo_ejercicio === 'cardio_tiempo';
                        return (
                        <div key={ej.id} className="bg-white/5 border border-white/5 p-4 rounded-2xl flex justify-between items-center hover:border-white/20 transition-colors">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="bg-cyan-500/20 text-cyan-400 text-[10px] font-black px-2 py-1 rounded-md">DÍA {ej.dia_asignado}</span>
                              <span className="font-bold text-white text-sm">{ej.nombre_ejercicio}</span>
                            </div>
                            <div className={`text-xs font-bold ml-12 ${esCardio ? 'text-rose-400/80' : 'text-slate-400'}`}>{ej.series_objetivo}x{ej.reps_objetivo} {esCardio?'min':'reps'} {ej.descanso_segundos>0 && `• ⏱️${ej.descanso_segundos}s`}</div>
                          </div>
                          <button onClick={() => eliminarEjercicioCatalogo(ej.id)} className="w-10 h-10 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center hover:bg-red-500/20 active:scale-90 transition-all border border-red-500/20">✕</button>
                        </div>
                      )})
                    )}
                  </div>
                  <button onClick={() => {setView('dashboard'); triggerHaptic();}} className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-black font-black uppercase tracking-widest py-5 rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] active:scale-95 transition-all mt-auto">✅ Guardar y Activar Programa</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'dashboard' && (() => {
        const progresoPct = estadisticas.totalSesiones > 0 ? Math.min((estadisticas.asistencias / estadisticas.totalSesiones) * 100, 100) : 0;
        const resumenEjerciciosHoy = catalogo.filter(c => c.dia_asignado === diaToca);
        const chartData = historialActivo.filter(h => h.es_asistencia).sort((a,b) => new Date(a.fecha_registro) - new Date(b.fecha_registro)).slice(-10);
        const maxVolChart = Math.max(...chartData.map(d => d.tonelaje), 1);

        return (
          <div className="p-6 max-w-6xl mx-auto pt-8 md:pt-12">
            <div className="flex flex-col md:flex-row justify-between items-center mb-10 md:mb-14 animate-fade-in gap-4">
              <div>
                <h1 className="text-3xl md:text-5xl font-black uppercase bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 tracking-tighter text-center md:text-left">{programaActivo.nombre_programa}</h1>
                <p className="text-xs md:text-sm text-slate-500 font-bold uppercase mt-2 tracking-[0.2em] text-center md:text-left">Semana {Math.floor(estadisticas.asistencias / programaActivo.dias_por_semana) + 1} de {programaActivo.semanas_duracion}</p>
              </div>
              <TopBarControles />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10">
              <div className="md:col-span-7 flex flex-col gap-6 animate-fade-in stagger-1">
                
                <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-[2.5rem] p-8 shadow-xl">
                  <div className="flex justify-between text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-6 items-center">
                    <span>Progreso Total <InfoIcon title="Progreso" content="Sesiones hechas vs faltantes del plan actual."/></span>
                    <span className="text-white">{estadisticas.asistencias} / {estadisticas.totalSesiones} Sesiones</span>
                  </div>
                  <div className="w-full bg-black/50 rounded-full h-4 mb-8 border border-white/5 p-1">
                      <div className="bg-gradient-to-r from-blue-600 to-cyan-400 h-full rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(6,182,212,0.5)]" style={{ width: `${progresoPct}%` }}></div>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                      <div className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1 flex items-center">Fin Teórico <InfoIcon title="Fin Teórico" content="Si vas todos los días sin fallar."/></div>
                      <div className="font-black text-sm text-white">{formatDisplayDate(programaActivo.fecha_fin_teorica)}</div>
                    </div>
                    <div className="bg-red-500/5 p-4 rounded-2xl border border-red-500/20">
                      <div className="text-[10px] text-red-400/80 font-black uppercase tracking-[0.2em] mb-1 flex items-center">Fin Ajustado <InfoIcon title="Fin Ajustado" content="La realidad. Si faltas, esto se estira."/></div>
                      <div className="font-black text-sm text-red-300">{formatDisplayDate(programaActivo.fecha_fin_estimada)}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-[2.5rem] p-8 shadow-xl">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 flex items-center">
                    Tendencia de Sobrecarga (Solo Fuerza) <InfoIcon title="Curva de Volumen" content="Suma del peso x repeticiones de tus series normales (N). Excluye calentamientos y cardio."/>
                  </label>
                  {chartData.length > 0 ? (
                    <div className="h-40 w-full flex items-end justify-between gap-1 md:gap-2 mt-6">
                       {chartData.map((d, i) => {
                          const heightPct = Math.max((d.tonelaje / maxVolChart) * 100, 2);
                          const displayVol = unidad === 'lbs' ? (d.tonelaje * 2.20462).toFixed(0) : Math.round(d.tonelaje);
                          return (
                             <div key={i} className="flex flex-col items-center flex-1 group h-full justify-end">
                                <span className="text-[8px] md:text-[10px] text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity mb-2 font-black">{displayVol}</span>
                                <div className="w-full bg-cyan-500/10 rounded-t-md relative flex items-end justify-center group-hover:bg-cyan-500/30 transition-all border-x border-t border-cyan-500/20" style={{ height: `${heightPct}%` }}>
                                   <div className="absolute bottom-0 w-full bg-gradient-to-t from-cyan-600 to-cyan-300 rounded-t-sm shadow-[0_0_10px_rgba(6,182,212,0.8)]" style={{ height: '4px' }}></div>
                                </div>
                                <span className="text-[8px] text-slate-600 mt-3 font-bold">{formatDisplayDate(d.fecha_registro).substring(0,5)}</span>
                             </div>
                          )
                       })}
                    </div>
                  ) : (
                    <div className="h-40 flex items-center justify-center text-slate-500 text-xs italic">Completa una sesión para generar tu gráfica.</div>
                  )}
                </div>

                <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-[2.5rem] p-8 shadow-xl flex-1 max-h-[600px] flex flex-col">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-5 flex items-center">
                    Log de Transacciones <InfoIcon title="Log Detallado" content="Historial de sesiones del programa en curso."/>
                  </label>
                  <div className="overflow-y-auto pr-2 space-y-3 no-scrollbar flex-1">
                    {historialActivo.length === 0 ? (
                      <div className="text-slate-500 text-xs italic text-center py-10">La bóveda de transacciones está vacía.</div>
                    ) : (
                      historialActivo.map(sesion => {
                        const isExpanded = logExpandido === sesion.id;
                        const tonelajeDisplay = unidad === 'lbs' ? (sesion.tonelaje * 2.20462).toFixed(1).replace(/\.0$/, '') : sesion.tonelaje;
                        return (
                          <div key={sesion.id} className="bg-black/30 border border-white/5 p-4 rounded-2xl flex flex-col hover:border-white/10 transition-colors group">
                            <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleLog(sesion.id)}>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-[10px] font-black px-2 py-1 rounded-md ${sesion.es_asistencia ? 'bg-cyan-500/20 text-cyan-400' : 'bg-red-500/20 text-red-400'}`}>{sesion.es_asistencia ? `DÍA ${sesion.dia_rutina}` : 'AUSENCIA'}</span>
                                  <span className="font-bold text-white text-sm">{formatDisplayDate(sesion.fecha_registro.substring(0, 10))}</span>
                                </div>
                                {sesion.es_asistencia && (
                                  <div className="text-xs text-slate-400 font-bold ml-1 flex items-center">Total Sesión: <span className="text-white ml-1 mr-1">{tonelajeDisplay} {unidad}</span></div>
                                )}
                              </div>
                              <div className="flex items-center gap-4">
                                {sesion.es_asistencia && (<span className="text-[10px] text-cyan-500/70 font-black tracking-widest">{isExpanded ? '▲' : '▼'}</span>)}
                                <button onClick={(e) => { e.stopPropagation(); eliminarSesionHistorica(sesion.id); }} className="w-8 h-8 bg-transparent text-slate-600 rounded-full flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 active:scale-90 transition-all border border-transparent opacity-0 group-hover:opacity-100">✕</button>
                              </div>
                            </div>
                            {isExpanded && sesion.es_asistencia && (
                              <div className="mt-4 pt-4 border-t border-white/10 space-y-3 animate-fade-in-fast cursor-default" onClick={e => e.stopPropagation()}>
                                {sesion.ejercicios_rutina?.map((ej, ejIdx) => {
                                  const isCardio = ej.tipo_ejercicio === 'cardio_tiempo';
                                  // Solo calculamos volumen visual para fuerza
                                  const totalEjKg = isCardio ? 0 : (ej.series_ejercicio?.filter(s=> s.tipo_serie==='N' || !s.tipo_serie).reduce((sum, s) => sum + (s.peso_kg * s.repeticiones), 0) || 0);
                                  const totalEjDisplay = unidad === 'lbs' ? (totalEjKg * 2.20462).toFixed(1).replace(/\.0$/, '') : totalEjKg;
                                  return (
                                    <div key={ejIdx} className="bg-white/5 rounded-xl p-3 border border-white/5">
                                      <div className="flex justify-between items-center mb-3">
                                        <span className={`text-xs font-black uppercase tracking-wider ${isCardio?'text-rose-400':'text-cyan-400'}`}>{ej.nombre_ejercicio}</span>
                                        {!isCardio && <span className="text-[10px] font-black text-white bg-black/40 px-2 py-1 rounded-lg border border-white/10">Vol: {totalEjDisplay} {unidad}</span>}
                                      </div>
                                      <div className="space-y-1">
                                        {ej.series_ejercicio?.sort((a,b) => a.numero_serie - b.numero_serie).map((serie, sIdx) => {
                                          const pesoDisplay = isCardio ? serie.peso_kg : (unidad === 'lbs' ? (serie.peso_kg * 2.20462).toFixed(1).replace(/\.0$/, '') : serie.peso_kg);
                                          const tipoStr = serie.tipo_serie === 'W' ? '(W)' : (serie.tipo_serie === 'D' ? '(Drop)' : '');
                                          return (
                                            <div key={sIdx} className="flex justify-between text-[10px] text-slate-300 font-bold border-b border-white/5 pb-1.5 pt-1 last:border-0 last:pb-0">
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
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="md:col-span-5 flex flex-col gap-5 animate-fade-in stagger-2">
                <div className="bg-white/[0.02] backdrop-blur-xl p-6 rounded-[2rem] border border-white/[0.05] shadow-xl relative">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-4 flex items-center">Fecha de la Transacción <InfoIcon title="Máquina del Tiempo" content="Para registrar un día pasado."/></label>
                  <div className="flex gap-2">
                    <button onClick={() => {setFechaRegistro(fDate(hoy)); triggerHaptic();}} className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all duration-300 ${fechaRegistro === fDate(hoy) ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'}`}>Hoy</button>
                    <button onClick={() => {setFechaRegistro(fDate(ayer)); triggerHaptic();}} className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all duration-300 ${fechaRegistro === fDate(ayer) ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'}`}>Ayer</button>
                    <div className="flex-1 relative">
                      <div className={`w-full h-full py-3 rounded-xl font-bold text-xs flex items-center justify-center transition-all duration-300 border ${(![fDate(hoy), fDate(ayer)].includes(fechaRegistro)) ? 'bg-cyan-500 text-black border-transparent shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
                        📅 {![fDate(hoy), fDate(ayer)].includes(fechaRegistro) ? formatDisplayDate(fechaRegistro) : 'Pasada'}
                      </div>
                      <input type="date" value={fechaRegistro} onChange={(e) => setFechaRegistro(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </div>
                  </div>
                </div>

                <div className="bg-white/[0.02] backdrop-blur-xl p-6 rounded-[2rem] border border-white/[0.05] shadow-xl flex-1 flex flex-col">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center">Arsenal del Día {diaToca}</label>
                  {resumenEjerciciosHoy.length > 0 ? (
                    <ul className="space-y-3 mb-6">
                      {resumenEjerciciosHoy.map(ej => {
                        const isC = ej.tipo_ejercicio === 'cardio_tiempo';
                        return (
                        <li key={ej.id} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                          <span className="font-bold text-sm text-white">{ej.nombre_ejercicio}</span>
                          <span className={`text-xs font-bold ${isC ? 'text-rose-400':'text-cyan-400'}`}>{ej.series_objetivo}x{ej.reps_objetivo} {isC?'min':''}</span>
                        </li>
                      )})}
                    </ul>
                  ) : (
                    <div className="text-slate-500 text-xs italic text-center py-10 flex-1 flex items-center justify-center">Sin catálogo asignado para este día.</div>
                  )}
                  <button onClick={iniciarEntrenamiento} className="w-full h-20 bg-gradient-to-r from-cyan-500 to-blue-500 text-black font-black uppercase tracking-[0.2em] text-lg rounded-2xl hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] active:scale-95 transition-all mt-auto">▶ Iniciar Día {diaToca}</button>
                </div>

                <div className="pt-6 border-t border-white/5 space-y-3">
                  <button onClick={() => {setView('create_program'); triggerHaptic();}} className="w-full py-4 bg-white/[0.02] border border-white/10 text-cyan-400 font-black uppercase tracking-[0.2em] rounded-[1.5rem] active:scale-95 transition-all hover:bg-white/5 text-[10px]">⚙️ Editar Catálogo</button>
                  <button onClick={exportarDatosCSV} className="w-full py-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black uppercase tracking-[0.2em] rounded-[1.5rem] active:scale-95 transition-all hover:bg-emerald-500/20 text-[10px]">📊 Exportar Data (CSV)</button>
                  <button onClick={registrarAusencia} className="w-full py-4 bg-transparent border border-white/10 text-slate-400 font-black uppercase tracking-[0.2em] rounded-[1.5rem] active:scale-95 transition-all hover:bg-white/5 text-[10px]">⏸️ Registrar Ausencia </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {view === 'workout' && (
        <div className="p-6 max-w-5xl mx-auto pt-8 pb-24 min-h-[80vh] flex flex-col">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 animate-fade-in gap-6">
            <h2 className="text-2xl md:text-3xl font-black uppercase bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 tracking-tight text-center md:text-left">🔴 Día {diaToca}</h2>
            <div className="flex gap-2 flex-wrap justify-center">
              <TopBarControles />
              <button onClick={() => {setView('dashboard'); triggerHaptic();}} className="text-[10px] font-black uppercase tracking-widest bg-white/10 hover:bg-white/20 border border-white/10 px-6 py-2 rounded-xl transition-all text-slate-300 flex items-center justify-center">Pausar</button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 flex-1">
            <div className="lg:col-span-4 animate-fade-in stagger-1">
              <div className={`flex flex-col items-center justify-center p-10 rounded-[2.5rem] border transition-all duration-500 sticky top-8 backdrop-blur-xl min-h-[250px] ${timerDescanso > 0 ? 'bg-cyan-500/10 border-cyan-400/50 text-cyan-400 shadow-[0_0_50px_rgba(6,182,212,0.15)]' : 'bg-white/[0.02] border-white/10 text-slate-500'}`}>
                <div className="text-[10px] font-black uppercase tracking-[0.3em] mb-4 text-center">Descanso</div>
                <div className="text-7xl lg:text-8xl font-black tabular-nums tracking-tighter text-center" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTime(timerDescanso)}</div>
              </div>
              <button onClick={finalizarEntrenamientoHoy} className="hidden lg:block w-full bg-gradient-to-r from-emerald-400 to-emerald-600 text-black font-black uppercase tracking-widest py-5 rounded-2xl mt-8 hover:shadow-[0_0_30px_rgba(52,211,153,0.4)] active:scale-95 transition-all">✅ Guardar Sesión y Pesos</button>
            </div>

            <div className="lg:col-span-8 space-y-6 flex flex-col">
              {ejerciciosHoy.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] animate-fade-in">
                  <p className="text-slate-500 text-center italic text-sm">El catálogo para el Día {diaToca} está vacío.</p>
                </div>
              ) : (
                ejerciciosHoy.map((ej, idx) => {
                  const prKey = ej.nombre_ejercicio.trim().toUpperCase();
                  const esCardio = ej.tipo_ejercicio === 'cardio_tiempo';
                  
                  // FANTASMA DE RENDIMIENTO PREVIO
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
                    <div key={ej.id} className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] p-6 md:p-8 rounded-[2.5rem] hover:border-white/20 transition-all duration-300 animate-fade-in flex flex-col" style={{animationDelay: `${idx * 100}ms`}}>
                      <div className="mb-6">
                        <div className="flex flex-col items-start gap-2">
                          <div className="flex items-center gap-3">
                            <h3 className="text-xl font-black uppercase tracking-tight text-white">{ej.nombre_ejercicio}</h3>
                            <button onClick={() => openBiomecanica(ej.nombre_ejercicio)} className="bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-400 text-[10px] font-black uppercase px-3 py-1.5 rounded-xl border border-cyan-500/30 transition-all active:scale-95 flex items-center gap-1"><span className="text-sm">🧬</span> Guía</button>
                          </div>
                          
                          {/* ETIQUETA DEL FANTASMA */}
                          {textoRendimientoAnterior && (
                             <div className="bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg flex items-center gap-2">👻 Última sesión: {textoRendimientoAnterior} {esCardio?'':'kg'}</div>
                          )}

                        </div>
                        <p className="text-xs text-slate-500 font-bold mt-3 tracking-[0.1em]">Objetivo: {ej.series_objetivo}x{ej.reps_objetivo} <span className="ml-2 text-cyan-400/70">• ⏱️ {ej.descanso_segundos}s</span></p>
                      </div>
                      
                      <div className="space-y-3 flex-1">
                        <div className="flex text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] px-2 mb-2 gap-2">
                          <div className="w-16 text-center">Set <InfoIcon title="Tipos de Serie" content="N = Normal, W = Calentamiento (No suma a métricas), D = Drop-set"/></div>
                          <div className="flex-1 text-center flex items-center justify-center">{esCardio ? 'Nivel/Vel' : `Peso (${unidad})`}</div>
                          <div className="flex-1 text-center flex items-center justify-center">{esCardio ? 'Minutos' : 'Reps'}</div>
                          <div className="w-14 text-center">Status</div>
                        </div>
                        {workoutData[ej.id]?.map((set, i) => {
                          const esW = set.tipoSerie === 'W'; const esD = set.tipoSerie === 'D';
                          let badgeColor = "bg-white/10 text-slate-400"; // Normal
                          if (esW) badgeColor = "bg-amber-500/20 text-amber-400 border border-amber-500/30";
                          if (esD) badgeColor = "bg-rose-500/20 text-rose-400 border border-rose-500/30";

                          return (
                          <div key={i} className={`flex items-center gap-2 p-2 rounded-2xl border transition-all duration-300 ${set.completado ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-black/40 border-white/5 hover:bg-white/5'}`}>
                            
                            {/* BOTON DE TIPO DE SERIE */}
                            <button onClick={() => toggleTipoSerie(ej.id, i)} disabled={set.completado || esCardio} className={`w-16 h-10 rounded-xl font-black text-xs flex items-center justify-center transition-all ${badgeColor} disabled:opacity-50`}>
                              {i + 1} <span className="ml-1 text-[9px]">{set.tipoSerie}</span>
                            </button>

                            <div className="flex-1 flex flex-col items-center">
                              <input type="number" step="0.5" value={set.peso} onChange={(e) => updateSet(ej.id, i, 'peso', e.target.value)} disabled={set.completado} className="w-full bg-white/5 disabled:opacity-50 rounded-xl py-3 text-center font-bold text-white outline-none focus:bg-white/10 transition-colors placeholder-slate-600" placeholder="0" />
                              {mostrarConversion && set.peso && !esCardio && (<span className="text-[9px] text-cyan-500/50 mt-1 font-bold tracking-widest">{getValorConvertido(set.peso, unidad)}</span>)}
                            </div>
                            <input type="number" value={set.reps} onChange={(e) => updateSet(ej.id, i, 'reps', e.target.value)} disabled={set.completado} className="flex-1 bg-white/5 disabled:opacity-50 rounded-xl py-3 text-center font-bold text-white outline-none focus:bg-white/10 transition-colors placeholder-slate-600" placeholder="0" />
                            <button onClick={() => toggleSet(ej.id, i, ej.descanso_segundos)} className={`w-14 h-12 rounded-xl font-black flex items-center justify-center transition-all duration-300 active:scale-90 ${set.completado ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white'}`}>✓</button>
                          </div>
                        )})}
                      </div>

                      <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center">
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] flex items-center">
                          {!esCardio ? <>Estimación 1RM <InfoIcon title="One Rep Max" content="Se calcula solo con series Normales (N)."/></> : 'Modo Cardio Activo'}
                        </span>
                        <span className={`text-sm font-black ${esCardio ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {!esCardio ? (display1RM ? `${display1RM} ${unidad}` : '--') : '❤️ Z2/Z3'}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
          <button onClick={finalizarEntrenamientoHoy} className="lg:hidden w-full bg-gradient-to-r from-emerald-400 to-emerald-600 text-black font-black uppercase tracking-widest py-5 rounded-2xl mt-10 active:scale-95 transition-all shadow-[0_0_30px_rgba(52,211,153,0.3)]">✅ Guardar Sesión y Pesos</button>
        </div>
      )}
    </AppWrapper>
  )
}