import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, onSnapshot, increment } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAFS87aP6OrZ5uadNvINXya7txw_IirmK4",
  authDomain: "proyecto-ecocanje-2026.firebaseapp.com",
  projectId: "proyecto-ecocanje-2026",
  storageBucket: "proyecto-ecocanje-2026.firebasestorage.app",
  messagingSenderId: "56689629588",
  appId: "1:56689629588:web:5945de28fd27fdf8129781",
  measurementId: "G-MNY4YM58TE"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUserUid = null;
let html5QrCode = null;
const CLAVE_MAESTRA = "SecretoUTL2026";
let isLoginMode = true;

const screens = document.querySelectorAll('.screen');
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const scannerSection = document.getElementById('scanner-section');
const historySection = document.getElementById('history-section');

function showScreen(screenElement) {
    screens.forEach(s => s.classList.remove('active'));
    screenElement.classList.add('active');
}

function formatearUsuario(inputUsuario) {
    let usuarioStr = inputUsuario.trim();
    if (!usuarioStr.includes('@')) {
        usuarioStr = usuarioStr + "@ecocanje.com";
    }
    return usuarioStr;
}

// Mostrar/Ocultar contraseñas
function toggleVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (input.type === "password") {
        input.type = "text";
        icon.classList.replace("fa-eye", "fa-eye-slash");
    } else {
        input.type = "password";
        icon.classList.replace("fa-eye-slash", "fa-eye");
    }
}
document.getElementById('togglePass').addEventListener('click', () => toggleVisibility('password', 'togglePass'));
document.getElementById('toggleConfirmPass').addEventListener('click', () => toggleVisibility('confirmPassword', 'toggleConfirmPass'));


onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserUid = user.uid;
        showScreen(dashboardSection);
        escucharPuntos();
    } else {
        currentUserUid = null;
        showScreen(authSection);
    }
});

// Cambiar entre Login y Registro
document.getElementById('toggleAuth').addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    document.getElementById('registerFields').style.display = isLoginMode ? 'none' : 'block';
    document.getElementById('groupConfirmPass').style.display = isLoginMode ? 'none' : 'flex';
    document.getElementById('btnLogin').style.display = isLoginMode ? 'flex' : 'none';
    document.getElementById('btnRegister').style.display = isLoginMode ? 'flex' : 'none';
    document.getElementById('toggleAuth').innerHTML = isLoginMode ? '¿No tienes cuenta? <strong>Regístrate aquí</strong>' : '¿Ya tienes cuenta? <strong>Inicia sesión</strong>';
});

// Iniciar Sesión
document.getElementById('btnLogin').addEventListener('click', async () => {
    const userInput = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    if(!userInput || !password) return alert("Completa tus datos.");
    
    const emailFinal = formatearUsuario(userInput);
    try {
        await signInWithEmailAndPassword(auth, emailFinal, password);
    } catch (error) {
        alert("Usuario o contraseña incorrectos.");
    }
});

// Registro con Validación
document.getElementById('btnRegister').addEventListener('click', async () => {
    const userInput = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const confirmPassword = document.getElementById('confirmPassword').value.trim();
    const nombre = document.getElementById('nombre').value.trim();
    const apellido = document.getElementById('apellido').value.trim();
    
    if (!userInput || !password || !confirmPassword || !nombre || !apellido) {
        return alert("Completa todos los campos para registrarte.");
    }

    if (password !== confirmPassword) {
        return alert("Las contraseñas no coinciden. Verifícalas.");
    }
    
    const emailFinal = formatearUsuario(userInput);
    try {
        const userCred = await createUserWithEmailAndPassword(auth, emailFinal, password);
        // Guarda el nombre completo uniendo Nombre y Apellido
        await setDoc(doc(db, "usuarios", userCred.user.uid), {
            nombre: `${nombre} ${apellido}`,
            puntos: 0
        });
    } catch (error) {
        alert("Error: Asegúrate de que la contraseña tenga mínimo 6 caracteres y que el usuario no exista.");
    }
});

// Google Login
document.getElementById('btnGoogle').addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        
        if (!userDoc.exists()) {
            await setDoc(doc(db, "usuarios", user.uid), {
                nombre: user.displayName || "Eco-Reciclador",
                puntos: 0
            });
        }
    } catch (error) {
        console.error("Error Google Auth", error);
    }
});

document.getElementById('btnLogout').addEventListener('click', () => signOut(auth));

function escucharPuntos() {
    onSnapshot(doc(db, "usuarios", currentUserUid), (docSnap) => {
        if (docSnap.exists()) {
            document.getElementById('tvPuntos').innerText = docSnap.data().puntos || 0;
            let nombreCompleto = docSnap.data().nombre;
            document.getElementById('saludoUsuario').innerText = nombreCompleto.split(" ")[0]; 
        }
    });
}

document.getElementById('btnVerHistorial').addEventListener('click', () => {
    showScreen(historySection);
    const lista = document.getElementById('lista-historial');
    lista.innerHTML = '<p style="text-align:center; color:var(--text-muted);">Sincronizando...</p>';
    
    onSnapshot(collection(db, `usuarios/${currentUserUid}/mi_historial`), (snapshot) => {
        lista.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            lista.innerHTML += `
                <div class="history-item">
                    <div class="history-info">
                        <span><i class="fa-regular fa-calendar"></i> ${data.fecha}</span>
                        <strong>${data.idTransaccion}</strong>
                    </div>
                    <div class="history-pts">+${data.puntos}</div>
                </div>
            `;
        });
        if(lista.innerHTML === '') lista.innerHTML = '<p style="text-align:center; margin-top:30px; color:var(--text-muted);">Aún no tienes botellas recicladas.</p>';
    });
});

document.getElementById('btnVolverDashboard').addEventListener('click', () => showScreen(dashboardSection));

document.getElementById('btnAbrirScanner').addEventListener('click', () => {
    showScreen(scannerSection);
    html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 15, qrbox: { width: 250, height: 250 } };

    html5QrCode.start({ facingMode: "environment" }, config, async (decodedText) => {
        html5QrCode.stop().then(() => procesarQR(decodedText));
    }).catch(err => {
        alert("Otorga permisos de cámara en tu navegador.");
        showScreen(dashboardSection);
    });
});

document.getElementById('btnCerrarScanner').addEventListener('click', () => {
    if (html5QrCode) html5QrCode.stop();
    showScreen(dashboardSection);
});

async function procesarQR(textoQR) {
    if (validarFirmaCriptografica(textoQR)) {
        const identificador = textoQR.split("-")[0];

        try {
            const qrRef = doc(db, "transacciones_globales", identificador);
            const qrDoc = await getDoc(qrRef);

            if (qrDoc.exists()) {
                alert("🔒 Este código ya fue canjeado por alguien más.");
                showScreen(dashboardSection);
            } else {
                const fechaActual = new Date().toLocaleString();
                await setDoc(qrRef, { usadoPor: currentUserUid, fecha: fechaActual });
                await addDoc(collection(db, `usuarios/${currentUserUid}/mi_historial`), {
                    idTransaccion: identificador,
                    fecha: fechaActual,
                    puntos: 10
                });
                await updateDoc(doc(db, "usuarios", currentUserUid), { puntos: increment(10) });

                showScreen(dashboardSection);
            }
        } catch (error) {
            alert("Error de conexión al servidor.");
            showScreen(dashboardSection);
        }
    } else {
        alert("⚠️ Código QR inválido o alterado.");
        showScreen(dashboardSection);
    }
}

function validarFirmaCriptografica(qrEscaneado) {
    try {
        const partes = qrEscaneado.split("-");
        if (partes.length !== 2) return false;
        
        const identificador = partes[0];
        const firmaRecibida = partes[1];
        
        const textoAHashear = identificador + CLAVE_MAESTRA;
        const hashHex = CryptoJS.SHA256(textoAHashear).toString(CryptoJS.enc.Hex);
        const firmaCalculada = hashHex.substring(0, 8);
        
        return firmaCalculada === firmaRecibida;
    } catch (e) {
        return false;
    }
}