const http = require("http");
const { Server } = require("socket.io");
const express = require("express");

const app = express();

app.use((req, res, next) => {
	const allowedOrigins = [
		"http://localhost:3001",
		"http://localhost:5173",
		"http://127.0.0.1:3001",
		"http://127.0.0.1:5173",
		"http://192.168.1.2:3001",
		"http://192.168.1.2:5173",
		"http://20.193.158.43:3001",
		"http://20.193.158.43:5173",
		"http://20.193.158.43:80",
		"http://20.193.158.43:8080"
	];

	const origin = req.headers.origin;
	if (allowedOrigins.includes(origin) || !origin) {
		res.setHeader('Access-Control-Allow-Origin', origin || '*');
	}

	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
	res.setHeader('Access-Control-Allow-Credentials', 'true');

	// Handle preflight
	if (req.method === 'OPTIONS') {
		return res.sendStatus(200);
	}

	next();
});

app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: [
			// Localhost
			"http://localhost:3001",
			"http://localhost:5173",
			"http://127.0.0.1:3001",
			"http://127.0.0.1:5173",
			// Local network
			"http://192.168.1.2:3001",
			"http://192.168.1.2:5173",
			"http://192.168.1.3:3001",
			"http://192.168.1.3:5173",
			"http://192.168.1.4:3001",
			"http://192.168.1.4:5173",
			"http://192.168.1.5:3001",
			"http://192.168.1.5:5173",
			"http://192.168.1.6:3001",
			"http://192.168.1.6:5173",
			"http://192.168.1.7:3001",
			"http://192.168.1.7:5173",
			"http://192.168.1.8:3001",
			"http://192.168.1.8:5173",
			"http://192.168.1.9:3001",
			"http://192.168.1.9:5173",
			"http://192.168.1.10:3001",
			"http://192.168.1.10:5173",
			// Azure public IP
			"http://20.193.158.43:3001",
			"http://20.193.158.43:5173",
			"http://20.193.158.43:80",
			"http://20.193.158.43:8080",
		],
		methods: ["GET", "POST", "OPTIONS"],
		credentials: true,
		allowedHeaders: ["Content-Type", "Authorization"]
	},
});

let broadcasterId = null;
let broadcasterSocket = null;
let watchers = new Set();


const getFrame = () => {
	return new Promise((resolve, reject) => {
		if (!broadcasterSocket) {
			return reject(new Error("No broadcaster socket"));
		}

		broadcasterSocket.emit("module_x_callback");

		broadcasterSocket.once("frame-response", (frame) => {
			resolve(frame);
		});

		setTimeout(() => {
			reject(new Error("Frame response timeout"));
		}, 5000);
	});
};

// Webhook endpoint for Module X to trigger frame capture
app.post('/module_x_callback', async (req, res) => {
	console.log('Received callback from Module X:', req.body);

	if (!broadcasterSocket) {
		return res.status(404).json({
			success: false,
			message: 'No active broadcaster'
		});
	}

	try {
		const frame = await getFrame();
		console.log("Received frame from broadcaster");

		res.json({
			data: frame.imageBase64,
			isannotated: false,
			xyxy: [],
			timestamp: 0,
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({
			success: false,
			error: err.message
		});
	}
});

// Webhook endpoint for Module X to send instructions
app.post('/module_x_instruction', (req, res) => {
	console.log('Received instruction from Module X:', req.body);

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
		broadcaster: broadcasterId ? 'connected' : 'disconnected',
		watcherCount: watchers.size,
		broadcasterId: broadcasterId
	});
});

// Root endpoint
app.get('/', (req, res) => {
	res.json({
		name: 'WebRTC Signaling Server',
		version: '1.0.0',
		endpoints: {
			health: '/health',
			moduleXCallback: '/module_x_callback',
			moduleXInstruction: '/module_x_instruction'
		}
	});
});

io.on("connection", (socket) => {
	console.log("Connected:", socket.id);

	// Handle broadcaster registration
	socket.on("start-broadcast", () => {
		if (broadcasterSocket && broadcasterSocket.id !== socket.id) {
			broadcasterSocket.emit("broadcast-ended");
		}

		broadcasterId = socket.id;
		broadcasterSocket = socket;

		socket.emit("broadcast-started", { id: socket.id });
	});



	// Handle watcher joining
	socket.on("watch", () => {
		if (!broadcasterId) {
			socket.emit("error", { message: "No active broadcaster" });
			console.log("Watch request denied - no broadcaster");
			return;
		}

		if (broadcasterId === socket.id) {
			socket.emit("error", { message: "Cannot watch your own broadcast" });
			console.log("Watch request denied - self watch");
			return;
		}

		watchers.add(socket.id);
		io.to(broadcasterId).emit("watcher-joined", socket.id);
		console.log("Watcher joined:", socket.id, "| Total watchers:", watchers.size);
	});

	// Handle WebRTC offer
	socket.on("offer", ({ to, offer }) => {
		console.log("Offer from", socket.id, "to", to);
		io.to(to).emit("offer", {
			from: socket.id,
			offer,
		});
	});

	// Handle WebRTC answer
	socket.on("answer", ({ to, answer }) => {
		console.log("Answer from", socket.id, "to", to);
		io.to(to).emit("answer", {
			from: socket.id,
			answer,
		});
	});

	// Handle ICE candidates
	socket.on("ice", ({ to, candidate }) => {
		console.log("ICE candidate from", socket.id, "to", to);
		io.to(to).emit("ice", {
			from: socket.id,
			candidate,
		});
	});

	// Handle stop watching
	socket.on("stop-watching", () => {
		if (watchers.has(socket.id)) {
			watchers.delete(socket.id);
			if (broadcasterId) {
				io.to(broadcasterId).emit("watcher-left", socket.id);
			}
			console.log("Watcher stopped:", socket.id, "| Remaining watchers:", watchers.size);
		}
	});

	// Handle broadcast ended
	socket.on("broadcast-ended", () => {
		if (socket.id === broadcasterId) {
			broadcasterId = null;
			broadcasterSocket = null;
			watchers.clear();
		}
	});

	// Handle disconnect
	socket.on("disconnect", () => {
		console.log("Disconnected:", socket.id);

		// If broadcaster disconnects
		if (socket.id === broadcasterId) {
			console.log("Broadcaster disconnected, ending broadcast");
			socket.broadcast.emit("broadcast-ended");
			watchers.clear();
			broadcasterId = null;
		}

		// If watcher disconnects
		if (watchers.has(socket.id)) {
			watchers.delete(socket.id);
			if (broadcasterId) {
				io.to(broadcasterId).emit("watcher-left", socket.id);
			}
			console.log("Watcher disconnected:", socket.id, "| Remaining watchers:", watchers.size);
		}
	});

	// Handle errors
	socket.on("error", (error) => {
		console.error("Socket error for", socket.id, ":", error);
	});
});

// Handle server errors
server.on('error', (error) => {
	console.error('Server error:', error);
});

io.on('error', (error) => {
	console.error('Socket.IO error:', error);
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

server.listen(PORT, HOST, () => {
	console.log(`Socket.IO and HTTP server listening on ${HOST}:${PORT}`);
	console.log(`Local access: http://localhost:${PORT}`);
	console.log(`Network access: http://192.168.1.2:${PORT}`);
	console.log(`Health check: http://192.168.1.2:${PORT}/health`);
});
