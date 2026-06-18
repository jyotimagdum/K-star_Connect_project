const API_BASE = window.location.origin.startsWith("http") ? window.location.origin : "http://localhost:3000";
const STORAGE_KEY = "kStarConnectState";

const defaultState = {
currentUser: null,
selectedCommunity: "bts-v",
darkMode: false,
notifications: [],
points: 0,
cart: [],
ticketCart: [],
bookedTickets: [],
joinedLive: false,
votes: {
"bts-v": 42,
"blackpink-lisa": 35,
"twice-nayeon": 28,
"straykids-felix": 31
},
posts: []
};

const idols = [
{
id: "bts-v",
name: "BTS",
community: "ARMY Lounge",
role: "Global pop group",
members: 2200,
tag: "B",
color: "#8b5cf6",
profile: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=300&q=80",
cover: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=900&q=80",
albums: ["2 Cool 4 Skool", "Dark & Wild", "Wings", "Love Yourself: Tear", "Map of the Soul: 7"]
},
{
id: "blackpink-lisa",
name: "BLACKPINK",
community: "Blink Room",
role: "Performance quartet",
members: 1780,
tag: "BP",
color: "#d946ef",
profile: "https://images.unsplash.com/photo-1521334884684-d80222895322?auto=format&fit=crop&w=300&q=80",
cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80",
albums: ["Square One", "Square Up", "Kill This Love", "The Album", "Born Pink"]
},
{
id: "twice-nayeon",
name: "TWICE",
community: "Once Garden",
role: "Bright pop icons",
members: 1560,
tag: "T",
color: "#c084fc",
profile: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80",
cover: "https://images.unsplash.com/photo-1520872024865-3ff2805d8bb3?auto=format&fit=crop&w=900&q=80",
albums: ["The Story Begins", "Page Two", "Twicetagram", "Fancy You", "Formula of Love"]
},
{
id: "straykids-felix",
name: "Stray Kids",
community: "Stay Studio",
role: "Self-producing performers",
members: 1490,
tag: "SKZ",
color: "#a78bfa",
profile: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=300&q=80",
cover: "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=900&q=80",
albums: ["Mixtape", "I Am NOT", "Clé 1: MIROH", "GO LIVE", "NOEASY"]
}
];

const ticketOptions = [
{id: "seoul-vip", city: "Seoul", date: "Aug 18, 2026", type: "VIP Soundcheck", price: 240},
{id: "tokyo-floor", city: "Tokyo", date: "Sep 2, 2026", type: "Floor Seat", price: 185},
{id: "la-bowl", city: "Los Angeles", date: "Oct 12, 2026", type: "Lower Bowl", price: 150}
];

const merchItems = [
{id: "lightstick", name: "Official Lightstick", price: 59, image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=600&q=80"},
{id: "hoodie", name: "Tour Hoodie", price: 76, image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=600&q=80"},
{id: "photobook", name: "Limited Photobook", price: 42, image: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=600&q=80"},
{id: "bracelet", name: "Friendship Bracelet Set", price: 24, image: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=600&q=80"}
];

idols.splice(0, idols.length, ...window.KSTAR_DATA.groups);
ticketOptions.splice(0, ticketOptions.length, ...window.KSTAR_DATA.ticketOptions);
merchItems.splice(0, merchItems.length, ...window.KSTAR_DATA.merchItems);

const badges = [
{name: "First Login", text: "Signed into K-Star Connect.", points: 10},
{name: "Community Starter", text: "Joined an idol community.", points: 25},
{name: "Fan Voter", text: "Cast a fan choice vote.", points: 40},
{name: "Chat Spark", text: "Sent a live chat message.", points: 60},
{name: "Merch Collector", text: "Added merch to your cart.", points: 80},
{name: "Concert Ready", text: "Booked a concert ticket.", points: 100}
];

let state = loadState();
let selectedTickets = new Set();
let socket = null;

document.addEventListener("DOMContentLoaded", async () => {
bindEvents();
bindAuthTabs();
applyDarkMode();
await bootstrapFromServer();
renderAll();
connectChat();
});

function loadState(){
const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
return {...defaultState, ...saved};
}

function saveState(){
localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function api(path, options = {}){
const response = await fetch(`${API_BASE}${path}`, {
headers: {"Content-Type": "application/json", ...(options.headers || {})},
...options
});
const data = await response.json().catch(() => ({}));

if(!response.ok){
throw new Error(data.message || "Request failed.");
}

return data;
}

async function bootstrapFromServer(){
if(!state.currentUser?.id){
return;
}

try{
const data = await api(`/api/bootstrap/${state.currentUser.id}`);
applyUser(data.user);
state.posts = data.posts;
state.votes = data.votes;
saveState();
}catch(error){
notify("Backend is not connected yet. Using saved browser data.");
}
}

function bindEvents(){
document.getElementById("loginForm").addEventListener("submit", handleLogin);
document.getElementById("signupForm").addEventListener("submit", handleSignup);
document.getElementById("profileForm").addEventListener("submit", saveProfile);
document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("darkModeToggle").addEventListener("click", toggleDarkMode);
document.getElementById("notifyBtn").addEventListener("click", () => notify("You are all caught up."));
document.getElementById("createPostBtn").addEventListener("click", createPost);
document.getElementById("chatForm").addEventListener("submit", sendChat);
document.getElementById("joinLiveBtn").addEventListener("click", joinLive);
document.getElementById("bookTicketsBtn").addEventListener("click", bookTickets);
const checkoutBtn = document.getElementById("checkoutBtn");
if(checkoutBtn){
checkoutBtn.addEventListener("click", placeOrder);
}
}

function bindAuthTabs(){
document.querySelectorAll("[data-bs-target]").forEach(tab => {
tab.addEventListener("click", () => {
const target = document.querySelector(tab.dataset.bsTarget);
document.querySelectorAll(".auth-tabs .nav-link").forEach(item => item.classList.remove("active"));
document.querySelectorAll(".tab-pane").forEach(pane => pane.classList.remove("show", "active"));
tab.classList.add("active");
target.classList.add("show", "active");
});
});
}

function renderAll(){
updateAuthGate();
renderUser();
renderProfileForm();
renderCommunities();
renderPosts();
renderVotes();
renderTickets();
renderMerch();
renderCart();
renderBadges();
renderNotificationCount();
}

async function handleLogin(event){
event.preventDefault();
const email = document.getElementById("loginEmail").value.trim().toLowerCase();
const password = document.getElementById("loginPassword").value;

if(!email || password.length < 6){
notify("Enter your signed-up email and password.");
return;
}

try{
const data = await api("/api/auth/login", {method: "POST", body: JSON.stringify({email, password})});
applyUser(data.user);
await bootstrapFromServer();
notify(`Welcome back, ${state.currentUser.name}.`);
event.target.reset();
renderAll();
document.getElementById("communities").scrollIntoView({behavior: "smooth"});
}catch(error){
notify(`${error.message} If you are new, please sign up first.`);
}
}

async function handleSignup(event){
event.preventDefault();
const name = document.getElementById("signupName").value.trim();
const email = document.getElementById("signupEmail").value.trim().toLowerCase();
const password = document.getElementById("signupPassword").value;
const favoriteGroup = document.getElementById("signupFavorite").value;
const country = document.getElementById("signupCountry").value.trim();

if(!name || !email || password.length < 6 || !favoriteGroup || !country){
notify("Fill in all signup details before creating your account.");
return;
}

try{
const data = await api("/api/auth/signup", {
method: "POST",
body: JSON.stringify({name, email, password, favoriteGroup, country})
});
applyUser(data.user);
await bootstrapFromServer();
notify(`Welcome, ${state.currentUser.name}. Your fan account is ready.`);
event.target.reset();
renderAll();
document.getElementById("communities").scrollIntoView({behavior: "smooth"});
}catch(error){
notify(error.message);
}
}

function logout(){
state.currentUser = null;
selectedTickets.clear();
saveState();
renderAll();
notify("You have logged out.");
document.getElementById("auth").scrollIntoView({behavior: "smooth"});
}

function applyUser(user){
state.currentUser = {
id: user.id,
name: user.name,
email: user.email,
favoriteGroup: user.favoriteGroup || "",
country: user.country || ""
};
state.selectedCommunity = user.selectedCommunity || state.selectedCommunity;
state.points = user.points || 0;
state.cart = user.cart || [];
state.ticketCart = user.ticketCart || state.ticketCart || [];
state.bookedTickets = user.bookedTickets || [];
state.joinedLive = Boolean(user.joinedLive);
state.notifications = user.notifications || [];
saveState();
}

function renderUser(){
document.getElementById("currentFanName").innerText = state.currentUser?.name || "Guest Fan";
document.getElementById("currentFanEmail").innerText = state.currentUser?.email || "Sign in to unlock badges, orders, votes, and comments.";
}

function renderProfileForm(){
if(!state.currentUser){
return;
}

document.getElementById("profileName").value = state.currentUser.name || "";
document.getElementById("profileFavorite").value = state.currentUser.favoriteGroup || "BTS";
document.getElementById("profileCountry").value = state.currentUser.country || "";
document.getElementById("profileBadge").innerText = `${state.points} points`;
}

async function saveProfile(event){
event.preventDefault();
const name = document.getElementById("profileName").value.trim();
const favoriteGroup = document.getElementById("profileFavorite").value;
const country = document.getElementById("profileCountry").value.trim();

if(!name || !favoriteGroup || !country){
notify("Profile name, favorite group, and country are required.");
return;
}

try{
const data = await api(`/api/users/${state.currentUser.id}/profile`, {
method: "PATCH",
body: JSON.stringify({name, favoriteGroup, country})
});
applyUser(data.user);
}catch(error){
state.currentUser = {...state.currentUser, name, favoriteGroup, country};
notify("Profile saved locally because backend is unavailable.");
}

saveState();
renderAll();
notify("Profile updated.");
}

function updateAuthGate(){
const isAuthenticated = Boolean(state.currentUser);
document.body.classList.toggle("is-authenticated", isAuthenticated);
document.getElementById("appContent").hidden = !isAuthenticated;
document.querySelectorAll(".app-only").forEach(element => {
element.setAttribute("aria-hidden", String(!isAuthenticated));
});
}

function renderCommunities(){
const grid = document.getElementById("idolGrid");
grid.innerHTML = "";

idols.forEach(idol => {
const card = document.createElement("article");
card.className = `idol-card ${idol.id === state.selectedCommunity ? "active" : ""}`;
card.innerHTML = `
<div class="group-cover" style="background-image:linear-gradient(180deg,rgba(42,33,64,.05),rgba(42,33,64,.45)),url('${idol.cover}')"></div>
<div class="idol-profile-row">
<img class="idol-avatar" src="${idol.profile}" alt="${idol.name} profile picture">
<div>
<h3>${idol.name}</h3>
<p class="card-meta">${idol.role}</p>
</div>
</div>
<p class="card-meta">${idol.members.toLocaleString()} fans in ${idol.community}</p>
<div class="album-list">${Object.keys(idol.albums).map(album => `<a class="album-chip" href="Album.html?group=${encodeURIComponent(idol.id)}&album=${encodeURIComponent(album)}">${album}</a>`).join("")}</div>
<button type="button">Join community</button>
`;
card.querySelector("button").addEventListener("click", () => selectCommunity(idol.id));
grid.appendChild(card);
});

document.getElementById("selectedCommunityLabel").innerText = getSelectedIdol().community;
}

async function selectCommunity(id){
state.selectedCommunity = id;

try{
const data = await api(`/api/users/${state.currentUser.id}/community`, {
method: "PATCH",
body: JSON.stringify({communityId: id})
});
applyUser(data.user);
}catch(error){
state.points += 15;
notify("Community saved locally because backend is unavailable.");
}

saveState();
renderAll();
notify(`Switched to ${getSelectedIdol().community}.`);
window.location.href = `Community.html?group=${encodeURIComponent(id)}`;
}

function getSelectedIdol(){
return idols.find(idol => idol.id === state.selectedCommunity) || idols[0];
}

async function createPost(){
const input = document.getElementById("postInput");
const text = input.value.trim();

if(!text){
notify("Write something before posting.");
return;
}

try{
const data = await api("/api/posts", {
method: "POST",
body: JSON.stringify({userId: state.currentUser.id, communityId: state.selectedCommunity, text})
});
state.posts.unshift(data.post);
applyUser(data.user);
}catch(error){
state.posts.unshift({
id: crypto.randomUUID(),
communityId: state.selectedCommunity,
author: state.currentUser?.name || "Guest Fan",
text,
likes: 0,
comments: [],
createdAt: new Date().toLocaleDateString()
});
state.points += 10;
notify("Post saved locally because backend is unavailable.");
}

input.value = "";
saveState();
renderAll();
}

function renderPosts(){
const container = document.getElementById("posts");
const communityPosts = state.posts.filter(post => post.communityId === state.selectedCommunity);
container.innerHTML = "";
document.getElementById("postsCount").innerText = communityPosts.length;

if(communityPosts.length === 0){
container.innerHTML = `<p class="muted">No posts yet. Start the first conversation for ${getSelectedIdol().community}.</p>`;
return;
}

communityPosts.forEach(post => {
const postDiv = document.createElement("article");
postDiv.className = "post";
postDiv.innerHTML = `
<div class="post-meta">${escapeHtml(post.author)} - ${escapeHtml(post.createdAt || "")}</div>
<p>${escapeHtml(post.text)}</p>
<div class="actions">
<button type="button" data-like="${post.id}">Like ${post.likes}</button>
</div>
<input class="comment-box" placeholder="Write comment..." data-comment-input="${post.id}">
<div class="actions">
<button type="button" data-comment="${post.id}">Comment</button>
</div>
<div>${post.comments.map(comment => `<div class="comment">${escapeHtml(comment)}</div>`).join("")}</div>
`;
postDiv.querySelector("[data-like]").addEventListener("click", () => likePost(post.id));
postDiv.querySelector("[data-comment]").addEventListener("click", () => addComment(post.id));
container.appendChild(postDiv);
});
}

async function likePost(postId){
const post = state.posts.find(item => item.id === postId);
if(!post){
return;
}

try{
const data = await api(`/api/posts/${postId}/like`, {
method: "PATCH",
body: JSON.stringify({userId: state.currentUser.id})
});
Object.assign(post, data.post);
if(data.user){
applyUser(data.user);
}
}catch(error){
post.likes++;
state.points += 5;
}

saveState();
renderAll();
}

async function addComment(postId){
const input = document.querySelector(`[data-comment-input="${postId}"]`);
const comment = input.value.trim();
const post = state.posts.find(item => item.id === postId);

if(!comment || !post){
return;
}

try{
const data = await api(`/api/posts/${postId}/comments`, {
method: "POST",
body: JSON.stringify({userId: state.currentUser.id, text: comment})
});
Object.assign(post, data.post);
applyUser(data.user);
}catch(error){
post.comments.push(`${state.currentUser?.name || "Guest"}: ${comment}`);
state.points += 8;
}

saveState();
renderAll();
}

function connectChat(){
if(typeof io !== "function"){
document.getElementById("chatStatus").innerText = "Backend offline";
return;
}

socket = io(API_BASE);
socket.on("connect", () => {
document.getElementById("chatStatus").innerText = "Connected";
});
socket.on("connect_error", () => {
document.getElementById("chatStatus").innerText = "Backend offline";
});
socket.on("chat message", data => {
addChatMessage(data.user, data.message);
});
}

function sendChat(event){
event.preventDefault();
const input = document.getElementById("chatInput");
const message = input.value.trim();

if(!message){
return;
}

const user = state.currentUser?.name || "Guest Fan";
if(socket?.connected){
socket.emit("chat message", {user, message, community: state.selectedCommunity});
}else{
addChatMessage(user, message);
}

input.value = "";
state.points += 20;
saveState();
renderBadges();
}

function addChatMessage(user, message){
const container = document.getElementById("chatMessages");
const div = document.createElement("div");
div.className = "chat-message";
div.innerHTML = `<strong>${escapeHtml(user)}</strong><span>${escapeHtml(message)}</span>`;
container.appendChild(div);
container.scrollTop = container.scrollHeight;
}

function renderVotes(){
const grid = document.getElementById("voteGrid");
const total = Object.values(state.votes).reduce((sum, count) => sum + count, 0);
grid.innerHTML = "";
document.getElementById("totalVotes").innerText = `${total} votes`;

idols.forEach(idol => {
const count = state.votes[idol.id] || 0;
const percent = total ? Math.round((count / total) * 100) : 0;
const card = document.createElement("article");
card.className = "vote-card";
card.innerHTML = `
<h3>${idol.name}</h3>
<p class="card-meta">${idol.community}</p>
<progress value="${percent}" max="100"></progress>
<p class="card-meta">${count} votes - ${percent}%</p>
<button type="button">Vote</button>
`;
card.querySelector("button").addEventListener("click", () => voteFor(idol.id));
grid.appendChild(card);
});
}

async function voteFor(id){
try{
const data = await api(`/api/votes/${id}`, {
method: "POST",
body: JSON.stringify({userId: state.currentUser.id})
});
state.votes = data.votes;
if(data.user){
applyUser(data.user);
}
}catch(error){
state.votes[id] = (state.votes[id] || 0) + 1;
state.points += 25;
}

saveState();
renderAll();
notify(`Vote counted for ${idols.find(idol => idol.id === id).name}.`);
}

async function joinLive(){
try{
const data = await api("/api/live/join", {
method: "POST",
body: JSON.stringify({userId: state.currentUser.id})
});
applyUser(data.user);
}catch(error){
state.joinedLive = true;
state.points += 30;
}

document.getElementById("viewerCount").innerText = "2,482 fans watching now";
saveState();
renderAll();
notify("You joined the live stream watch party.");
}

function renderTickets(){
const grid = document.getElementById("ticketGrid");
grid.innerHTML = "";

ticketOptions.forEach(ticket => {
const selected = selectedTickets.has(ticket.id);
const booked = state.bookedTickets.includes(ticket.id);
const inCart = state.ticketCart.includes(ticket.id);
const card = document.createElement("article");
card.className = `ticket-card ${selected || inCart ? "selected" : ""}`;
card.innerHTML = `
<h3>${ticket.city}</h3>
<p class="card-meta">${ticket.date} - ${ticket.type}</p>
<p class="price">$${ticket.price}</p>
<button type="button" ${booked || inCart ? "disabled" : ""}>${booked ? "Booked" : inCart ? "In cart" : selected ? "Selected" : "Select"}</button>
`;
card.querySelector("button").addEventListener("click", () => toggleTicket(ticket.id));
grid.appendChild(card);
});

const total = ticketOptions
.filter(ticket => selectedTickets.has(ticket.id))
.reduce((sum, ticket) => sum + ticket.price, 0);
document.getElementById("ticketTotal").innerText = `$${total} selected`;
}

function toggleTicket(id){
if(state.bookedTickets.includes(id)){
return;
}
selectedTickets.has(id) ? selectedTickets.delete(id) : selectedTickets.add(id);
renderTickets();
}

async function bookTickets(){
if(selectedTickets.size === 0){
notify("Select at least one ticket first.");
return;
}

const ticketIds = Array.from(selectedTickets);
try{
const data = await api("/api/tickets/cart", {
method: "POST",
body: JSON.stringify({userId: state.currentUser.id, ticketIds})
});
applyUser(data.user);
}catch(error){
ticketIds.forEach(id => {
if(!state.ticketCart.includes(id) && !state.bookedTickets.includes(id)){
state.ticketCart.push(id);
}
});
}

selectedTickets.clear();
saveState();
renderAll();
notify("Selected tickets were added to your cart.");
}

function renderMerch(){
const grid = document.getElementById("merchGrid");
grid.innerHTML = "";

merchItems.forEach(item => {
const inCart = state.cart.includes(item.id);
const card = document.createElement("article");
card.className = `merch-card ${inCart ? "in-cart" : ""}`;
card.innerHTML = `
<div class="merch-art" style="background-image:linear-gradient(180deg,rgba(42,33,64,.02),rgba(42,33,64,.18)),url('${item.image}')"></div>
<h3>${item.name}</h3>
<p class="price">$${item.price}</p>
<button type="button">${inCart ? "Remove" : "Add to cart"}</button>
`;
card.querySelector("button").addEventListener("click", () => toggleCart(item.id));
grid.appendChild(card);
});

document.getElementById("cartCount").innerText = `${state.cart.length} items`;
}

async function toggleCart(id){
try{
const data = await api("/api/cart/toggle", {
method: "POST",
body: JSON.stringify({userId: state.currentUser.id, itemId: id})
});
applyUser(data.user);
}catch(error){
if(state.cart.includes(id)){
state.cart = state.cart.filter(itemId => itemId !== id);
}else{
state.cart.push(id);
state.points += 20;
}
}

saveState();
renderAll();
}

function renderCart(){
const container = document.getElementById("cartItems");
const merchInCart = merchItems.filter(item => state.cart.includes(item.id));
const ticketsInCart = ticketOptions.filter(ticket => state.ticketCart.includes(ticket.id));
const rows = [
...merchInCart.map(item => ({type: "Merch", name: item.name, price: item.price})),
...ticketsInCart.map(ticket => ({type: "Ticket", name: `${ticket.city} - ${ticket.type}`, price: ticket.price}))
];
const total = rows.reduce((sum, item) => sum + item.price, 0);

document.getElementById("checkoutTotal").innerText = `$${total} total`;

if(rows.length === 0){
container.innerHTML = `<p class="muted">Your cart is empty. Add merch or concert tickets to prepare checkout.</p>`;
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

async function placeOrder(){
const hasItems = state.cart.length > 0 || state.ticketCart.length > 0;
const paymentMethod = document.getElementById("paymentMethod").value;

if(!hasItems){
notify("Add merch or tickets before placing an order.");
return;
}

try{
const data = await api("/api/checkout", {
method: "POST",
body: JSON.stringify({userId: state.currentUser.id, paymentMethod})
});
applyUser(data.user);
}catch(error){
state.bookedTickets = Array.from(new Set([...state.bookedTickets, ...state.ticketCart]));
state.ticketCart = [];
state.cart = [];
state.points += 50;
}

saveState();
renderAll();
notify(`Order placed with ${paymentMethod}.`);
}

function renderBadges(){
const grid = document.getElementById("badgeGrid");
grid.innerHTML = "";
document.getElementById("fanPoints").innerText = `${state.points} points`;

badges.forEach(badge => {
const unlocked = state.points >= badge.points;
const card = document.createElement("article");
card.className = `badge-card ${unlocked ? "unlocked" : ""}`;
card.innerHTML = `
<div class="badge-icon">${unlocked ? "*" : "-"}</div>
<h3>${badge.name}</h3>
<p class="card-meta">${badge.text}</p>
<p class="card-meta">${unlocked ? "Unlocked" : `${badge.points - state.points} points to unlock`}</p>
`;
grid.appendChild(card);
});
}

function toggleDarkMode(){
state.darkMode = !state.darkMode;
applyDarkMode();
saveState();
}

function applyDarkMode(){
document.body.classList.toggle("dark", state.darkMode);
document.getElementById("darkModeToggle").innerText = state.darkMode ? "Light mode" : "Dark mode";
}

function notify(message){
state.notifications.unshift({message, time: Date.now()});
state.notifications = state.notifications.slice(0, 12);
saveState();
renderNotificationCount();

const panel = document.getElementById("notificationPanel");
if(!panel){
return;
}

const toast = document.createElement("div");
toast.className = "toast";
toast.innerText = message;
panel.appendChild(toast);
setTimeout(() => toast.remove(), 3200);
}

function renderNotificationCount(){
const count = document.getElementById("notificationCount");
if(count){
count.innerText = state.notifications.length;
}
}

function escapeHtml(value){
return String(value)
.replaceAll("&", "&amp;")
.replaceAll("<", "&lt;")
.replaceAll(">", "&gt;")
.replaceAll('"', "&quot;")
.replaceAll("'", "&#039;");
}
