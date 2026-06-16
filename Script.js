const API_BASE = window.location.origin.startsWith("http") ? window.location.origin : "http://localhost:3000";
const STORAGE_KEY = "kStarConnectState";

const defaultState = {
currentUser: null,
selectedCommunity: "bts-v",
darkMode: false,
notifications: [],
points: 0,
cart: [],
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
{id: "bts-v", name: "BTS V", community: "BTS V Crew", role: "Global Artist", members: 1200, tag: "V", color: "#e84888"},
{id: "blackpink-lisa", name: "BLACKPINK Lisa", community: "Lilies Lounge", role: "Dance Icon", members: 980, tag: "L", color: "#246fb5"},
{id: "twice-nayeon", name: "TWICE Nayeon", community: "Pop Star Club", role: "Vocal Queen", members: 860, tag: "N", color: "#20a7a8"},
{id: "straykids-felix", name: "Stray Kids Felix", community: "Sunshine District", role: "Performer", members: 910, tag: "F", color: "#f3b23f"}
];

const ticketOptions = [
{id: "seoul-vip", city: "Seoul", date: "Aug 18, 2026", type: "VIP Soundcheck", price: 240},
{id: "tokyo-floor", city: "Tokyo", date: "Sep 2, 2026", type: "Floor Seat", price: 185},
{id: "la-bowl", city: "Los Angeles", date: "Oct 12, 2026", type: "Lower Bowl", price: 150}
];

const merchItems = [
{id: "lightstick", name: "Official Lightstick", price: 59},
{id: "hoodie", name: "Tour Hoodie", price: 76},
{id: "photobook", name: "Limited Photobook", price: 42},
{id: "bracelet", name: "Friendship Bracelet Set", price: 24}
];

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
document.getElementById("authForm").addEventListener("submit", handleAuth);
document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("darkModeToggle").addEventListener("click", toggleDarkMode);
document.getElementById("notifyBtn").addEventListener("click", () => notify("You are all caught up."));
document.getElementById("createPostBtn").addEventListener("click", createPost);
document.getElementById("chatForm").addEventListener("submit", sendChat);
document.getElementById("joinLiveBtn").addEventListener("click", joinLive);
document.getElementById("bookTicketsBtn").addEventListener("click", bookTickets);
}

function renderAll(){
updateAuthGate();
renderUser();
renderCommunities();
renderPosts();
renderVotes();
renderTickets();
renderMerch();
renderBadges();
renderNotificationCount();
}

async function handleAuth(event){
event.preventDefault();
const mode = event.submitter.dataset.mode;
const name = document.getElementById("fanName").value.trim();
const email = document.getElementById("fanEmail").value.trim().toLowerCase();
const password = document.getElementById("fanPassword").value;

if(!name || !email || password.length < 6){
notify("Please enter a name, valid email, and a 6 character password.");
return;
}

try{
const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
const payload = mode === "signup" ? {name, email, password} : {email, password};
const data = await api(endpoint, {method: "POST", body: JSON.stringify(payload)});
applyUser(data.user);
await bootstrapFromServer();
notify(mode === "signup" ? `Welcome, ${state.currentUser.name}.` : `Welcome back, ${state.currentUser.name}.`);
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
state.currentUser = {id: user.id, name: user.name, email: user.email};
state.selectedCommunity = user.selectedCommunity || state.selectedCommunity;
state.points = user.points || 0;
state.cart = user.cart || [];
state.bookedTickets = user.bookedTickets || [];
state.joinedLive = Boolean(user.joinedLive);
state.notifications = user.notifications || [];
saveState();
}

function renderUser(){
document.getElementById("currentFanName").innerText = state.currentUser?.name || "Guest Fan";
document.getElementById("currentFanEmail").innerText = state.currentUser?.email || "Sign in to unlock badges, orders, votes, and comments.";
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
<div class="idol-avatar" style="background:${idol.color}">${idol.tag}</div>
<div>
<h3>${idol.name}</h3>
<p class="card-meta">${idol.role}</p>
</div>
<p class="card-meta">${idol.members.toLocaleString()} fans in ${idol.community}</p>
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
const card = document.createElement("article");
card.className = `ticket-card ${selected ? "selected" : ""}`;
card.innerHTML = `
<h3>${ticket.city}</h3>
<p class="card-meta">${ticket.date} - ${ticket.type}</p>
<p class="price">$${ticket.price}</p>
<button type="button" ${booked ? "disabled" : ""}>${booked ? "Booked" : selected ? "Selected" : "Select"}</button>
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
const data = await api("/api/tickets/book", {
method: "POST",
body: JSON.stringify({userId: state.currentUser.id, ticketIds})
});
applyUser(data.user);
}catch(error){
ticketIds.forEach(id => {
if(!state.bookedTickets.includes(id)){
state.bookedTickets.push(id);
}
});
state.points += 40;
}

selectedTickets.clear();
saveState();
renderAll();
notify("Your concert ticket booking is confirmed.");
}

function renderMerch(){
const grid = document.getElementById("merchGrid");
grid.innerHTML = "";

merchItems.forEach(item => {
const inCart = state.cart.includes(item.id);
const card = document.createElement("article");
card.className = `merch-card ${inCart ? "in-cart" : ""}`;
card.innerHTML = `
<div class="merch-art"></div>
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
