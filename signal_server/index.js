const http = require("http");
const { Server } = require("socket.io");
const server = http.createServer();
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

io.on("connection", (socket) => {
	console.log(`connected: ${socket.id}`);

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
	})

	socket.on("offer", (offer) => {
		if (broadcasterId != null && broadcasterId !== socket.id) {
			socket.emit('error', { message: 'Already have a broadcaster' });
		} else {
			broadcasterId = socket.id;
			currentOffer = offer;
			console.log(`broadcaster id is: ${broadcasterId}`);
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
		console.log(`disconnected: ${socket.id}`);
		if (socket.id === broadcasterId) {
			console.log('Broadcaster disconnected');
			broadcasterId = null;
			currentOffer = null;
			socket.broadcast.emit('broadcast-ended');
		}
	});
});

server.listen(3000, "0.0.0.0", () => {
	console.log("Socket.IO listening on 0.0.0.0:3000");
});
