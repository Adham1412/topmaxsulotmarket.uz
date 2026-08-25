// === KONFIGURATSIYA ===
// Eslatma: Telegram BOT_TOKEN frontendda ochiq turibdi. Xavfsizlik uchun keyinchalik backendga ko'chirish kerak.
const BOT_TOKEN = "8399989077:AAGjnF1-MYvE06jQ9Bu6WOr9cMoDNzH21Dc";
const CHAT_ID = "6481290484";

// === O'ZGARUVCHILAR ===
let cart = JSON.parse(localStorage.getItem('cart_v1')) || [];
let coupon = null;
let userLocation = null;
let locationWatchId = null;
let locationTimer = null;

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
            </div>`;
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
    stopLocation();
    modal.classList.add('hidden');
    modal.classList.remove('flex');
});

// === 3. ISHONCHLI LOKATSIYA ===
function stopLocation() {
    if (locationWatchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
    }
    if (locationTimer) {
        clearTimeout(locationTimer);
        locationTimer = null;
    }
}

function saveLocation(position) {
    const c = position.coords;
    if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return false;

    userLocation = {
        lat: c.latitude,
        lon: c.longitude,
        accuracy: Number.isFinite(c.accuracy) ? c.accuracy : null
    };

    const accuracyText = userLocation.accuracy
        ? `Aniqlik: ±${Math.round(userLocation.accuracy)} m`
        : 'GPS koordinata olindi';

    locationStatus.innerHTML = `✅ Lokatsiya olindi!<br><span class="text-xs text-green-600">${accuracyText}</span>`;
    locationBtn.disabled = false;
    locationBtn.classList.remove('bg-blue-500');
    locationBtn.classList.add('bg-green-500');
    locationBtn.innerText = "✅ Lokatsiya belgilandi";
    stopLocation();
    return true;
}

function locationError(err) {
    stopLocation();
    userLocation = null;
    locationBtn.disabled = false;
    locationBtn.classList.remove('bg-green-500');
    locationBtn.classList.add('bg-blue-500');
    locationBtn.innerText = "📍 Qayta lokatsiya olish";

    if (err && err.code === 1) {
        locationStatus.innerText = "❌ Lokatsiyaga ruxsat berilmadi. Brauzerda Location ruxsatini yoqing.";
    } else if (err && err.code === 2) {
        locationStatus.innerText = "❌ Lokatsiya topilmadi. GPS/Wi-Fi yoqilganini tekshiring.";
    } else if (err && err.code === 3) {
        locationStatus.innerText = "❌ Lokatsiya olish vaqti tugadi. Ochiq joyda qayta urinib ko'ring.";
    } else {
        locationStatus.innerText = "❌ Lokatsiya olinmadi. Qayta urinib ko'ring.";
    }
    console.error('Geolocation error:', err);
}

locationBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
        locationStatus.innerText = "❌ Brauzeringiz geolokatsiyani qo'llab-quvvatlamaydi.";
        return;
    }

    stopLocation();
    userLocation = null;
    locationBtn.disabled = true;
    locationBtn.innerText = "⏳ Lokatsiya aniqlanmoqda...";
    locationStatus.innerText = "⏳ Lokatsiya olinmoqda... Bir necha soniya kuting.";

    // Avval oddiy getCurrentPosition: bu barcha zamonaviy telefon/brauzerlarda eng barqaror usul.
    navigator.geolocation.getCurrentPosition(
        position => saveLocation(position),
        error => {
            // Agar birinchi urinish ishlamasa, GPS/Wi-Fi'dan yangi koordinata kutamiz.
            locationStatus.innerText = "⏳ GPS signal qidirilmoqda...";
            locationWatchId = navigator.geolocation.watchPosition(
                position => saveLocation(position),
                watchError => locationError(watchError),
                {
                    enableHighAccuracy: true,
                    timeout: 20000,
                    maximumAge: 0
                }
            );

            // watchPosition xato callback bermasa ham tugab qolmasligi uchun alohida timeout.
            locationTimer = setTimeout(() => {
                if (!userLocation) locationError(error);
            }, 25000);
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        }
    );
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

    if (!userLocation) {
        alert("❌ Avval 'Lokatsiyani belgilash' tugmasini bosing.");
        return;
    }

    let message = `<b>📦 YANGI BUYURTMA!</b>\n\n`;
    message += `👤 <b>Mijoz:</b> ${name}\n`;
    message += `📞 <b>Telefon:</b> ${cleanedPhone}\n`;
    if (userLocation.accuracy) message += `📍 <b>GPS aniqligi:</b> ±${Math.round(userLocation.accuracy)} m\n`;
    message += `\n🛒 <b>Mahsulotlar:</b>\n`;

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
            body: JSON.stringify({ chat_id: CHAT_ID, latitude: userLocation.lat, longitude: userLocation.lon })
        });
        if (!locationResponse.ok) throw new Error('Telegram location yuborilmadi');

        alert("✅ Buyurtma qabul qilindi! Lokatsiya ham yuborildi.");
        clearAll();
    } catch (err) {
        alert("❌ Buyurtma yuborishda xatolik. Internetni tekshiring.");
        console.error(err);
    }
}

// === 5. SAVATNI TOZALASH ===
function clearAll() {
    stopLocation();
    localStorage.removeItem('cart_v1');
    cart = [];
    renderCart();
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.getElementById('telegram-form').reset();
    locationBtn.classList.remove('bg-green-500');
    locationBtn.classList.add('bg-blue-500');
    locationBtn.disabled = false;
    locationBtn.innerText = "📍 Lokatsiyani belgilash";
    locationStatus.innerText = "Manzil belgilanmadi";
    userLocation = null;
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
