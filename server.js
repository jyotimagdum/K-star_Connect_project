require("dotenv").config();

const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const {Server} = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
cors: {
origin: process.env.CLIENT_ORIGIN || "*",
methods: ["GET", "POST"]
}
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/kstar_connect";

const idolIds = ["bts-v", "blackpink-lisa", "twice-nayeon", "straykids-felix"];
const defaultVotes = {
"bts-v": 42,
"blackpink-lisa": 35,
"twice-nayeon": 28,
"straykids-felix": 31
};

mongoose.set("strictQuery", true);
mongoose.set("bufferCommands", false);

const userSchema = new mongoose.Schema({
name: {type: String, required: true, trim: true},
email: {type: String, required: true, unique: true, lowercase: true, trim: true},
passwordHash: {type: String, required: true},
favoriteGroup: {type: String, default: ""},
country: {type: String, default: ""},
address: {
fullName: {type: String, default: ""},
phone: {type: String, default: ""},
line1: {type: String, default: ""},
city: {type: String, default: ""},
state: {type: String, default: ""},
postalCode: {type: String, default: ""}
},
selectedCommunity: {type: String, default: "bts-v"},
points: {type: Number, default: 0},
cart: [{type: String}],
ticketCart: [{type: String}],
bookedTickets: [{type: String}],
joinedLive: {type: Boolean, default: false},
notifications: [{
message: String,
time: {type: Date, default: Date.now}
}]
}, {timestamps: true});

const postSchema = new mongoose.Schema({
communityId: {type: String, required: true, index: true},
author: {type: String, required: true},
authorId: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
text: {type: String, required: true, trim: true},
likes: {type: Number, default: 0},
comments: [{
author: String,
text: String,
createdAt: {type: Date, default: Date.now}
}]
}, {timestamps: true});

const voteSchema = new mongoose.Schema({
idolId: {type: String, required: true, unique: true},
count: {type: Number, default: 0}
}, {timestamps: true});

const chatMessageSchema = new mongoose.Schema({
user: {type: String, required: true},
message: {type: String, required: true},
community: {type: String, default: "general"}
}, {timestamps: true});

const User = mongoose.model("User", userSchema);
const Post = mongoose.model("Post", postSchema);
const Vote = mongoose.model("Vote", voteSchema);
const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);

app.use(cors({origin: process.env.CLIENT_ORIGIN || "*"}));
app.use(express.json());
app.use(express.static(__dirname));

app.get("/api/health", (req, res) => {
res.json({ok: true, database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"});
});

app.post("/api/auth/signup", async (req, res) => {
try{
const {name, email, password, favoriteGroup, country} = req.body;

if(!name || !email || !password || password.length < 6 || !favoriteGroup || !country){
return res.status(400).json({message: "Name, email, password, favorite group, and country are required."});
}

const existingUser = await User.findOne({email: email.toLowerCase()});
if(existingUser){
return res.status(409).json({message: "That fan account already exists."});
}

const passwordHash = await bcrypt.hash(password, 10);
const user = await User.create({
name,
email,
passwordHash,
favoriteGroup,
country,
points: 10,
notifications: [{message: "First Login badge unlocked."}]
});

res.status(201).json({user: serializeUser(user)});
}catch(error){
res.status(500).json({message: "Signup failed."});
}
});

app.post("/api/auth/login", async (req, res) => {
try{
const {email, password} = req.body;
const user = await User.findOne({email: String(email || "").toLowerCase()});

if(!user || !(await bcrypt.compare(password || "", user.passwordHash))){
return res.status(401).json({message: "Invalid email or password."});
}

user.points += 10;
pushNotification(user, "Welcome back points added.");
await user.save();

res.json({user: serializeUser(user)});
}catch(error){
res.status(500).json({message: "Login failed."});
}
});

app.get("/api/bootstrap/:userId", async (req, res) => {
try{
const [user, posts, votes] = await Promise.all([
User.findById(req.params.userId),
Post.find().sort({createdAt: -1}).limit(100),
getVotes()
]);

if(!user){
return res.status(404).json({message: "User not found."});
}

res.json({
user: serializeUser(user),
posts: posts.map(serializePost),
votes
});
}catch(error){
res.status(500).json({message: "Could not load app data."});
}
});

app.patch("/api/users/:userId/community", async (req, res) => {
const user = await User.findById(req.params.userId);
if(!user || !idolIds.includes(req.body.communityId)){
return res.status(400).json({message: "Invalid community."});
}

user.selectedCommunity = req.body.communityId;
user.points += 15;
pushNotification(user, "Community activity points added.");
await user.save();
res.json({user: serializeUser(user)});
});

app.patch("/api/users/:userId/profile", async (req, res) => {
const user = await User.findById(req.params.userId);
const {name, favoriteGroup, country} = req.body;

if(!user || !name || !favoriteGroup || !country){
return res.status(400).json({message: "Name, favorite group, and country are required."});
}

user.name = name;
user.favoriteGroup = favoriteGroup;
user.country = country;
pushNotification(user, "Profile updated.");
await user.save();

res.json({user: serializeUser(user)});
});

app.post("/api/posts", async (req, res) => {
try{
const {userId, communityId, text} = req.body;
const user = await User.findById(userId);

if(!user || !communityId || !text){
return res.status(400).json({message: "User, community, and post text are required."});
}

const post = await Post.create({
communityId,
author: user.name,
authorId: user._id,
text
});

user.points += 10;
pushNotification(user, "Post published.");
await user.save();

res.status(201).json({post: serializePost(post), user: serializeUser(user)});
}catch(error){
res.status(500).json({message: "Could not create post."});
}
});

app.patch("/api/posts/:postId/like", async (req, res) => {
const post = await Post.findByIdAndUpdate(req.params.postId, {$inc: {likes: 1}}, {new: true});
const user = req.body.userId ? await User.findById(req.body.userId) : null;

if(!post){
return res.status(404).json({message: "Post not found."});
}

if(user){
user.points += 5;
pushNotification(user, "You liked a fan post.");
await user.save();
}

res.json({post: serializePost(post), user: user ? serializeUser(user) : null});
});

app.post("/api/posts/:postId/comments", async (req, res) => {
const {userId, text} = req.body;
const [post, user] = await Promise.all([
Post.findById(req.params.postId),
User.findById(userId)
]);

if(!post || !user || !text){
return res.status(400).json({message: "Post, user, and comment text are required."});
}

post.comments.push({author: user.name, text});
user.points += 8;
pushNotification(user, "Comment added.");
await Promise.all([post.save(), user.save()]);

res.json({post: serializePost(post), user: serializeUser(user)});
});

app.post("/api/votes/:idolId", async (req, res) => {
if(!idolIds.includes(req.params.idolId)){
return res.status(400).json({message: "Invalid idol."});
}

const vote = await Vote.findOneAndUpdate(
{idolId: req.params.idolId},
{$inc: {count: 1}},
{new: true, upsert: true}
);
const user = req.body.userId ? await User.findById(req.body.userId) : null;

if(user){
user.points += 25;
pushNotification(user, "Fan Voter badge progress added.");
await user.save();
}

res.json({vote, votes: await getVotes(), user: user ? serializeUser(user) : null});
});

app.post("/api/tickets/book", async (req, res) => {
const user = await User.findById(req.body.userId);
const ticketIds = Array.isArray(req.body.ticketIds) ? req.body.ticketIds : [];

if(!user || ticketIds.length === 0){
return res.status(400).json({message: "User and tickets are required."});
}

ticketIds.forEach(ticketId => {
if(!user.bookedTickets.includes(ticketId)){
user.bookedTickets.push(ticketId);
}
});
user.points += 40;
pushNotification(user, "Your concert ticket booking is confirmed.");
await user.save();

res.json({user: serializeUser(user)});
});

app.post("/api/tickets/cart", async (req, res) => {
const user = await User.findById(req.body.userId);
const ticketIds = Array.isArray(req.body.ticketIds) ? req.body.ticketIds : [];

if(!user || ticketIds.length === 0){
return res.status(400).json({message: "User and tickets are required."});
}

ticketIds.forEach(ticketId => {
if(!user.ticketCart.includes(ticketId) && !user.bookedTickets.includes(ticketId)){
user.ticketCart.push(ticketId);
}
});
pushNotification(user, "Tickets added to cart.");
await user.save();

res.json({user: serializeUser(user)});
});

app.post("/api/cart/toggle", async (req, res) => {
const user = await User.findById(req.body.userId);
const itemId = req.body.itemId;

if(!user || !itemId){
return res.status(400).json({message: "User and item are required."});
}

if(user.cart.includes(itemId)){
user.cart = user.cart.filter(id => id !== itemId);
pushNotification(user, "Item removed from cart.");
}else{
user.cart.push(itemId);
user.points += 20;
pushNotification(user, "Item added to cart.");
}
await user.save();

res.json({user: serializeUser(user)});
});

app.post("/api/live/join", async (req, res) => {
const user = await User.findById(req.body.userId);
if(!user){
return res.status(404).json({message: "User not found."});
}

user.joinedLive = true;
user.points += 30;
pushNotification(user, "You joined the live stream watch party.");
await user.save();

res.json({user: serializeUser(user)});
});

app.post("/api/checkout", async (req, res) => {
const user = await User.findById(req.body.userId);
const paymentMethod = req.body.paymentMethod || "card";
const address = req.body.address || {};

if(!user){
return res.status(404).json({message: "User not found."});
}

if(!address.fullName || !address.phone || !address.line1 || !address.city || !address.state || !address.postalCode){
return res.status(400).json({message: "Complete delivery address is required."});
}

user.ticketCart.forEach(ticketId => {
if(!user.bookedTickets.includes(ticketId)){
user.bookedTickets.push(ticketId);
}
});
user.ticketCart = [];
user.cart = [];
user.address = address;
user.points += 50;
pushNotification(user, `Order placed with ${paymentMethod}.`);
await user.save();

res.json({user: serializeUser(user)});
});

app.get("*", (req, res) => {
res.sendFile(path.join(__dirname, "Main.html"));
});

io.on("connection", async socket => {
socket.emit("chat message", {
user: "K-Star Bot",
message: "You are connected to the live Socket.io chat."
});

socket.on("chat message", async data => {
const payload = {
user: data.user || "Guest Fan",
message: data.message || "",
community: data.community || "general"
};

if(!payload.message.trim()){
return;
}

await ChatMessage.create(payload);
io.emit("chat message", payload);
});
});

async function connectDatabase(){
await mongoose.connect(MONGODB_URI, {serverSelectionTimeoutMS: 5000});
await seedDatabase();
console.log("MongoDB connected");
}

async function seedDatabase(){
const voteCount = await Vote.countDocuments();
if(voteCount === 0){
await Vote.insertMany(Object.entries(defaultVotes).map(([idolId, count]) => ({idolId, count})));
}

const postCount = await Post.countDocuments();
if(postCount === 0){
await Post.create({
communityId: "bts-v",
author: "K-Star Team",
text: "Welcome to the BTS V Crew community. Share fan art, stream goals, and concert memories here.",
likes: 12,
comments: [{author: "Fan", text: "So excited for the next live!"}]
});
}
}

async function getVotes(){
const votes = {...defaultVotes};
const docs = await Vote.find();
docs.forEach(doc => {
votes[doc.idolId] = doc.count;
});
return votes;
}

function pushNotification(user, message){
user.notifications.unshift({message});
user.notifications = user.notifications.slice(0, 12);
}

function serializeUser(user){
return {
id: user._id.toString(),
name: user.name,
email: user.email,
favoriteGroup: user.favoriteGroup,
country: user.country,
address: user.address,
selectedCommunity: user.selectedCommunity,
points: user.points,
cart: user.cart,
ticketCart: user.ticketCart,
bookedTickets: user.bookedTickets,
joinedLive: user.joinedLive,
notifications: user.notifications.map(item => ({
message: item.message,
time: item.time
}))
};
}

function serializePost(post){
return {
id: post._id.toString(),
communityId: post.communityId,
author: post.author,
text: post.text,
likes: post.likes,
comments: post.comments.map(comment => `${comment.author}: ${comment.text}`),
createdAt: post.createdAt.toLocaleDateString()
};
}

server.on("error", error => {
if(error.code === "EADDRINUSE"){
console.error(`Port ${PORT} is already in use.`);
console.error("Close the existing server terminal, stop the old Node process, or change PORT in .env.");
process.exit(1);
}

throw error;
});

server.listen(PORT, () => {
console.log(`K-Star Connect server running at http://localhost:${PORT}`);
});

connectDatabase().catch(error => {
console.error("MongoDB connection failed:", error.message);
console.error("Start MongoDB locally or update MONGODB_URI in .env, then restart the server.");
});
