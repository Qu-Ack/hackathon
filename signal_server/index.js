const http = require("http");
const { Server } = require("socket.io");
const express = require("express");

const app = express();
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: [
			"http://localhost:5173",
			"http://192.168.1.2:5173",
		],
		methods: ["GET", "POST"],
	},
});

let broadcasterId = null;
let currentOffer = null;

app.post('/module_x_callback', (req, res) => {
	console.log('Received callback from Module X:', req.body);
	
	// Emit to the broadcaster to start recording
	if (broadcasterId) {
		io.to(broadcasterId).emit('module_x_callback', {
			message: 'Start recording',
			data: req.body
		});
		res.json({ success: true, message: 'Recording triggered' });
	} else {
		res.status(404).json({ success: false, message: 'No active broadcaster' });
	}
});

// Webhook endpoint for Module X to send instructions
app.post('/module_x_instruction', (req, res) => {
	console.log('Received instruction from Module X:', req.body);
	
	// Emit to the broadcaster with the instruction
	if (broadcasterId) {
		io.to(broadcasterId).emit('module_x_instruction', {
			instruction: req.body.instruction || req.body.text,
			data: req.body
		});
		res.json({ success: true, message: 'Instruction sent' });
	} else {
		res.status(404).json({ success: false, message: 'No active broadcaster' });
	}
});

// Health check endpoint
app.get('/health', (req, res) => {
	res.json({ 
		status: 'ok', 
		broadcaster: broadcasterId ? 'connected' : 'disconnected' 
	});
});

io.on("connection", (socket) => {
	console.log(`Connected: ${socket.id}`);
	
	socket.on("ice", (data) => {
		if (socket.id === broadcasterId) {
			socket.broadcast.emit("ice", data);
		} else {
			if (broadcasterId) {
				io.to(broadcasterId).emit("ice", data);
			}
		}
	});
	
	socket.on("broadcast_close", () => {
		broadcasterId = null;
		currentOffer = null;
		socket.broadcast.emit("broadcast_close");
	});
	
	socket.on("offer", (offer) => {
		if (broadcasterId != null && broadcasterId !== socket.id) {
			socket.emit('error', { message: 'Already have a broadcaster' });
		} else {
			broadcasterId = socket.id;
			currentOffer = offer;
			console.log(`Broadcaster id is: ${broadcasterId}`);
		}
	});
	
	socket.on("watch", () => {
		console.log(`${socket.id} wants to watch`);
		if (currentOffer && broadcasterId) {
			socket.emit("offer", currentOffer);
		} else {
			socket.emit('error', { message: 'No active broadcast' });
		}
	});
	
	socket.on("answer", (answer) => {
		if (broadcasterId) {
			io.to(broadcasterId).emit('answer', answer);
		}
	});
	
	socket.on("disconnect", () => {
		console.log(`Disconnected: ${socket.id}`);
		if (socket.id === broadcasterId) {
			console.log('Broadcaster disconnected');
			broadcasterId = null;
			currentOffer = null;
			socket.broadcast.emit('broadcast-ended');
		}
	});
});

server.listen(3000, "0.0.0.0", () => {
	console.log("Socket.IO and HTTP server listening on 0.0.0.0:3000");
});
