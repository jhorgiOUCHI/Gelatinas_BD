// --- CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = 'https://bgkxxsfnzlasnuouehtd.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'sb_publishable_vtto48XjBXskkot7xEzq_A_al5iIM9G';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let generoActual = 'Masculino';
let edadActual = 'Niño';
let productoIdActual = 1; // 1 = Frambuesa, 2 = Limón

// Selección de sabor
document.querySelectorAll('#sabor-group button').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('#sabor-group button').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        productoIdActual = parseInt(e.target.getAttribute('data-id'));
    });
});

// Selección de género
document.querySelectorAll('#genero-group button').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('#genero-group button').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        generoActual = e.target.getAttribute('data-value');
    });
});

// Selección de rango de edad
document.querySelectorAll('#edad-group button').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('#edad-group button').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        edadActual = e.target.getAttribute('data-value');
    });
});

function cambiarCantidad(delta) {
    let input = document.getElementById('cantidadInput');
    let val = parseInt(input.value) || 1;
    val += delta;
    if (val < 1) val = 1;
    input.value = val;
    calcularTotal();
}

function calcularTotal() {
    let cant = parseInt(document.getElementById('cantidadInput').value) || 1;
    document.getElementById('totalBsDisplay').innerText = (cant * 2.00).toFixed(2) + " Bs.";
}

// Control de red Online / Offline
window.addEventListener('online', actualizarEstadoRed);
window.addEventListener('offline', actualizarEstadoRed);

function actualizarEstadoRed() {
    const badge = document.getElementById('connection-status');
    if (navigator.onLine) {
        badge.className = "status-badge online";
        badge.innerText = "Conectado a la Red";
        sincronizarDatos(); // Sincroniza automáticamente al recuperar red
    } else {
        badge.className = "status-badge offline";
        badge.innerText = "Modo Offline (Local)";
    }
    actualizarContadorOffline();
}

function actualizarContadorOffline() {
    let pendientes = JSON.parse(localStorage.getItem('ventas_offline')) || [];
    document.getElementById('offline-count').innerText = pendientes.length;
}

// Función principal de registro conectada a Supabase (RPC)
async function registrarVenta() {
    let cantidad = parseInt(document.getElementById('cantidadInput').value) || 1;
    let uuidTransaccion = "TRX-" + crypto.randomUUID().substring(0, 8).toUpperCase();
    
    let datosVenta = {
        p_uuid_transaccion: uuidTransaccion,
        p_timestamp_local: new Date().toISOString(),
        p_genero: generoActual,
        p_rango_edad: edadActual,
        p_producto_id: productoIdActual,
        p_cantidad: cantidad,
        p_modo_sync: navigator.onLine ? 'REALTIME' : 'OFFLINE_SYNC'
    };

    if (navigator.onLine) {
        try {
            // Llama a la función almacenada en PostgreSQL (Supabase)
            const { data, error } = await supabase.rpc('registrar_venta_transaccional', datosVenta);

            if (error) throw error;

            if (data.status === 'success') {
                mostrarToast("¡Compra registrada con éxito! +Gold 🪙");
                resetearFormulario();
            } else {
                mostrarToast(data.message || "⚠️ Stock insuficiente.");
            }
        } catch (err) {
            console.error("Error al conectar con Supabase:", err);
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

// Sincronización batch con Supabase cuando regresa el internet
async function sincronizarDatos() {
    let pendientes = JSON.parse(localStorage.getItem('ventas_offline')) || [];
    if (pendientes.length === 0) return;
    if (!navigator.onLine) return;

    let enviadasConExito = 0;
    let nuevasPendientes = [];

    for (let venta of pendientes) {
        try {
            venta.p_modo_sync = 'OFFLINE_SYNC';
            const { data, error } = await supabase.rpc('registrar_venta_transaccional', venta);

            if (!error && data.status === 'success') {
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
        mostrarToast(`¡Se sincronizaron ${enviadasConExito} ventas pendientes a Supabase!`);
    }
}

function resetearFormulario() {
    document.getElementById('cantidadInput').value = 1;
    calcularTotal();
}

function mostrarToast(mensaje) {
    let toast = document.getElementById('dota-toast');
    toast.innerText = mensaje;
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Inicialización al cargar la página
actualizarEstadoRed();