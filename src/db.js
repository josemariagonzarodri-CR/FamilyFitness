import Dexie from 'dexie';

// Creamos la base de datos local "TitaniumOfflineDB"
export const db = new Dexie('TitaniumOfflineDB');

// Definimos las tablas y los índices para búsquedas rápidas
db.version(1).stores({
  sesionesPendientes: '++id, email_usuario, programa_id, dia_rutina, fecha_registro, estado_sync',
  seriesPendientes: '++id, sesion_local_id, nombre_ejercicio, tipo_ejercicio, numero_serie, peso_kg, repeticiones, tipo_serie'
});