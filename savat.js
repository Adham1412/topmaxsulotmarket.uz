// === KONFIGURATSIYA (O'zingiznikini qo'ying) ===
const BOT_TOKEN = "8399989077:AAGjnF1-MYvE06jQ9Bu6WOr9cMoDNzH21Dc"; // BotFather bergan token
const CHAT_ID = "6481290484"; // O'zingizning ID raqamingiz (userinfobot orqali olinadi)

// === O'ZGARUVCHILAR ===
let cart = JSON.parse(localStorage.getItem('cart_v1')) || [];
let coupon = null;
let userLocation = null; // Lokatsiya koordinatalari (latitude, longitude)

// Pulni formatlash
const money = v => new Intl.NumberFormat('ru-RU').format(v) + " so'm";

// === 1. SAVATNI CHIZISH ===
function renderCart() {
    const container = document.getElementById('cart-content');
    const empty = document.getElementById('empty-state');
    container.innerHTML = '';

    if (!cart || cart.length === 0) {
        empty.classList.remove('hidden');
        updateSummary(0, 0);
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

// === MIQDOR O'ZGARTIRISH ===
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
    let discount = coupon ? Math.round(subtotalVal * coupon.discount) : 0;
    const total = subtotalVal - discount + shipping;

    document.getElementById('items-count').innerText = cart.reduce((s, i) => s + i.qty, 0);
    document.getElementById('subtotal').innerText = money(total);
    document.getElementById('shipping-text').innerText = shipping === 0 ? 'Bepul' : money(shipping);
}

function saveCart() {
    localStorage.setItem('cart_v1', JSON.stringify(cart));
}

// === 2. MODAL VA GEOLOKATSIYA ===
const modal = document.getElementById('order-modal');
const checkoutBtn = document.getElementById('checkout-btn');
const closeBtn = document.querySelector('.close-modal');
const locationBtn = document.getElementById('get-location');
const locationStatus = document.getElementById('location-status');

// Modalni ochish
checkoutBtn.addEventListener('click', () => {
    if (cart.length === 0) return alert("Savat bo'sh!");
    modal.classList.remove('hidden');
    modal.classList.add('flex');
});

// Modalni yopish
closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
});

// LOKATSIYANI OLISH (GPS)
locationBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
        locationStatus.innerText = "Brauzeringiz geolokatsiyani qo'llab quvvatlamaydi.";
        return;
    }

    locationStatus.innerText = "⏳ Lokatsiya aniqlanmoqda...";
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            userLocation = {
                lat: position.coords.latitude,
                lon: position.coords.longitude
            };
            locationStatus.innerHTML = `✅ Lokatsiya olindi! <br> <span class="text-xs text-blue-600">(${userLocation.lat.toFixed(4)}, ${userLocation.lon.toFixed(4)})</span>`;
            locationBtn.classList.replace('bg-blue-500', 'bg-green-500');
            locationBtn.innerText = "Manzil belgilandi";
        },
        (error) => {
            locationStatus.innerText = "❌ Lokatsiyani olib bo'lmadi. Ruxsat bering yoki qayta urinib ko'ring.";
            console.error(error);
        }
    );
});

// === 3. TELEGRAMGA YUBORISH ===
async function sendTelegram() {
    const name = document.getElementById('client-name').value;
    const phone = document.getElementById('client-phone').value;

    if (!userLocation) {
        alert("Iltimos, yetkazib berish manzilini belgilash uchun 'Joylashuvni belgilash' tugmasini bosing!");
        return;
    }

    // 1. Mahsulotlar ro'yxatini matn qilish
    let message = `<b>📦 YANGI BUYURTMA!</b>\n\n`;
    message += `👤 <b>Mijoz:</b> ${name}\n`;
    message += `📞 <b>Telefon:</b> ${phone}\n\n`;
    message += `🛒 <b>Mahsulotlar:</b>\n`;

    cart.forEach((item, index) => {
        message += `${index + 1}. ${item.title} (x${item.qty}) - ${money(item.price * item.qty)}\n`;
    });

    const totalText = document.getElementById('subtotal').innerText;
    message += `\n💰 <b>JAMI: ${totalText}</b>`;

    // 2. Xabarni yuborish
    try {
        const textUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        await fetch(textUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });

        // 3. Lokatsiyani yuborish
        const locUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendLocation`;
        await fetch(locUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                latitude: userLocation.lat,
                longitude: userLocation.lon
            })
        });

        alert("✅ Buyurtmangiz qabul qilindi! Tez orada aloqaga chiqamiz.");
        
        // Savatni tozalash va modalni yopish
        localStorage.removeItem('cart_v1');
        cart = [];
        renderCart();
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.getElementById('telegram-form').reset();
        locationBtn.classList.replace('bg-green-500', 'bg-blue-500');
        locationBtn.innerText = "📍 Joylashuvni belgilash";
        userLocation = null;

    } catch (error) {
        alert("❌ Xatolik yuz berdi. Internetni tekshiring.");
        console.error(error);
    }
}

// Dastlabki ishga tushirish
renderCart();