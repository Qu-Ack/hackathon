import "./App.css"
import { useRef, useEffect, useState } from 'react';
import { socket } from "./socket";

const rtcConfig: RTCConfiguration = {
	iceServers: [
		{ urls: "stun:stun.l.google.com:19302" }
	]
};

interface Annotation {
	x: number;
	y: number;
	width: number;
	height: number;
	timestamp: number;
	frameData?: string;
}




async function getMediaStream() {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({
			video: {
				facingMode: 'environment'
			}
		})
		return stream;
	} catch (err) {
		console.log(err);
	}
}

let broadcasterConn: RTCPeerConnection | null = null;
let watcherConn: RTCPeerConnection | null = null;

function iceCandidateHandler(event: RTCPeerConnectionIceEvent) {
	if (event.candidate) {
		socket.emit("ice", {
			role: "broadcaster",
			candidate: event.candidate,
		});
	}
}

async function onIce({ role, candidate }: { role: string; candidate: RTCIceCandidateInit }) {
	try {
		if (role === "broadcaster" && watcherConn) {
			await watcherConn.addIceCandidate(candidate);
		}

		if (role === "watcher" && broadcasterConn) {
			await broadcasterConn.addIceCandidate(candidate);
		}
	} catch (err) {
		console.error("ICE error:", err);
	}
}

async function onOffer(offer: RTCSessionDescriptionInit) {
	console.log('Received offer:', offer);

	watcherConn = new RTCPeerConnection(rtcConfig);

	watcherConn.onicecandidate = e => {
		if (e.candidate) {
			socket.emit("ice", {
				role: "watcher",
				candidate: e.candidate,
			});
		}
	};

	watcherConn.ontrack = event => {
		const video = document.getElementById("dashboard_camera_feed") as HTMLVideoElement;
		if (video) {
			video.srcObject = event.streams[0];
		} else {
			console.error('Video element not found!');
		}
	};

	await watcherConn.setRemoteDescription(offer);
	const answer = await watcherConn.createAnswer();
	await watcherConn.setLocalDescription(answer);
	socket.emit("answer", answer);
}

async function onAnswer(answer: RTCSessionDescriptionInit) {
	if (broadcasterConn) {
		await broadcasterConn.setRemoteDescription(answer);
	}
}

export default function App() {
	const localVideo = useRef<HTMLVideoElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const [isBroadcasting, setIsBroadcasting] = useState(false);
	const [isWatching, setIsWatching] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
	const [isDrawing, setIsDrawing] = useState(false);
	const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
	const [annotations, setAnnotations] = useState<Annotation[]>([]);
	const localStreamRef = useRef<MediaStream | null>(null);

	async function sendAnnotation() {
		try {
			console.log("annotations sent");
			setAnnotations([]);
			const resp = await fetch("someurl", {
				method: "POST",
				body: JSON.stringify(annotations),
			})

			if (!resp.ok) {
				console.log("something happend");
				console.log(resp);
				return;
			}

		} catch (err) {
			console.log(err);
		}
	}
	function onConnect() {
		console.log("connected");
	}

	function captureFrame(): string | undefined {
		if (!localVideo.current || !canvasRef.current) return;

		const video = localVideo.current;
		const canvas = canvasRef.current;
		const ctx = canvas.getContext('2d');

		if (!ctx) return;

		const tempCanvas = document.createElement('canvas');
		tempCanvas.width = video.videoWidth;
		tempCanvas.height = video.videoHeight;
		const tempCtx = tempCanvas.getContext('2d');

		if (!tempCtx) return;

		tempCtx.drawImage(video, 0, 0);
		return tempCanvas.toDataURL('image/jpeg', 0.8);
	}

	function onPause() {
		if (localVideo.current) {
			localVideo.current.pause();
			setIsPaused(true);
		}
	}

	function onResume() {
		if (localVideo.current) {
			localVideo.current.play();
			setIsPaused(false);
			if (canvasRef.current) {
				const ctx = canvasRef.current.getContext('2d');
				if (ctx) {
					ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
				}
			}
		}
	}

	function getCanvasCoordinates(e: React.MouseEvent<HTMLCanvasElement>) {
		if (!canvasRef.current || !localVideo.current) return { x: 0, y: 0 };

		const canvas = canvasRef.current;
		const video = localVideo.current;
		const rect = canvas.getBoundingClientRect();

		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		const scaleX = video.videoWidth / rect.width;
		const scaleY = video.videoHeight / rect.height;

		return {
			x: x * scaleX,
			y: y * scaleY
		};
	}

	function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
		if (!isPaused) return;

		const pos = getCanvasCoordinates(e);
		setStartPos(pos);
		setIsDrawing(true);
	}

	function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
		if (!isPaused || !isDrawing || !startPos || !canvasRef.current || !localVideo.current) return;

		const canvas = canvasRef.current;
		const video = localVideo.current;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const currentPos = getCanvasCoordinates(e);

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		const rect = canvas.getBoundingClientRect();
		const scaleX = rect.width / video.videoWidth;
		const scaleY = rect.height / video.videoHeight;

		annotations.forEach(ann => {
			ctx.strokeStyle = 'lime';
			ctx.lineWidth = 2;
			ctx.strokeRect(
				ann.x * scaleX,
				ann.y * scaleY,
				ann.width * scaleX,
				ann.height * scaleY
			);
		});

		ctx.strokeStyle = 'red';
		ctx.lineWidth = 2;
		const width = currentPos.x - startPos.x;
		const height = currentPos.y - startPos.y;
		ctx.strokeRect(
			startPos.x * scaleX,
			startPos.y * scaleY,
			width * scaleX,
			height * scaleY
		);
	}

	function handleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
		if (!isPaused || !isDrawing || !startPos || !canvasRef.current || !localVideo.current) return;

		const canvas = canvasRef.current;
		const video = localVideo.current;
		const currentPos = getCanvasCoordinates(e);
		const width = currentPos.x - startPos.x;
		const height = currentPos.y - startPos.y;

		// Only save if rectangle has meaningful size
		if (Math.abs(width) > 5 && Math.abs(height) > 5) {
			const frameData = captureFrame();
			const annotation: Annotation = {
				x: Math.min(startPos.x, currentPos.x),
				y: Math.min(startPos.y, currentPos.y),
				width: Math.abs(width),
				height: Math.abs(height),
				timestamp: localVideo.current?.currentTime || 0,
				frameData
			};

			setAnnotations(prev => [...prev, annotation]);
			console.log('Annotation saved:', annotation);
		}

		setIsDrawing(false);
		setStartPos(null);

		const ctx = canvas.getContext('2d');
		if (ctx) {
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			const rect = canvas.getBoundingClientRect();
			const scaleX = rect.width / video.videoWidth;
			const scaleY = rect.height / video.videoHeight;

			annotations.forEach(ann => {
				ctx.strokeStyle = 'lime';
				ctx.lineWidth = 2;
				ctx.strokeRect(
					ann.x * scaleX,
					ann.y * scaleY,
					ann.width * scaleX,
					ann.height * scaleY
				);
			});

			if (Math.abs(width) > 5 && Math.abs(height) > 5) {
				ctx.strokeStyle = 'lime';
				ctx.lineWidth = 2;
				ctx.strokeRect(
					Math.min(startPos.x, currentPos.x) * scaleX,
					Math.min(startPos.y, currentPos.y) * scaleY,
					Math.abs(width) * scaleX,
					Math.abs(height) * scaleY
				);
			}
		}
	}

	function clearAnnotations() {
		setAnnotations([]);
		if (canvasRef.current) {
			const ctx = canvasRef.current.getContext('2d');
			if (ctx) {
				ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
			}
		}
	}

	async function startBroadcast() {
		try {
			const stream = await getMediaStream();
			if (!stream) {
				throw Error("couldn't obtain user stream");
			}

			localStreamRef.current = stream;
			if (localVideo.current) {
				localVideo.current.srcObject = stream;
			}

			broadcasterConn = new RTCPeerConnection(rtcConfig);
			const videoTracks = stream.getVideoTracks();
			videoTracks.forEach(track => {
				broadcasterConn!.addTrack(track, stream);
			});

			broadcasterConn.onicecandidate = iceCandidateHandler;
			const offer = await broadcasterConn.createOffer();
			await broadcasterConn.setLocalDescription(offer);
			socket.emit("offer", offer);
			setIsBroadcasting(true);
		} catch (err) {
			console.error('Error starting broadcast:', err);
		}
	}

	function stopBroadcast() {
		if (localStreamRef.current) {
			localStreamRef.current.getTracks().forEach(track => track.stop());
			localStreamRef.current = null;
		}

		if (localVideo.current) {
			localVideo.current.srcObject = null;
		}
		if (broadcasterConn) {
			broadcasterConn.close();
			broadcasterConn = null;
			socket.emit("broadcast_close");
		}
		setIsBroadcasting(false);
	}

	function watchBroadcast() {
		socket.emit("watch");
		setIsWatching(true);
	}

	function stopWatching() {
		if (localVideo.current) {
			localVideo.current.srcObject = null;
		}

		if (watcherConn) {
			watcherConn.close();
			watcherConn = null;
		}

		setIsWatching(false);
	}

	function onBroadCastClose() {
		if (localVideo.current) {
			localVideo.current.srcObject = null;
		}
	}

	useEffect(() => {
		socket.on('connect', onConnect);
		socket.on('ice', onIce);
		socket.on('answer', onAnswer);
		socket.on('offer', onOffer);
		socket.on('broadcast_close', onBroadCastClose);

		return () => {
			socket.off("connect", onConnect);
			socket.off('ice', onIce);
			socket.off('offer', onOffer);
			socket.off('answer', onAnswer);
			socket.off('broadcast_close', onBroadCastClose);

			if (localStreamRef.current) {
				localStreamRef.current.getTracks().forEach(track => track.stop());
			}
			if (broadcasterConn) {
				broadcasterConn.close();
			}
			if (watcherConn) {
				watcherConn.close();
			}
		}
	}, []);

	useEffect(() => {
		const video = localVideo.current;
		const canvas = canvasRef.current;

		if (!video || !canvas) return;

		const updateCanvasSize = () => {
			const rect = video.getBoundingClientRect();
			canvas.width = rect.width;
			canvas.height = rect.height;
			canvas.style.width = `${rect.width}px`;
			canvas.style.height = `${rect.height}px`;
		};

		video.addEventListener('loadedmetadata', updateCanvasSize);
		video.addEventListener('resize', updateCanvasSize);
		video.addEventListener('play', updateCanvasSize);

		updateCanvasSize();

		window.addEventListener('resize', updateCanvasSize);

		return () => {
			video.removeEventListener('loadedmetadata', updateCanvasSize);
			video.removeEventListener('resize', updateCanvasSize);
			video.removeEventListener('play', updateCanvasSize);
			window.removeEventListener('resize', updateCanvasSize);
		};
	}, []);

	return (
		<div id="app">
			<h1 id="dashboard_heading"> Dashboard </h1>
			<div id="dashboard_video_feed_container">
				<div id="dashboard_camera_feed_container">
					<div style={{ position: 'relative', display: 'inline-block' }}>
						<video
							ref={localVideo}
							id="dashboard_camera_feed"
							autoPlay
							muted
							style={{ display: 'block' }}
						/>
						<canvas
							ref={canvasRef}
							onMouseDown={handleMouseDown}
							onMouseMove={handleMouseMove}
							onMouseUp={handleMouseUp}
							style={{
								position: 'absolute',
								top: 0,
								left: 0,
								cursor: isPaused ? 'crosshair' : 'default',
								pointerEvents: isPaused ? 'auto' : 'none'
							}}
						/>
					</div>
					<div id="dashboard_camera_controls">
						<button id="dashboard_camera_control_btn"
							onClick={startBroadcast}
							disabled={isBroadcasting}
						>
							Start Broadcasting
						</button>
						<button id="dashboard_camera_control_btn"
							onClick={stopBroadcast}
							disabled={!isBroadcasting}
						>
							Stop Broadcast
						</button>
						<button id="dashboard_camera_control_btn"
							onClick={watchBroadcast}
							disabled={isWatching || isBroadcasting}
						>
							Watch Broadcast
						</button>
						<button id="dashboard_camera_control_btn"
							onClick={stopWatching}
							disabled={!isWatching}
						>
							Stop Watching
						</button>
						<button
							id="dashboard_camera_control_btn"
							onClick={onPause}
						>
							Pause
						</button>
						<button id="dashboard_camera_control_btn"
							onClick={onResume}
						>
							Resume
						</button>
						<button
							id="dashboard_camera_control_btn"
							onClick={clearAnnotations}
							disabled={!isPaused}
						>
							Clear Boxes
						</button>
						<button
							id="dashboard_camera_control_btn"
							onClick={sendAnnotation}
							disabled={annotations.length === 0}
						>
							Send Annotations ({annotations.length})
						</button>
					</div>
					{annotations.length > 0 && (
						<div style={{ marginTop: '10px', maxHeight: '200px', overflow: 'auto' }}>
							<h3>Annotations ({annotations.length})</h3>
							{annotations.map((ann, idx) => (
								<div key={idx} style={{
									marginBottom: '8px',
									padding: '8px',
									background: '#000010',
									borderRadius: '4px',
									fontSize: '12px'
								}}>
									<strong>Box {idx + 1}:</strong><br />
									X: {Math.round(ann.x)}px, Y: {Math.round(ann.y)}px<br />
									Width: {Math.round(ann.width)}px, Height: {Math.round(ann.height)}px<br />
									Timestamp: {ann.timestamp.toFixed(2)}s
								</div>
							))}
						</div>
					)}
				</div>
				<div id="dashboard_chat_box"></div>
			</div>
		</div>
	)
}
