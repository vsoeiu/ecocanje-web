import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithRedirect, getRedirectResult } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, onSnapshot, increment } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAFS87aP6OrZ5uadNvINXya7txw_IirmK4",
  authDomain: "proyecto-ecocanje-2026.firebaseapp.com",
  projectId: "proyecto-ecocanje-2026",
  storageBucket: "proyecto-ecocanje-2026.firebasestorage.app",
  messagingSenderId: "56689629588",
  appId: "1:56689629588:web:5945de28fd27fdf8129781"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUserUid = null;
let html5QrCode = null;
const CLAVE_MAESTRA = "SecretoUTL2026";

// ==========================================
// MOTOR DE GAMIFICACIÓN (Niveles y Recompensas)
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

    // Calcular en qué nivel está
    for(let i=0; i<NIVELES.length; i++){
        if(puntos <= NIVELES[i].max){
            nivelActual = NIVELES[i];
            sigNivel = NIVELES[i+1] || NIVELES[i];
            limiteInferior = i === 0 ? 0 : NIVELES[i-1].max + 1;
            break;
        }
    }

    // Calcular porcentaje de la barra de progreso
    let puntosEnEsteNivel = puntos - limiteInferior;
    let puntosParaAvanzar = sigNivel.max - limiteInferior + 1;
    let porcentaje = (puntosEnEsteNivel / puntosParaAvanzar) * 100;
    if(porcentaje > 100) porcentaje = 100;

    // Inyectar en el HTML
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
getRedirectResult(auth).then(async (result) => {
    if (result) {
        const user = result.user;
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (!userDoc.exists()) {
            await setDoc(doc(db, "usuarios", user.uid), { nombre: user.displayName, puntos: 0 });
        }
    }
});

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

document.getElementById('btnGoogle').addEventListener('click', () => signInWithRedirect(auth, provider));

// Login Email Tradicional
document.getElementById('btnLogin').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const pass = document.getElementById('password').value.trim();
    if(!email || !pass) return Swal.fire('Error', 'Completa tus datos', 'warning');
    
    let usuarioFinal = email.includes('@') ? email : email + "@ecocanje.com";
    try { await signInWithEmailAndPassword(auth, usuarioFinal, pass); } 
    catch (error) { Swal.fire('Error', 'Usuario o contraseña incorrectos', 'error'); }
});

// Registro
document.getElementById('btnRegister').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const pass = document.getElementById('password').value.trim();
    const nom = document.getElementById('nombre').value.trim();
    
    if(!email || !pass || !nom) return Swal.fire('Error', 'Completa los campos', 'warning');
    let usuarioFinal = email.includes('@') ? email : email + "@ecocanje.com";
    
    try {
        const cred = await createUserWithEmailAndPassword(auth, usuarioFinal, pass);
        await setDoc(doc(db, "usuarios", cred.user.uid), { nombre: nom, puntos: 0 });
    } catch (error) { Swal.fire('Error', 'Error al registrar', 'error'); }
});

document.getElementById('btnLogout').addEventListener('click', () => signOut(auth));

document.getElementById('toggleAuth').addEventListener('click', () => {
    const isLogin = document.getElementById('btnLogin').style.display !== 'none';
    document.getElementById('registerFields').style.display = isLogin ? 'block' : 'none';
    document.getElementById('btnLogin').style.display = isLogin ? 'none' : 'block';
    document.getElementById('btnRegister').style.display = isLogin ? 'block' : 'none';
});

// ==========================================
// DATOS EN TIEMPO REAL
// ==========================================
function escucharPuntos(uid) {
    onSnapshot(doc(db, "usuarios", uid), (d) => {
        if(d.exists()){
            let pts = d.data().puntos || 0;
            document.getElementById('tvPuntos').innerText = pts;
            document.getElementById('saludoUsuario').innerText = d.data().nombre.split(" ")[0];
            actualizarUI_Gamificacion(pts); // Llama al motor de niveles
        }
    });
}

// ==========================================
// ESCÁNER Y QR DEL ESP32
// ==========================================
document.getElementById('btnAbrirScanner').addEventListener('click', () => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('scanner-section').classList.add('active');
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 15, qrbox: { width: 250, height: 250 } }, async (decodedText) => {
        html5QrCode.stop().then(() => procesarQR(decodedText));
    }).catch(err => Swal.fire('Error', 'Da permisos de cámara', 'error'));
});

document.getElementById('btnCerrarScanner').addEventListener('click', () => {
    if (html5QrCode) html5QrCode.stop();
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('dashboard-section').classList.add('active');
});

async function procesarQR(textoQR) {
    let token = textoQR;
    if (textoQR.includes("token=")) token = textoQR.split("token=")[1];

    if (validarFirmaCriptografica(token)) {
        const identificador = token.split("-")[0];

        try {
            const qrRef = doc(db, "transacciones_globales", identificador);
            const qrDoc = await getDoc(qrRef);

            if (qrDoc.exists()) {
                Swal.fire({ icon: 'warning', title: 'Código Usado', text: 'Esta botella ya fue canjeada por alguien más.' });
                document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
                document.getElementById('dashboard-section').classList.add('active');
            } else {
                const fechaActual = new Date().toLocaleString();
                await setDoc(qrRef, { usadoPor: currentUserUid, fecha: fechaActual });
                await addDoc(collection(db, `usuarios/${currentUserUid}/mi_historial`), {
                    idTransaccion: identificador, fecha: fechaActual, puntos: 10
                });
                await updateDoc(doc(db, "usuarios", currentUserUid), { puntos: increment(10) });

                // Alerta Bonita Animada
                Swal.fire({
                    icon: 'success',
                    title: '+10 Eco-Puntos',
                    text: `Botella ${identificador} reciclada con éxito.`,
                    confirmButtonColor: '#00D26A'
                });
                
                document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
                document.getElementById('dashboard-section').classList.add('active');
            }
        } catch (error) {
            Swal.fire('Error', 'Revisa tu conexión a internet.', 'error');
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            document.getElementById('dashboard-section').classList.add('active');
        }
    } else {
        Swal.fire({ icon: 'error', title: 'QR Inválido', text: 'Este código no pertenece a EcoCanje UTL o fue alterado.' });
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('dashboard-section').classList.add('active');
    }
}

function validarFirmaCriptografica(tokenEscaneado) {
    try {
        const partes = tokenEscaneado.split("-");
        if (partes.length !== 2) return false;
        
        const identificador = partes[0];
        const firmaRecibida = partes[1];
        const textoAHashear = identificador + "-" + CLAVE_MAESTRA;
        
        const hashHex = CryptoJS.SHA256(textoAHashear).toString(CryptoJS.enc.Hex);
        return hashHex.substring(0, 8) === firmaRecibida;
    } catch (e) { return false; }
}