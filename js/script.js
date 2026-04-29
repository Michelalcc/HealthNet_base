/* js/script.js - Health-Net (completo)
   - Login con roles (admin, doctor1, doctor2, doctor3) / contraseña 1234
   - Seed inicial (pacientes peruanos) en localStorage si no existe
   - Subida de imagen -> parse nombre_apellido -> crear o enlazar paciente
   - IA simulada con distribución 20/30/30/20 y confianza >=91%
   - Guardado de resultados en localStorage; admin puede editar/eliminar
   - Historial clínico con export CSV (incluye nombre de la imagen y fecha)
   - Todas las imágenes referencian assets/images/
*/

/* ---------- CONFIG USUARIOS ---------- */
const USERS = {
  admin:   { username: "admin",   password: "1234", role: "admin",   photo: "assets/images/admin.png" },
  doctor1: { username: "doctor1", password: "1234", role: "doctor",  photo: "assets/images/doctor1.png" },
  doctor2: { username: "doctor2", password: "1234", role: "doctor",  photo: "assets/images/doctor2.png" },
  doctor3: { username: "doctor3", password: "1234", role: "doctor",  photo: "assets/images/doctor3.png" }
};

/* ---------- KEYS ---------- */
const LS_USER = "cf_user";        // usuario activo (username, role, photo)
const LS_HIST = "cf_hist";        // pacientes (historial clínico)
const LS_RESULTS = "cf_results";  // resultados / diagnósticos

/* ---------- UTIL ---------- */
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
const now = () => new Date().toISOString();
const dateYYYYMMDD = () => new Date().toISOString().slice(0,10);
const randInt = (min,max) => Math.floor(Math.random()*(max-min+1))+min;
const sample = arr => arr[Math.floor(Math.random()*arr.length)];
function saveLS(k,v){ localStorage.setItem(k, JSON.stringify(v)) }
function loadLS(k,def=[]) { try{ const v = JSON.parse(localStorage.getItem(k)); return v? v: def } catch(e){ return def } }
function currentUser(){ return JSON.parse(localStorage.getItem(LS_USER) || "null") }

/* ---------- DETECCIÓN DE SEXO por nombre (heurística) ---------- */
const FEMALE = ["maría","maria","ana","sofia","patricia","laura","isabel","carmen","rosa","marta","veronica","gabriela","sandra","luisa","carolina","juliana","daniela","sofia"];
const MALE = ["juan","josé","jose","luis","miguel","carlos","pedro","raul","jorge","francisco","andres","david","eduardo","marcos","luis"];
function detectSex(name){
  if(!name) return "N/A";
  const n = name.toLowerCase();
  if(FEMALE.includes(n)) return "Femenino";
  if(MALE.includes(n)) return "Masculino";
  if(n.endsWith('a')) return "Femenino";
  return "Masculino";
}

/* ---------- SEED (pacientes peruanos y resultados precargados) ---------- */
function seedIfNeeded(){
  if(!localStorage.getItem(LS_HIST)){
    const base = [
      { nombre:"María López", edad:45, sexo:"Femenino", dni:"73214521", antecedentes:"Hipertensión", alergias:"Penicilina", meds:"Losartán", descripcion:"Control rutinario — antecedentes familiares." },
      { nombre:"Juan Quispe", edad:38, sexo:"Masculino", dni:"70234567", antecedentes:"Diabetes tipo II", alergias:"Ninguna", meds:"Metformina", descripcion:"Síntomas leves de fatiga." },
      { nombre:"Rosa Gamarra", edad:52, sexo:"Femenino", dni:"10345678", antecedentes:"Colesterol alto", alergias:"Ibuprofeno", meds:"Atorvastatina", descripcion:"Chequeo preventivo." },
      { nombre:"José Alarcón", edad:60, sexo:"Masculino", dni:"20678945", antecedentes:"Infarto (2019)", alergias:"Ninguna", meds:"Aspirina", descripcion:"Control post-infarto." },
      { nombre:"Carmen Díaz", edad:49, sexo:"Femenino", dni:"89345612", antecedentes:"Hipertensión", alergias:"Ninguna", meds:"Losartán", descripcion:"Seguimiento de HTA." },
      { nombre:"Luis Fernández", edad:55, sexo:"Masculino", dni:"20193456", antecedentes:"Cardiopatía leve", alergias:"Polvo", meds:"Betabloqueador", descripcion:"Evaluación de fibrosis." },
      { nombre:"Marcos Paredes", edad:41, sexo:"Masculino", dni:"44556677", antecedentes:"Sin antecedentes", alergias:"Ninguna", meds:"Ninguna", descripcion:"Chequeo anual." },
      { nombre:"Sofía Morales", edad:29, sexo:"Femenino", dni:"98765123", antecedentes:"Alergia estacional", alergias:"Polvo", meds:"Antihistamínico", descripcion:"Seguimiento alergias." },
      { nombre:"Daniela Huamán", edad:36, sexo:"Femenino", dni:"66778890", antecedentes:"Diabetes gestacional (hist.)", alergias:"Ninguna", meds:"Metformina", descripcion:"Control endocrinológico." },
      { nombre:"Raúl Sánchez", edad:57, sexo:"Masculino", dni:"33445566", antecedentes:"Hipertensión", alergias:"Ninguna", meds:"Enalapril", descripcion:"Control HTA." }
    ];
    const withId = base.map((p,i)=> ({ id: i+1, ...p }));
    saveLS(LS_HIST, withId);
  }

  if(!localStorage.getItem(LS_RESULTS)){
    const hist = loadLS(LS_HIST);
    const doctors = ["doctor1","doctor2","doctor3"];
    const seed = [];
    let id = 1;
    doctors.forEach((doc,di)=>{
      const start = di*3;
      const slice = hist.slice(start, start+5);
      // 3 diagnósticos IA por doctor
      for(let i=0;i<3 && i<slice.length;i++){
        const p = slice[i];
        const choices = ["Patrón normal sin fibrosis","Fibrosis leve detectada","Fibrosis moderada detectada","Fibrosis avanzada detectada"];
        const pick = sample(choices);
        const tipo = /leve/i.test(pick) ? "Leve" : (/moderad/i.test(pick) ? "Moderado" : (/avanzad|grave/i.test(pick) ? "Grave" : "Ninguno"));
        seed.push({
          id: id++,
          paciente: p.nombre,
          doctor: doc,
          resultado: pick,
          fibromas: /fibrosis/i.test(pick) ? "Sí" : "No",
          tipoFibroma: tipo,
          confianza: +(91 + Math.random()*7).toFixed(1),
          recommendation: getRecommendation(pick, tipo),
          treatments: getTreatments(tipo),
          imageData: null,
          imageName: null,
          createdAt: now()
        });
      }
      // 2 manuales por doctor
      for(let j=3;j<5 && j<slice.length;j++){
        const p = slice[j];
        const tipoManual = (j%3===0) ? "Grave" : "Leve";
        seed.push({
          id: id++,
          paciente: p.nombre,
          doctor: doc,
          resultado: `Diagnóstico manual por ${doc}`,
          fibromas: (j%2===0) ? "Sí" : "No",
          tipoFibroma: tipoManual,
          confianza: +(91 + Math.random()*7).toFixed(1),
          recommendation: getRecommendation("", tipoManual),
          treatments: getTreatments(tipoManual),
          imageData: null,
          imageName: null,
          createdAt: now()
        });
      }
    });
    saveLS(LS_RESULTS, seed);
  }
}
seedIfNeeded();

/* ---------- IA: distribución y helpers ---------- */
function sampleDiagnosis(){
  const r = Math.random()*100;
  if(r < 20) return { texto: "Patrón normal sin fibrosis", severity: "Ninguno" };
  if(r < 50) return { texto: "Fibrosis leve detectada", severity: "Leve" };
  if(r < 80) return { texto: "Fibrosis moderada detectada", severity: "Moderado" };
  return { texto: "Fibrosis avanzada detectada", severity: "Grave" };
}
function sampleConfidence(){ return +(91 + Math.random()*7).toFixed(1); }
function getRecommendation(texto, tipo){
  if(/sin fibrosis|patrón normal/i.test(texto) || /ninguno/i.test(tipo)) return "Seguimiento rutinario; controles periódicos.";
  if(/leve/i.test(tipo) || /leve/i.test(texto)) return "Observación y controles cada 6-12 meses; considerar terapias conservadoras si hay síntomas.";
  if(/moderad/i.test(tipo) || /moderad/i.test(texto)) return "Valoración por especialista; controles imagenológicos en 3-6 meses.";
  if(/grave|avanzad/i.test(tipo) || /grave/i.test(texto)) return "Evaluación urgente; considerar intervención.";
  return "Evaluación clínica individualizada.";
}
function getTreatments(tipo){
  const t = (tipo||"").toLowerCase();
  if(/ninguno|sin fibrosis/.test(t)) return ["Observación","Controles periódicos"];
  if(/leve/.test(t)) return ["Terapia conservadora","Control imagenológico 6-12 meses","Manejo sintomático"];
  if(/moderado/.test(t)) return ["Terapia médica","Resonancia de control 3-6 meses","Considerar opciones no invasivas"];
  if(/grave/.test(t)) return ["Considerar intervención quirúrgica","Plan multidisciplinario","Monitoreo intensivo"];
  return ["Evaluación individualizada"];
}

/* ---------- RENDER / EVENT HANDLERS ---------- */
document.addEventListener("DOMContentLoaded", ()=>{

  /* ---------- LOGIN PAGE ---------- */
  const loginForm = document.getElementById("loginForm");
  if(loginForm){
    loginForm.addEventListener("submit", e=>{
      e.preventDefault();
      const u = document.getElementById("username").value.trim();
      const p = document.getElementById("password").value.trim();
      const msg = document.getElementById("loginMessage");
      msg.textContent = "";
      const found = Object.values(USERS).find(x => x.username === u && x.password === p);
      if(!found){ msg.textContent = "Usuario o contraseña incorrectos."; return; }
      // guardar usuario activo (username, role, photo)
      saveLS(LS_USER, { username: found.username, role: found.role, photo: found.photo });
      window.location.href = "inicio.html";
    });
  }

  /* ---------- INICIO (dashboard) ---------- */
  if(window.location.pathname.endsWith("inicio.html")){
    const user = currentUser();
    if(!user) { window.location.href = "index.html"; return; }

    // cargar datos del usuario (foto y nombre)
    const sidePhotoEl = document.getElementById("sidePhoto");
    const sideNameEl = document.getElementById("sideName");
    const sideRoleEl = document.getElementById("sideRole");
    if(sidePhotoEl) sidePhotoEl.src = user.photo;
    if(sideNameEl) sideNameEl.textContent = cap(user.username);
    if(sideRoleEl) sideRoleEl.textContent = cap(user.role);

    // botones y navegación
    document.getElementById("mResultados").addEventListener("click", ()=> location.href = "resultado.html");
    document.getElementById("mNuevo").addEventListener("click", ()=> location.href = "nuevo_diagnostico.html");
    document.getElementById("mHistorial").addEventListener("click", ()=> location.href = "historial.html");
    const btnTabla = document.getElementById("mTabla");
    if(btnTabla){
      if(user.role !== "admin") btnTabla.style.display = "none";
      else btnTabla.addEventListener("click", ()=> location.href = "tabla.html");
    }

    // logout
    const logoutBtn = document.getElementById("logoutBtn");
    if(logoutBtn) logoutBtn.addEventListener("click", logout);

    // stats dinámicos
    const hist = loadLS(LS_HIST);
    const results = loadLS(LS_RESULTS);
    document.getElementById("statPatients").textContent = hist.length;
    document.getElementById("statIA").textContent = results.filter(r => /Fibrosis|Patrón|detectada|sin fibrosis/i.test(r.resultado)).length;
    document.getElementById("statManual").textContent = results.filter(r => /manual/i.test(r.resultado)).length;
    const avg = results.length ? (results.reduce((s,r)=> s + (parseFloat(r.confianza)||0), 0)/results.length).toFixed(1) : "0";
    document.getElementById("statAcc").textContent = avg + "%";

    // recientes
    const recent = results.slice().sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt)).slice(0,6);
    const recentList = document.getElementById("recentList");
    recentList.innerHTML = "";
    recent.forEach(r=>{
      const div = document.createElement("div");
      div.className = "recent-item";
      const fecha = r.createdAt ? new Date(r.createdAt).toLocaleString() : "";
      div.innerHTML = `<div><strong>${escapeHtml(r.paciente)}</strong><div class="muted small">${escapeHtml(r.doctor)} • ${fecha}</div></div><div><span class="badge">${escapeHtml(r.tipoFibroma||'—')}</span></div>`;
      recentList.appendChild(div);
    });
  }

  /* ---------- NUEVO DIAGNOSTICO ---------- */
  if(window.location.pathname.endsWith("nuevo_diagnostico.html")){
    const user = currentUser();
    if(!user) { window.location.href = "index.html"; return; }
    if(user.role !== "doctor"){ alert("Solo doctores pueden crear diagnósticos."); window.location.href="inicio.html"; return; }

    // cargar foto y nombre del doctor en sidebar
    document.getElementById("sidePhoto_new").src = user.photo;
    document.getElementById("sideName_new").textContent = cap(user.username);
    document.getElementById("sideRole_new").textContent = cap(user.role);
    document.getElementById("logoutBtn_new").addEventListener("click", logout);

    const input = document.getElementById("imageInput");
    const preview = document.getElementById("preview");
    const diagMsg = document.getElementById("diagMsg");
    const iaBox = document.getElementById("iaBox");
    const iaText = document.getElementById("ia_text");
    const iaConf = document.getElementById("ia_conf");
    const iaBar = document.getElementById("ia_bar");
    const iaLevel = document.getElementById("ia_level");
    const iaReco = document.getElementById("ia_reco");
    const iaTreats = document.getElementById("ia_treats");
    const doctorFib = document.getElementById("doctorFib");
    const doctorTipo = document.getElementById("doctorTipo");
    const saveBtn = document.getElementById("saveBtn");
    const analyzeBtn = document.getElementById("analyzeBtn");

    let uploadedData = null; // dataURL
    let parsed = null;
    let lastDiag = null;

    function renderPatientToUI(p){
      document.getElementById("p_name").textContent = p.nombre;
      document.getElementById("p_age").textContent = p.edad;
      document.getElementById("p_sex").textContent = p.sexo;
      document.getElementById("p_dni").textContent = p.dni;
      document.getElementById("p_history").textContent = p.antecedentes;
      document.getElementById("p_allergies").textContent = p.alergias;
      document.getElementById("p_meds").textContent = p.meds || "Ninguna";
    }

    input.addEventListener("change", (e)=>{
      diagMsg.textContent = "";
      const file = e.target.files[0];
      if(!file){ diagMsg.textContent = "No se seleccionó archivo."; return; }
      // preview
      const reader = new FileReader();
      reader.onload = ()=>{
        preview.src = reader.result;
        preview.style.display = "block";
        uploadedData = reader.result;
      };
      reader.readAsDataURL(file);

      // parse filename -> nombre_apellido
      const base = file.name.split(".")[0];
      const tokens = base.replace(/[-\s]+/g,"_").split("_").filter(Boolean);
      const firstRaw = tokens[0] || "Paciente";
      const lastRaw = tokens[1] || "";
      const first = cap(firstRaw);
      const last = cap(lastRaw);
      const fullname = last ? `${first} ${last}` : first;
      parsed = { first, last, fullname };

      // find patient or create
      let hist = loadLS(LS_HIST);
      let found = hist.find(h => h.nombre.toLowerCase() === fullname.toLowerCase());
      if(!found){
        const newP = {
          id: hist.length ? Math.max(...hist.map(x=>x.id))+1 : 1,
          nombre: fullname,
          edad: 25 + randInt(0,55),
          sexo: detectSex(firstRaw),
          dni: String(10000000 + randInt(0,89999999)),
          antecedentes: sample(["Hipertensión","Diabetes","Colesterol alto","Sin antecedentes","Cardiopatía leve"]),
          alergias: sample(["Ninguna","Penicilina","Ibuprofeno","Polvo","Alergia alimentaria"]),
          meds: sample(["Ninguna","Losartán","Metformina","Atorvastatina","Betabloqueador"]),
          descripcion: `${fullname} — creado al subir imagen.`
        };
        hist.push(newP);
        saveLS(LS_HIST, hist);
        found = newP;
      }
      renderPatientToUI(found);

      // reset IA UI and auto-run analysis
      iaBox.style.display = "none";
      lastDiag = null;
      doctorFib.value = "";
      doctorTipo.value = "";
      doctorFib.disabled = true;
      doctorTipo.disabled = true;
      runAnalysis(); // automático al subir
    });

    function runAnalysis(){
      if(!uploadedData){ diagMsg.textContent = "Sube la imagen antes de analizar."; return; }
      diagMsg.textContent = "Analizando...";
      analyzeBtn.disabled = true;

      setTimeout(()=>{
        const sampled = sampleDiagnosis();
        const conf = sampleConfidence();
        const reco = getRecommendation(sampled.texto, sampled.severity);
        const treats = getTreatments(sampled.severity);
        // mostrar UI
        iaBox.style.display = "block";
        iaText.textContent = sampled.texto;
        iaConf.textContent = conf;
        iaBar.style.width = conf + "%";
        iaLevel.textContent = sampled.severity;
        iaReco.textContent = reco;
        iaTreats.innerHTML = treats.map(t => `<li>${t}</li>`).join("");
        // comportamiento auto relleno
        if(sampled.severity === "Ninguno"){
          doctorFib.value = "No";
          doctorTipo.value = "Ninguno";
          doctorFib.disabled = true;
          doctorTipo.disabled = true;
        } else {
          doctorFib.value = "Sí";
          doctorTipo.value = sampled.severity;
          doctorFib.disabled = false;
          doctorTipo.disabled = false;
        }
        lastDiag = { texto: sampled.texto, severity: sampled.severity, confianza: conf, reco, treats };
        diagMsg.textContent = "Análisis completado.";
        analyzeBtn.disabled = false;
      }, 900);
    }

    analyzeBtn.addEventListener("click", runAnalysis);

    saveBtn.addEventListener("click", ()=>{
      if(!lastDiag){ diagMsg.textContent = "Analice antes de guardar."; return; }
      // ensure patient exists in history
      const hist = loadLS(LS_HIST);
      const patientName = parsed ? parsed.fullname : document.getElementById("p_name").textContent;
      let patient = hist.find(h => h.nombre.toLowerCase() === patientName.toLowerCase());
      if(!patient){
        patient = {
          id: hist.length ? Math.max(...hist.map(x=>x.id))+1 : 1,
          nombre: patientName,
          edad: parseInt(document.getElementById("p_age").textContent) || 40,
          sexo: document.getElementById("p_sex").textContent || "N/A",
          dni: document.getElementById("p_dni").textContent || String(10000000+randInt(0,89999999)),
          antecedentes: document.getElementById("p_history").textContent || "Sin antecedentes",
          alergias: document.getElementById("p_allergies").textContent || "Ninguna",
          meds: document.getElementById("p_meds").textContent || "Ninguna",
          descripcion: "Creado al guardar diagnóstico."
        };
        hist.push(patient);
        saveLS(LS_HIST, hist);
      }

      // imageName basado en parsed
      const baseName = parsed ? `${parsed.first.toLowerCase()}${parsed.last?("_"+parsed.last.toLowerCase()):""}` : patient.nombre.toLowerCase().replace(/\s+/g,"_");
      const results = loadLS(LS_RESULTS);
      let imageName = baseName + ".jpg";
      const existingNames = results.map(r=> r.imageName ).filter(Boolean);
      if(existingNames.includes(imageName)){
        let i=1; while(existingNames.includes(`${baseName}_${i}.jpg`)) i++; imageName = `${baseName}_${i}.jpg`;
      }

      const rec = {
        id: results.length ? Math.max(...results.map(r=>r.id))+1 : 1,
        paciente: patient.nombre,
        doctor: currentUser().username,
        resultado: lastDiag.texto,
        fibromas: (doctorFib.value) ? doctorFib.value : (lastDiag.severity === "Ninguno" ? "No" : "Sí"),
        tipoFibroma: (doctorTipo.value) ? doctorTipo.value : lastDiag.severity,
        confianza: lastDiag.confianza,
        recommendation: lastDiag.reco,
        treatments: lastDiag.treats,
        imageData: uploadedData,
        imageName,
        createdAt: now()
      };

      results.push(rec);
      saveLS(LS_RESULTS, results);
      diagMsg.textContent = "Diagnóstico guardado correctamente.";
      setTimeout(()=> location.href = "resultado.html", 700);
    });
  }

  /* ---------- RESULTADOS PAGE ---------- */
  if(window.location.pathname.endsWith("resultado.html")){
    const user = currentUser();
    if(!user) { location.href = "index.html"; return; }
    const sidePhoto = document.getElementById("sidePhoto_res");
    if(sidePhoto) sidePhoto.src = user.photo;
    document.getElementById("sideName_res").textContent = cap(user.username);
    document.getElementById("sideRole_res").textContent = cap(user.role);
    document.getElementById("logoutBtn_res").addEventListener("click", logout);

    const tbody = document.querySelector("#tblResults tbody");
    tbody.innerHTML = "";
    const all = loadLS(LS_RESULTS);
    // rows where doctor property stores username (e.g., 'doctor1')
    const rows = user.role === "admin" ? all : all.filter(r => r.doctor === user.username);
    if(!rows.length) tbody.innerHTML = `<tr><td colspan="7" class="muted">No hay resultados</td></tr>`;
    else {
      rows.forEach(r=>{
        const tr = document.createElement("tr");
        const imgHtml = r.imageData ? `<img src="${r.imageData}" style="width:90px;height:60px;object-fit:cover;border-radius:8px;cursor:pointer" onclick="openImage('${r.imageData}')">` : `<img src="${USERS[r.doctor]?.photo||'assets/images/logo.png'}" style="width:60px;height:60px;border-radius:999px">`;
        tr.innerHTML = `
          <td>${imgHtml}</td>
          <td><strong>${escapeHtml(r.paciente)}</strong><div class="muted small">${r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</div></td>
          <td>${escapeHtml(r.doctor)}</td>
          <td>${escapeHtml(r.resultado)}</td>
          <td>${r.confianza}%</td>
          <td>${escapeHtml(r.recommendation)}</td>
          <td>${Array.isArray(r.treatments) ? r.treatments.join(' • ') : r.treatments}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  /* ---------- TABLA (admin) ---------- */
  if(window.location.pathname.endsWith("tabla.html")){
    const user = currentUser();
    if(!user){ location.href = "index.html"; return; }
    if(user.role !== "admin"){ alert("Acceso denegado"); location.href = "inicio.html"; return; }
    document.getElementById("sidePhoto_tab").src = user.photo;
    document.getElementById("sideName_tab").textContent = cap(user.username);
    document.getElementById("sideRole_tab").textContent = cap(user.role);
    document.getElementById("logoutBtn_tab").addEventListener("click", logout);

    const tbody = document.querySelector("#tblGeneral tbody");
    tbody.innerHTML = "";
    const all = loadLS(LS_RESULTS);
    if(!all.length) tbody.innerHTML = `<tr><td colspan="9" class="muted">No hay registros</td></tr>`;
    else {
      all.forEach((r, idx)=>{
        const imgCell = r.imageData ? `<img src="${r.imageData}" style="width:90px;height:60px;object-fit:cover;border-radius:8px;cursor:pointer" onclick="openImage('${r.imageData}')">` : `<img src="${USERS[r.doctor]?.photo||'assets/images/logo.png'}" style="width:60px;height:60px;border-radius:999px">`;
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${r.id}</td>
          <td>${escapeHtml(r.paciente)}</td>
          <td>${escapeHtml(r.doctor)}</td>
          <td>${escapeHtml(r.resultado)}</td>
          <td>${escapeHtml(r.fibromas)}</td>
          <td>${escapeHtml(r.tipoFibroma)}</td>
          <td>${r.confianza}%</td>
          <td>${imgCell}</td>
          <td>
            <button class="btn" onclick="adminEdit(${idx})">Editar</button>
            <button class="btn danger" onclick="adminDelete(${idx})">Eliminar</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  /* ---------- HISTORIAL PAGE (export CSV) ---------- */
  if(window.location.pathname.endsWith("historial.html")){
    const user = currentUser();
    if(!user) { location.href="index.html"; return; }
    document.getElementById("sidePhoto_hist").src = user.photo;
    document.getElementById("sideName_hist").textContent = cap(user.username);
    document.getElementById("sideRole_hist").textContent = cap(user.role);
    document.getElementById("logoutBtn_hist").addEventListener("click", logout);

    const list = document.getElementById("histList");
    const hist = loadLS(LS_HIST);
    list.innerHTML = "";
    if(!hist.length) list.innerHTML = `<div class="muted">No hay pacientes</div>`;
    else {
      const resultsAll = loadLS(LS_RESULTS);
      hist.forEach(p=>{
        // último resultado del paciente (si existe)
        const foundResult = resultsAll.slice().reverse().find(r => r.paciente && r.paciente.toLowerCase() === p.nombre.toLowerCase());
        const imgSrc = foundResult && foundResult.imageData ? foundResult.imageData : 'assets/images/logo.png';
        const imgName = foundResult && foundResult.imageName ? foundResult.imageName : '';

        const div = document.createElement("div");
        div.className = "patient-card card";
        div.innerHTML = `
          <img src="${imgSrc}" alt="img">
          <div>
            <h4>${escapeHtml(p.nombre)}</h4>
            <div class="muted small">Edad: ${escapeHtml(p.edad)} • ${escapeHtml(p.sexo)} • DNI: ${escapeHtml(p.dni)}</div>
            <p><strong>Antecedentes:</strong> ${escapeHtml(p.antecedentes)}</p>
            <p><strong>Alergias:</strong> ${escapeHtml(p.alergias)}</p>
            <p><strong>Medicación:</strong> ${escapeHtml(p.meds)}</p>
            <p class="muted small">${escapeHtml(p.descripcion)}</p>
            <p class="muted small"><strong>Último diagnóstico:</strong> ${foundResult ? escapeHtml(foundResult.resultado) : '—'} ${foundResult ? ' • ' + escapeHtml(foundResult.tipoFibroma) + ' • ' + foundResult.confianza + '%' : ''}</p>
            <p class="muted small"><strong>Imagen vinculada:</strong> ${escapeHtml(imgName || '—')}</p>
          </div>
        `;
        list.appendChild(div);
      });
    }

    // enlazar export CSV
    const exportBtn = document.getElementById("exportCsvBtn");
    if(exportBtn) exportBtn.addEventListener("click", exportHistorialCSV);
  }

}); // DOMContentLoaded end

/* ---------- ADMIN helpers ---------- */
function adminEdit(idx){
  const arr = loadLS(LS_RESULTS);
  if(!arr[idx]) return alert("Registro no encontrado");
  const r = arr[idx];

  // Modal-like simple edit usando prompt - se puede reemplazar por modal si prefieres
  const nuevo = prompt("Editar diagnóstico:", r.resultado) || r.resultado;
  const nuevoTipo = prompt("Tipo fibrosis (Ninguno/Leve/Moderado/Grave):", r.tipoFibroma) || r.tipoFibroma;
  const nuevaConf = parseFloat(prompt("Confianza (>=91):", r.confianza) || r.confianza);

  r.resultado = nuevo;
  r.tipoFibroma = nuevoTipo;
  r.confianza = (nuevaConf >= 91 ? nuevaConf : r.confianza);

  // actualizar recomendación/tratamiento automáticamente a partir del tipo
  r.recommendation = getRecommendation(r.resultado, r.tipoFibroma);
  r.treatments = getTreatments(r.tipoFibroma);

  arr[idx] = r;
  saveLS(LS_RESULTS, arr);
  alert("Registro actualizado");
  location.reload();
}
function adminDelete(idx){
  if(!confirm("Eliminar registro?")) return;
  const arr = loadLS(LS_RESULTS); arr.splice(idx,1); saveLS(LS_RESULTS, arr);
  alert("Eliminado");
  location.reload();
}

/* ---------- Export CSV (Historial) ---------- */
function exportHistorialCSV(){
  const patients = loadLS(LS_HIST);
  const allResults = loadLS(LS_RESULTS);
  if(!patients.length){ alert("No hay pacientes para exportar."); return; }

  const header = ["Nombre","Edad","Sexo","DNI","Antecedentes","Alergias","Medicación","ÚltimoDiagnóstico","TipoFibroma","Confianza","Recomendación","Tratamiento","Imagen","FechaRegistro"];
  const rows = [header];

  patients.forEach(p => {
    const prs = allResults.filter(r => r.paciente && r.paciente.toLowerCase() === p.nombre.toLowerCase());
    let last = null;
    if(prs.length) last = prs.slice().sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt))[0];

    const treatments = last && last.treatments ? (Array.isArray(last.treatments) ? last.treatments.join(" | ") : String(last.treatments)) : "";
    const lastDiag = last ? last.resultado : "";
    const tipo = last ? last.tipoFibroma : "";
    const confianza = last ? last.confianza : "";
    const reco = last ? (last.recommendation || "") : "";
    const imageName = last ? (last.imageName || "") : "";
    const fecha = last ? (new Date(last.createdAt)).toLocaleString() : "";

    const row = [
      p.nombre,
      p.edad,
      p.sexo,
      p.dni,
      p.antecedentes,
      p.alergias,
      p.meds,
      lastDiag,
      tipo,
      confianza,
      reco,
      treatments,
      imageName,
      fecha
    ];
    rows.push(row);
  });

  const csvContent = rows.map(r => r.map(field => {
    if(field == null) return '""';
    const s = String(field).replaceAll('"', '""');
    return `"${s}"`;
  }).join(",")).join("\r\n");

  const today = dateYYYYMMDD();
  const filename = `Historial_Clinico_${today}.csv`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  if(navigator.msSaveBlob){ navigator.msSaveBlob(blob, filename); }
  else {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/* ---------- UTIL ---------- */
function openImage(dataUrl){
  // abre nueva ventana con la imagen (preview extendida)
  const w = window.open("");
  w.document.write(`<html><head><title>Preview</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;background:#111;"><img src="${dataUrl}" style="max-width:95vw;max-height:95vh;object-fit:contain;"></body></html>`);
  w.document.close();
}
function escapeHtml(s){ if(s==null) return ""; return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }

/* ---------- LOGOUT ---------- */
function logout(){
  // eliminar sólo la sesión activa para permitir cambio de perfil
  localStorage.removeItem(LS_USER);
  // redirigir al login
  window.location.href = "login.html";
}
