// --- CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = 'https://bgkxxsfnzlasnuouehtd.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'sb_publishable_vtto48XjBXskkot7xEzq_A_al5iIM9G';

// Inicializar cliente de Supabase
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let generoActual = 'Masculino';
let edadActual = 'Niño';
let productoIdActual = 1; // 1 = Frambuesa, 2 = Limón

// Esperar a que el HTML cargue por completo antes de asignar los eventos
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Eventos para Selección de Sabor
    document.querySelectorAll('#sabor-group .dota-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#sabor-group .dota-tab').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            productoIdActual = parseInt(e.currentTarget.getAttribute('data-id'));
        });
    });

    // 2. Eventos para Género
    document.querySelectorAll('#genero-group .dota-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#genero-group .dota-tab').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            generoActual = e.currentTarget.getAttribute('data-value');
        });
    });

    // 3. Eventos para Rango de Edad
    document.querySelectorAll('#edad-group .dota-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#edad-group .dota-tab').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            edadActual = e.currentTarget.getAttribute('data-value');
        });
    });

    // Inicializar estado de red y contadores
    actualizarEstadoRed();
    calcularTotal();
});

// Control de Cantidades y Cálculo del Total (multiplica por 2 Bs.)
function cambiarCantidad(delta) {
    let input = document.getElementById('cantidadInput');
    let val = parseInt(input.value) || 1;
    val += delta;
    if (val < 1) val = 1;
    input.value = val;
    calcularTotal();
}

function calcularTotal() {
    let input = document.getElementById('cantidadInput');
    let cant = parseInt(input.value) || 1;
    if (cant < 1) {
        cant = 1;
        input.value = 1;
    }
    // MULTIPLICA LA CANTIDAD POR 2.00 Bs.
    let total = cant * 2.00;
    document.getElementById('totalBsDisplay').innerText = total.toFixed(2) + " Bs.";
}

// Control de Red Online / Offline
window.addEventListener('online', actualizarEstadoRed);
window.addEventListener('offline', actualizarEstadoRed);

function actualizarEstadoRed() {
    const badge = document.getElementById('connection-status');
    if (badge) {
        if (navigator.onLine) {
            badge.className = "status-badge online";
            badge.innerText = "Conectado a la Red";
            sincronizarDatos();
        } else {
            badge.className = "status-badge offline";
            badge.innerText = "Modo Offline (Local)";
        }
    }
    actualizarContadorOffline();
}

function actualizarContadorOffline() {
    let pendientes = JSON.parse(localStorage.getItem('ventas_offline')) || [];
    const el = document.getElementById('offline-count');
    if (el) el.innerText = pendientes.length;
}

// Función Principal de Registro
async function registrarVenta() {
    let cantidad = parseInt(document.getElementById('cantidadInput').value) || 1;
    let uuidTransaccion = "TRX-" + (crypto.randomUUID ? crypto.randomUUID().substring(0, 8) : Math.random().toString(36).substring(2, 10)).toUpperCase();
    
    let datosVenta = {
        p_uuid_transaccion: uuidTransaccion,
        p_timestamp_local: new Date().toISOString(),
        p_genero: generoActual,
        p_rango_edad: edadActual,
        p_producto_id: productoIdActual,
        p_cantidad: cantidad,
        p_modo_sync: navigator.onLine ? 'REALTIME' : 'OFFLINE_SYNC'
    };

    if (navigator.onLine && supabase) {
        try {
            const { data, error } = await supabase.rpc('registrar_venta_transaccional', datosVenta);

            if (error) throw error;

            if (data && data.status === 'success') {
                mostrarToast("¡Compra registrada con éxito! 🪙");
                resetearFormulario();
            } else {
                mostrarToast((data ? data.message : null) || "⚠️ Stock insuficiente.");
            }
        } catch (err) {
            console.error("Error en conexión:", err);
            guardarLocal(datosVenta);
        }
    } else {
        guardarLocal(datosVenta);
    }
}

function guardarLocal(venta) {
    let pendientes = JSON.parse(localStorage.getItem('ventas_offline')) || [];
    pendientes.push(venta);
    localStorage.setItem('ventas_offline', JSON.stringify(pendientes));
    actualizarContadorOffline();
    mostrarToast("⚠️ Sin red. Venta guardada localmente en la mochila.");
    resetearFormulario();
}

async function sincronizarDatos() {
    let pendientes = JSON.parse(localStorage.getItem('ventas_offline')) || [];
    if (pendientes.length === 0 || !navigator.onLine || !supabase) return;

    let enviadasConExito = 0;
    let nuevasPendientes = [];

    for (let venta of pendientes) {
        try {
            venta.p_modo_sync = 'OFFLINE_SYNC';
            const { data, error } = await supabase.rpc('registrar_venta_transaccional', venta);

            if (!error && data && data.status === 'success') {
                enviadasConExito++;
            } else {
                nuevasPendientes.push(venta);
            }
        } catch (e) {
            nuevasPendientes.push(venta);
        }
    }

    localStorage.setItem('ventas_offline', JSON.stringify(nuevasPendientes));
    actualizarContadorOffline();

    if (enviadasConExito > 0) {
        mostrarToast(`¡Se sincronizaron ${enviadasConExito} ventas pendientes!`);
    }
}

function resetearFormulario() {
    document.getElementById('cantidadInput').value = 1;
    calcularTotal();
}

function mostrarToast(mensaje) {
    let toast = document.getElementById('dota-toast');
    if (toast) {
        toast.innerText = mensaje;
        toast.classList.remove('hidden');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }
}