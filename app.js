// Importar funciones de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, onSnapshot, increment } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// Configuración de EcoCanje
const firebaseConfig = {
  apiKey: "AIzaSyAFS87aP6OrZ5uadNvINXya7txw_IirmK4",
  authDomain: "proyecto-ecocanje-2026.firebaseapp.com",
  projectId: "proyecto-ecocanje-2026",
  storageBucket: "proyecto-ecocanje-2026.firebasestorage.app",
  messagingSenderId: "56689629588",
  appId: "1:56689629588:web:5945de28fd27fdf8129781"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUserUid = null;
let html5QrCode = null;

// ==========================================
// GAMIFICACIÓN Y NIVELES
// ==========================================
const NIVELES = [
    { max: 49, nombre: "Semilla 🌱", recompensa: "Sigue reciclando para ganar premios" },
    { max: 149, nombre: "Brote 🌿", recompensa: "Cupón 5% Descuento en Cafetería UTL" },
    { max: 299, nombre: "Árbol 🌳", recompensa: "Termo Oficial EcoCanje" },
    { max: Infinity, nombre: "Guardián Eco 🌍", recompensa: "Pase Estacionamiento VIP / Playera" }
];

function actualizarUI_Gamificacion(puntos) {
    let nivelActual = NIVELES[0];
    let sigNivel = NIVELES[1];
    let limiteInferior = 0;

    for(let i=0; i<NIVELES.length; i++){
        if(puntos <= NIVELES[i].max){
            nivelActual = NIVELES[i];
            sigNivel = NIVELES[i+1] || NIVELES[i];
            limiteInferior = i === 0 ? 0 : NIVELES[i-1].max + 1;
            break;
        }
    }

    let puntosEnEsteNivel = puntos - limiteInferior;
    let puntosParaAvanzar = sigNivel.max - limiteInferior + 1;
    let porcentaje = (puntosEnEsteNivel / puntosParaAvanzar) * 100;
    if(porcentaje > 100) porcentaje = 100;

    document.getElementById('tvNivel').innerText = nivelActual.nombre;
    document.getElementById('progressBar').style.width = `${porcentaje}%`;
    document.getElementById('tvRecompensa').innerText = nivelActual.recompensa;
    
    if (nivelActual.nombre !== "Guardián Eco 🌍") {
        let faltantes = (sigNivel.max + 1) - puntos;
        document.getElementById('tvSiguienteNivel').innerText = `Faltan ${faltantes} pts para ser ${sigNivel.nombre.split(" ")[0]}`;
    } else {
        document.getElementById('tvSiguienteNivel').innerText = "¡Nivel Máximo Alcanzado!";
        document.getElementById('progressBar').style.width = `100%`;
    }
}

// ==========================================
// AUTENTICACIÓN
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserUid = user.uid;
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('dashboard-section').classList.add('active');
        escucharPuntos(user.uid);
    } else {
        currentUserUid = null;
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('auth-section').classList.add('active');
    }
});

// BOTÓN GOOGLE (Ventana Flotante Clásica)
document.getElementById('btnGoogle').addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        
        if (!userDoc.exists()) {
            await setDoc(doc(db, "usuarios", user.uid), { 
                nombre: user.displayName || "Eco-Usuario", 
                puntos: 0 
            });
        }
    } catch (error) {
        // Esto imprimirá el error técnico exacto en la pantalla
        Swal.fire('Error Técnico', error.message, 'error');
    }
});

// LOGIN NORMAL
document.getElementById('btnLogin').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const pass = document.getElementById('password').value.trim();
    if(!email || !pass) return Swal.fire('Oops...', 'Completa tus credenciales', 'warning');
    
    let usuarioFinal = email.includes('@') ? email : email + "@ecocanje.com";
    try { await signInWithEmailAndPassword(auth, usuarioFinal, pass); } 
    catch (error) { Swal.fire('Error', 'Usuario o contraseña incorrectos', 'error'); }
});

// REGISTRO
document.getElementById('btnRegister').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const pass = document.getElementById('password').value.trim();
    const nom = document.getElementById('nombre').value.trim();
    
    if(!email || !pass || !nom) return Swal.fire('Atención', 'Completa todos los campos', 'warning');
    let usuarioFinal = email.includes('@') ? email : email + "@ecocanje.com";
    
    try {
        const cred = await createUserWithEmailAndPassword(auth, usuarioFinal, pass);
        await setDoc(doc(db, "usuarios", cred.user.uid), { nombre: nom, puntos: 0 });
    } catch (error) { Swal.fire('Error', 'Error al registrar. Intenta otra contraseña.', 'error'); }
});

document.getElementById('btnLogout').addEventListener('click', () => signOut(auth));

document.getElementById('toggleAuth').addEventListener('click', () => {
    const isLogin = document.getElementById('btnLogin').style.display !== 'none';
    document.getElementById('registerFields').style.display = isLogin ? 'block' : 'none';
    document.getElementById('btnLogin').style.display = isLogin ? 'none' : 'block';
    document.getElementById('btnRegister').style.display = isLogin ? 'block' : 'none';
    document.getElementById('toggleAuth').innerHTML = isLogin ? '¿Ya tienes cuenta? <strong>Inicia sesión</strong>' : '¿No tienes cuenta? <strong>Regístrate</strong>';
});

// ==========================================
// DASHBOARD Y HISTORIAL
// ==========================================
function escucharPuntos(uid) {
    onSnapshot(doc(db, "usuarios", uid), (d) => {
        if(d.exists()){
            let pts = d.data().puntos || 0;
            document.getElementById('tvPuntos').innerText = pts;
            document.getElementById('saludoUsuario').innerText = d.data().nombre.split(" ")[0];
            actualizarUI_Gamificacion(pts);
        }
    });
}

document.getElementById('btnVerHistorial').addEventListener('click', () => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('history-section').classList.add('active');
    
    const lista = document.getElementById('lista-historial');
    lista.innerHTML = '<p style="text-align:center; color:var(--text-muted);">Cargando tu historial verde...</p>';
    
    onSnapshot(collection(db, `usuarios/${currentUserUid}/mi_historial`), (snapshot) => {
        lista.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            lista.innerHTML += `
                <div class="history-item">
                    <div>
                        <span style="font-size: 11px; color: var(--text-muted); display:block; margin-bottom: 4px;">${data.fecha}</span>
                        <strong style="color: white; font-size: 13px;">${data.idTransaccion}</strong>
                    </div>
                    <div class="history-pts">+${data.puntos}</div>
                </div>
            `;
        });
        if(lista.innerHTML === '') lista.innerHTML = '<p style="text-align:center; margin-top:20px; color:var(--text-muted);">Aún no tienes botellas recicladas.</p>';
    });
});

document.getElementById('btnVolverDashboard').addEventListener('click', () => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('dashboard-section').classList.add('active');
});

// ==========================================
// ESCÁNER (MODO DIOS)
// ==========================================
document.getElementById('btnAbrirScanner').addEventListener('click', () => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('scanner-section').classList.add('active');
    
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 15, qrbox: { width: 250, height: 250 } }, async (decodedText) => {
        html5QrCode.stop().then(() => procesarQR(decodedText));
    }).catch(err => Swal.fire('Cámara', 'Por favor otorga permisos de cámara en tu navegador.', 'error'));
});

document.getElementById('btnCerrarScanner').addEventListener('click', () => {
    if (html5QrCode) html5QrCode.stop();
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('dashboard-section').classList.add('active');
});

async function procesarQR(textoQR) {
    try {
        const fechaActual = new Date().toLocaleString();
        const idTransaccion = "QR_DEMO_" + Math.floor(Math.random() * 900000);

        await addDoc(collection(db, `usuarios/${currentUserUid}/mi_historial`), {
            idTransaccion: idTransaccion,
            fecha: fechaActual, 
            puntos: 10
        });
        
        await updateDoc(doc(db, "usuarios", currentUserUid), { puntos: increment(10) });

        Swal.fire({
            icon: 'success',
            title: '+10 Eco-Puntos',
            text: `¡QR aceptado con éxito!`,
            confirmButtonColor: '#00D26A'
        });
        
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('dashboard-section').classList.add('active');

    } catch (error) {
        Swal.fire('Error', 'Revisa tu conexión a internet.', 'error');
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('dashboard-section').classList.add('active');
    }
}