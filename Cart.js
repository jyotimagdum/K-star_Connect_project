const STORAGE_KEY = "kStarConnectState";
const API_BASE = window.location.origin.startsWith("http") ? window.location.origin : "http://localhost:3000";
const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
const {merchItems, ticketOptions} = window.KSTAR_DATA;

document.addEventListener("DOMContentLoaded", () => {
renderCartPage();
document.getElementById("cartCheckoutForm").addEventListener("submit", placeOrder);
});

function renderCartPage(){
const container = document.getElementById("cartPageItems");
const merchInCart = merchItems.filter(item => (state.cart || []).includes(item.id));
const ticketsInCart = ticketOptions.filter(ticket => (state.ticketCart || []).includes(ticket.id));
const rows = [
...merchInCart.map(item => ({type: "Merch", name: item.name, price: item.price})),
...ticketsInCart.map(ticket => ({type: "Ticket", name: `${ticket.city} - ${ticket.type}`, price: ticket.price}))
];
const total = rows.reduce((sum, item) => sum + item.price, 0);

document.getElementById("cartPageTotal").innerText = `$${total} total`;

if(rows.length === 0){
container.innerHTML = `<p class="muted">Your cart is empty. Go back and add merch or tickets first.</p>`;
return;
}

container.innerHTML = rows.map(item => `
<div class="cart-row">
<div>
<strong>${escapeHtml(item.name)}</strong>
<span class="card-meta">${item.type}</span>
</div>
<span class="price">$${item.price}</span>
</div>
`).join("");
}

async function placeOrder(event){
event.preventDefault();

if(!state.currentUser?.id){
notify("Login first before checkout.");
return;
}

if((state.cart || []).length === 0 && (state.ticketCart || []).length === 0){
notify("Your cart is empty.");
return;
}

const address = {
fullName: document.getElementById("addressName").value.trim(),
phone: document.getElementById("addressPhone").value.trim(),
line1: document.getElementById("addressLine").value.trim(),
city: document.getElementById("addressCity").value.trim(),
state: document.getElementById("addressState").value.trim(),
postalCode: document.getElementById("addressZip").value.trim()
};
const paymentMethod = document.getElementById("paymentMethod").value;

try{
const response = await fetch(`${API_BASE}/api/checkout`, {
method: "POST",
headers: {"Content-Type": "application/json"},
body: JSON.stringify({userId: state.currentUser.id, paymentMethod, address})
});
const data = await response.json();
if(!response.ok){
throw new Error(data.message || "Checkout failed.");
}
applyUser(data.user);
}catch(error){
state.bookedTickets = Array.from(new Set([...(state.bookedTickets || []), ...(state.ticketCart || [])]));
state.ticketCart = [];
state.cart = [];
state.points = (state.points || 0) + 50;
localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

notify(`Order placed with ${paymentMethod}.`);
renderCartPage();
}

function applyUser(user){
state.currentUser = {
id: user.id,
name: user.name,
email: user.email,
favoriteGroup: user.favoriteGroup || "",
country: user.country || ""
};
state.cart = user.cart || [];
state.ticketCart = user.ticketCart || [];
state.bookedTickets = user.bookedTickets || [];
state.points = user.points || 0;
state.notifications = user.notifications || [];
localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function notify(message){
const panel = document.getElementById("notificationPanel");
const toast = document.createElement("div");
toast.className = "toast";
toast.innerText = message;
panel.appendChild(toast);
setTimeout(() => toast.remove(), 3200);
}

function escapeHtml(value){
return String(value)
.replaceAll("&", "&amp;")
.replaceAll("<", "&lt;")
.replaceAll(">", "&gt;")
.replaceAll('"', "&quot;")
.replaceAll("'", "&#039;");
}
