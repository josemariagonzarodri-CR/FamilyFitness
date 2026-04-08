import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. CONFIGURACIÓN DEL DESTINO (SUPABASE)
const supabaseUrl = 'https://ictxvjzhqkxnxonzjmki.supabase.co';
console.log("➡️ URL QUE LEE NODE:", supabaseUrl);
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljdHh2anpocXhrbnhvbnpqbWtpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY5MzE1MCwiZXhwIjoyMDg5MjY5MTUwfQ.Zv1vBY_Fg4FF_2ssDQ1mWoc8KVC-XRToay4Y51zbgus'; // <-- Asegúrate de volver a poner tu llave aquí
const supabase = createClient(supabaseUrl, supabaseKey);

// 2. CONFIGURACIÓN DEL ORIGEN (CARPETA LOCAL)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); 
const EXERCISES_DIR = path.join(__dirname, 'exercises');

async function runETL() {
  console.log('🚀 Iniciando Pipeline ETL de Biomecánica...');
  
  // Extraer todas las subcarpetas de ejercicios
  const folders = fs.readdirSync(EXERCISES_DIR).filter(f => fs.statSync(path.join(EXERCISES_DIR, f)).isDirectory());
  console.log(`📦 Se detectaron ${folders.length} ejercicios para procesar.`);

  let exitosos = 0;

  for (const folder of folders) {
    try {
      const folderPath = path.join(EXERCISES_DIR, folder);
      const files = fs.readdirSync(folderPath); // Lee las fotos (0.jpg, 1.jpg)
      
      // EL FIX ARQUITECTÓNICO: El JSON está afuera de la carpeta, al mismo nivel
      const jsonPath = path.join(EXERCISES_DIR, `${folder}.json`);

      if (!fs.existsSync(jsonPath)) continue; // Si no hay JSON, saltamos

      const rawData = fs.readFileSync(jsonPath);
      const jsonData = JSON.parse(rawData);

      let imagenPublicUrl = null;

      // TRANSFORMACIÓN Y CARGA DE MULTIMEDIA
      const imgFile = files.find(f => f === '1.jpg') || files.find(f => f === '0.jpg');
      
      if (imgFile) {
        const imgBuffer = fs.readFileSync(path.join(folderPath, imgFile));
        const imgExtension = path.extname(imgFile);
        const fileNameToSave = `${jsonData.id}${imgExtension}`; 

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('biomecanica-media')
          .upload(fileNameToSave, imgBuffer, { upsert: true, contentType: 'image/jpeg' });

        if (uploadError) {
          console.error(`❌ Error subiendo imagen de ${jsonData.name}:`, uploadError.message);
        } else {
          const { data: publicUrlData } = supabase.storage.from('biomecanica-media').getPublicUrl(fileNameToSave);
          imagenPublicUrl = publicUrlData.publicUrl;
        }
      }

      // CARGA DE DATOS A SQL
      const { error: dbError } = await supabase.from('enciclopedia_ejercicios').upsert([{
        id: jsonData.id,
        nombre: jsonData.name,
        fuerza: jsonData.force,
        nivel: jsonData.level,
        mecanica: jsonData.mechanic,
        equipamiento: jsonData.equipment,
        musculos_primarios: jsonData.primaryMuscles || [],
        musculos_secundarios: jsonData.secondaryMuscles || [],
        instrucciones: jsonData.instructions || [],
        categoria: jsonData.category,
        imagen_url: imagenPublicUrl
      }]);

      if (dbError) {
        console.error(`❌ Error en base de datos [${jsonData.name}]:`, dbError.message);
      } else {
        exitosos++;
        console.log(`✅ [${exitosos}/${folders.length}] Procesado: ${jsonData.name}`);
      }

    } catch (err) {
      console.error(`⚠️ Error catastrófico en ${folder}:`, err.message);
    }
  }

  console.log(`\n🎉 Pipeline ETL Finalizado. Se migraron ${exitosos} ejercicios exitosamente a Supabase.`);
}

runETL();