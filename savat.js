// === KONFIGURATSIYA ===
// DIQQAT: Telegram bot tokenini frontendda saqlash xavfsiz emas.
// Keyingi bosqichda tokenni server/Cloud Function orqali yuborishga o'tkazish kerak.
const BOT_TOKEN = "8399989077:AAGjnF1-MYvE06jQ9Bu6WOr9cMoDNzH21Dc";
const CHAT_ID = "6481290484";

// === O'ZGARUVCHILAR ===
let cart = JSON.parse(localStorage.getItem('cart_v1')) || [];
let coupon = null;
let userLocation = null;
let locationWatchId = null;
let locationSamples = [];

const LOCATION_TIMEOUT = 30000;
const MAX_ACCEPTED_ACCURACY = 100;
const MIN_SAMPLES = 3;

const money = v => new Intl.NumberFormat('ru-RU').format(v) + " so'm";

// === 1. SAVATNI CHIZISH ===
function renderCart() {
    const container = document.getElementById('cart-content');
    const empty = document.getElementById('empty-state');
    container.innerHTML = '';

    if (!cart || cart.length === 0) {
        empty.classList.remove('hidden');
        document.getElementById('items-count').innerText = 0;
        document.getElementById('subtotal').innerText = "0 so'm";
        document.getElementById('shipping-text').innerText = "0 so'm";
        return;
    }

    empty.classList.add('hidden');

    cart.forEach(item => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-4 py-4 border-b';
        row.innerHTML = `
            <img src="${item.img}" alt="${item.title}" class="w-16 h-16 object-cover rounded">
            <div class="flex-1">
                <h4 class="font-medium">${item.title}</h4>
                <p class="text-sm text-gray-500">${money(item.price)}</p>
                <div class="flex items-center mt-2 gap-3">
                    <button onclick="changeQty('${item.id}', -1)" class="px-2 border rounded">-</button>
                    <span>${item.qty}</span>
                    <button onclick="changeQty('${item.id}', 1)" class="px-2 border rounded">+</button>
                    <button onclick="removeItem('${item.id}')" class="ml-auto text-red-500 text-sm">O'chirish</button>
                </div>
            </div>
        `;
        container.appendChild(row);
    });

    updateTotals();
}

function changeQty(id, delta) {
    cart = cart.map(it => {
        if (it.id == id) it.qty = Math.max(1, it.qty + delta);
        return it;
    });
    saveCart();
    renderCart();
}

function removeItem(id) {
    cart = cart.filter(it => it.id != id);
    saveCart();
    renderCart();
}

function updateTotals() {
    const subtotalVal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const shipping = subtotalVal > 100000 ? 0 : 12000;
    const discount = coupon ? Math.round(subtotalVal * coupon.discount) : 0;
    const total = subtotalVal - discount + shipping;

    document.getElementById('items-count').innerText = cart.reduce((s, i) => s + i.qty, 0);
    document.getElementById('subtotal').innerText = money(total);
    document.getElementById('shipping-text').innerText = shipping === 0 ? "Bepul" : money(shipping);
}

function saveCart() {
    localStorage.setItem('cart_v1', JSON.stringify(cart));
}

// === 2. MODAL ===
const modal = document.getElementById('order-modal');
const checkoutBtn = document.getElementById('checkout-btn');
const closeBtn = document.querySelector('.close-modal');
const locationBtn = document.getElementById('get-location');
const locationStatus = document.getElementById('location-status');

checkoutBtn.addEventListener('click', () => {
    if (cart.length === 0) return alert("Savat bo'sh!");
    modal.classList.remove('hidden');
    modal.classList.add('flex');
});

closeBtn.addEventListener('click', () => {
    stopLocationWatch();
    modal.classList.add('hidden');
    modal.classList.remove('flex');
});

// === 3. ANIQLIGI YUQORI LOKATSIYA ===
function stopLocationWatch() {
    if (locationWatchId !== null) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
    }
}

function setBestLocation(position) {
    const { latitude, longitude, accuracy } = position.coords;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy)) return;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;

    locationSamples.push({ lat: latitude, lon: longitude, accuracy });
    locationSamples.sort((a, b) => a.accuracy - b.accuracy);
    locationSamples = locationSamples.slice(0, 5);

    const best = locationSamples[0];
    userLocation = { lat: best.lat, lon: best.lon, accuracy: best.accuracy };

    locationStatus.innerHTML = `⏳ Aniqlik tekshirilmoqda...<br>
        <span class="text-xs text-blue-600">Aniqlik: ±${Math.round(best.accuracy)} m</span>`;

    // Kamida 3 ta o'lchov va 100 metrdan yaxshi aniqlik bo'lgandagina qabul qilamiz.
    if (locationSamples.length >= MIN_SAMPLES && best.accuracy <= MAX_ACCEPTED_ACCURACY) {
        stopLocationWatch();
        locationStatus.innerHTML = `✅ Aniq lokatsiya belgilandi!<br>
            <span class="text-xs text-green-600">Aniqlik: ±${Math.round(best.accuracy)} m</span>`;
        locationBtn.classList.remove('bg-blue-500');
        locationBtn.classList.add('bg-green-500');
        locationBtn.innerText = "✅ Manzil belgilandi";
    }
}

function handleLocationError(err) {
    stopLocationWatch();
    userLocation = null;

    const messages = {
        1: "Lokatsiyaga ruxsat berilmadi. Brauzer sozlamalaridan Location'ni yoqing.",
        2: "Lokatsiyani aniqlab bo'lmadi. GPS/Wi-Fi yoqilganini tekshiring.",
        3: "Lokatsiyani aniqlash vaqti tugadi. Qayta urinib ko'ring."
    };

    locationStatus.innerText = `❌ ${messages[err.code] || "Lokatsiya xatosi."}`;
    locationBtn.classList.remove('bg-green-500');
    locationBtn.classList.add('bg-blue-500');
    locationBtn.innerText = "📍 Qayta lokatsiya olish";
    console.error('Geolocation error:', err);
}

locationBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
        locationStatus.innerText = "❌ Bu qurilmada geolokatsiya qo'llab-quvvatlanmaydi.";
        return;
    }

    stopLocationWatch();
    locationSamples = [];
    userLocation = null;

    locationStatus.innerText = "⏳ GPS lokatsiya olinmoqda... Telefonni bir necha soniya qimirlatmang.";
    locationBtn.disabled = true;
    locationBtn.innerText = "⏳ Aniqlanmoqda...";

    const startedAt = Date.now();

    const success = position => {
        setBestLocation(position);
        if (userLocation && locationSamples.length >= MIN_SAMPLES && userLocation.accuracy <= MAX_ACCEPTED_ACCURACY) {
            locationBtn.disabled = false;
        } else if (Date.now() - startedAt > LOCATION_TIMEOUT) {
            stopLocationWatch();
            locationBtn.disabled = false;
            if (userLocation) {
                locationStatus.innerHTML = `⚠️ GPS aniqligi yetarli emas: ±${Math.round(userLocation.accuracy)} m.<br><span class="text-xs">Ochiq joyga chiqing va qayta urinib ko'ring.</span>`;
            } else {
                locationStatus.innerText = "❌ Lokatsiya olinmadi. Qayta urinib ko'ring.";
            }
        }
    };

    const error = err => {
        locationBtn.disabled = false;
        handleLocationError(err);
    };

    locationWatchId = navigator.geolocation.watchPosition(success, error, {
        enableHighAccuracy: true,
        timeout: LOCATION_TIMEOUT,
        maximumAge: 0
    });
});

// === 4. TELEGRAMGA YUBORISH ===
async function sendTelegram() {
    const name = document.getElementById('client-name').value.trim();
    const phone = document.getElementById('client-phone').value;

    const cleanedPhone = phone.replace(/\s/g, "");
    if (!/^\+998\d{9}$/.test(cleanedPhone)) {
        alert("Telefon noto'g'ri: +998901234567");
        return;
    }

    if (!userLocation || userLocation.accuracy > MAX_ACCEPTED_ACCURACY) {
        alert("❌ Aniq lokatsiya olinmadi. 'Lokatsiyani belgilash' tugmasini bosib, GPS aniqligini kuting.");
        return;
    }

    let message = `<b>📦 YANGI BUYURTMA!</b>\n\n`;
    message += `👤 <b>Mijoz:</b> ${name}\n`;
    message += `📞 <b>Telefon:</b> ${cleanedPhone}\n`;
    message += `📍 <b>GPS aniqligi:</b> ±${Math.round(userLocation.accuracy)} m\n\n`;
    message += `🛒 <b>Mahsulotlar:</b>\n`;

    cart.forEach((item, index) => {
        message += `${index + 1}. ${item.title} (x${item.qty}) - ${money(item.price * item.qty)}\n`;
    });

    message += `\n💰 <b>JAMI: ${document.getElementById('subtotal').innerText}</b>`;

    try {
        const messageResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: "HTML" })
        });

        if (!messageResponse.ok) throw new Error('Telegram message yuborilmadi');

        const locationResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendLocation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                latitude: userLocation.lat,
                longitude: userLocation.lon
            })
        });

        if (!locationResponse.ok) throw new Error('Telegram location yuborilmadi');

        alert("✅ Buyurtma qabul qilindi! Aniq GPS lokatsiya ham yuborildi.");
        clearAll();

    } catch (err) {
        alert("❌ Buyurtma yuborishda xatolik. Internetni tekshiring va qayta urinib ko'ring.");
        console.error(err);
    }
}

// === 5. SAVATNI TOZALASH ===
function clearAll() {
    stopLocationWatch();
    localStorage.removeItem('cart_v1');
    cart = [];
    renderCart();

    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.getElementById('telegram-form').reset();

    locationBtn.classList.remove('bg-green-500');
    locationBtn.classList.add('bg-blue-500');
    locationBtn.disabled = false;
    locationBtn.innerText = "📍 Joylashuvni belgilash";
    locationStatus.innerText = "Manzil belgilanmadi";
    userLocation = null;
    locationSamples = [];
}

document.getElementById('clear-cart').addEventListener('click', clearAll);
renderCart();

// === TELEFON MASKASI ===
const phoneInput = document.getElementById("client-phone");

phoneInput.addEventListener("focus", () => {
    if (phoneInput.value === "") phoneInput.value = "+998 ";
});

phoneInput.addEventListener("input", () => {
    let v = phoneInput.value.replace(/\D/g, "");
    if (!v.startsWith("998")) v = "998" + v;

    let f = "+998 ";
    if (v.length > 3) f += v.slice(3, 5);
    if (v.length > 5) f += " " + v.slice(5, 8);
    if (v.length > 8) f += " " + v.slice(8, 10);
    if (v.length > 10) f += " " + v.slice(10, 12);

    phoneInput.value = f.trim();
});
