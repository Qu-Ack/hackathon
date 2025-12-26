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

interface Direction {
	id: number;
	text: string;
	timestamp: Date;
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
	const chatBoxRef = useRef<HTMLDivElement | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const [isBroadcasting, setIsBroadcasting] = useState(false);
	const [isWatching, setIsWatching] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
	const [isDrawing, setIsDrawing] = useState(false);
	const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
	const [annotations, setAnnotations] = useState<Annotation[]>([]);
	const [directions, setDirections] = useState<Direction[]>([]);
	const [isDirectionsActive, setIsDirectionsActive] = useState(false);
	const [isListening, setIsListening] = useState(false);
	const localStreamRef = useRef<MediaStream | null>(null);
	const directionTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);

	const ELEVEN_LABS_API_KEY = 'sk_1ec99cd9a2ce501decaf27f53c2fb1a0c7edfe3bb9beefa8';
	const VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';

	const sampleDirections = [
		"Turn left at the next intersection",
		"Continue straight for 500 meters",
		"Turn right onto Main Street",
		"Your destination is on the left",
		"Proceed through the roundabout, taking the second exit",
		"Make a U-turn when possible"
	];

	async function textToSpeech(text: string): Promise<void> {
		try {
			const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
				method: 'POST',
				headers: {
					'Accept': 'audio/mpeg',
					'Content-Type': 'application/json',
					'xi-api-key': ELEVEN_LABS_API_KEY
				},
				body: JSON.stringify({
					text: text,
					model_id: 'eleven_multilingual_v2',
					voice_settings: {
						stability: 0.5,
						similarity_boost: 0.5
					}
				})
			});

			if (!response.ok) {
				throw new Error(`ElevenLabs API error: ${response.status}`);
			}

			const audioBlob = await response.blob();
			const audioUrl = URL.createObjectURL(audioBlob);

			if (audioRef.current) {
				audioRef.current.src = audioUrl;
				audioRef.current.play().catch(err => console.error('Audio playback error:', err));
			}
		} catch (err) {
			console.error('Text-to-speech error:', err);
		}
	}

	function startDirections() {
		setIsDirectionsActive(true);
		setDirections([]);

		// Clear any existing timeouts
		directionTimeouts.current.forEach(timeout => clearTimeout(timeout));
		directionTimeouts.current = [];

		// Schedule directions at intervals
		sampleDirections.forEach((directionText, index) => {
			const timeout = setTimeout(() => {
				const newDirection: Direction = {
					id: Date.now() + index,
					text: directionText,
					timestamp: new Date()
				};

				setDirections(prev => [...prev, newDirection]);
				textToSpeech(directionText);

				// Auto-scroll chat box to bottom
				setTimeout(() => {
					if (chatBoxRef.current) {
						chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
					}
				}, 100);
			}, index * 8000); // 8 seconds between each direction

			directionTimeouts.current.push(timeout);
		});
	}

	function stopDirections() {
		setIsDirectionsActive(false);
		directionTimeouts.current.forEach(timeout => clearTimeout(timeout));
		directionTimeouts.current = [];

		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current.currentTime = 0;
		}
	}

	function clearDirections() {
		setDirections([]);
		stopDirections();
	}

	async function sendAcknowledgment(goalId: string) {
		try {
			const response = await fetch("https://your-api-endpoint.com/ack", {
				method: "POST",
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					goal_id: goalId,
					ack: "acknowledged"
				}),
			});

			if (!response.ok) {
				console.error("Failed to send acknowledgment:", response);
				return;
			}

			console.log("Acknowledgment sent successfully");
		} catch (err) {
			console.error("Error sending acknowledgment:", err);
		}
	}

	async function speechToText(audioBlob: Blob): Promise<string | null> {
		try {
			const formData = new FormData();
			formData.append("file", audioBlob, "audio.webm");
			formData.append("model_id", "scribe_v1"); // ✅ REQUIRED

			const response = await fetch(
				"https://api.elevenlabs.io/v1/speech-to-text",
				{
					method: "POST",
					headers: {
						"xi-api-key": ELEVEN_LABS_API_KEY,
					},
					body: formData,
				}
			);

			if (!response.ok) {
				const errText = await response.text();
				throw new Error(
					`ElevenLabs STT error ${response.status}: ${errText}`
				);
			}

			const data = await response.json();
			return data.text ?? null;
		} catch (err) {
			console.error("Speech-to-text error:", err);
			return null;
		}
	}

	async function startVoiceRecognition() {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

			const mediaRecorder = new MediaRecorder(stream);
			mediaRecorderRef.current = mediaRecorder;
			audioChunksRef.current = [];

			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					audioChunksRef.current.push(event.data);
				}
			};

			mediaRecorder.onstop = async () => {
				const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
				audioChunksRef.current = [];

				console.log('Processing audio...');
				const transcription = await speechToText(audioBlob);

				if (transcription) {
					console.log('Transcription:', transcription);
					const lowerTranscript = transcription.toLowerCase().trim();

					if (lowerTranscript.includes('yes')) {
						console.log("'Yes' detected! Sending acknowledgment...");
						await sendAcknowledgment("goal_123"); 
					}
				}

				stream.getTracks().forEach(track => track.stop());
				setIsListening(false);
			};

			mediaRecorder.start();
			setIsListening(true);
			console.log('Voice recognition started - speak now...');

			// Auto-stop after 5 seconds
			setTimeout(() => {
				if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
					mediaRecorderRef.current.stop();
				}
			}, 5000);

		} catch (err) {
			console.error('Microphone access error:', err);
			alert('Could not access microphone. Please grant permission.');
			setIsListening(false);
		}
	}

	function stopVoiceRecognition() {
		if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
			mediaRecorderRef.current.stop();
		}
		setIsListening(false);
	}

	async function sendAnnotation() {
		try {
			console.log("annotations sent");
			const resp = await fetch("someurl", {
				method: "POST",
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(annotations),
			})

			if (!resp.ok) {
				console.log("something happened");
				console.log(resp);
				return;
			}

			setAnnotations([]);
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

			// Clean up timeouts
			directionTimeouts.current.forEach(timeout => clearTimeout(timeout));

			// Clean up media recorder
			if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
				mediaRecorderRef.current.stop();
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
			<audio ref={audioRef} style={{ display: 'none' }} />
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
						<button
							id="dashboard_camera_control_btn"
							onClick={isListening ? stopVoiceRecognition : startVoiceRecognition}
							style={{
								background: isListening ? '#ff4444' : '#4CAF50',
								animation: isListening ? 'pulse 1.5s infinite' : 'none'
							}}
						>
							{isListening ? '🎤 Listening...' : '🎤 Voice Command'}
						</button>
					</div>
					{annotations.length > 0 && (
						<div style={{ marginTop: '10px', maxHeight: '200px', overflow: 'auto' }}>
							<h3>Annotations ({annotations.length})</h3>
							{annotations.map((ann, idx) => (
								<div key={idx} style={{
									marginBottom: '8px',
									padding: '8px',
									background: '#333',
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
				<div id="dashboard_chat_box" ref={chatBoxRef}>
					<div style={{
						padding: '20px',
						display: 'flex',
						flexDirection: 'column',
						height: '100%'
					}}>
						<div style={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							marginBottom: '20px',
							borderBottom: '2px solid #444',
							paddingBottom: '10px'
						}}>
							<h2 style={{ margin: 0, fontSize: '1.5em' }}>Voice Directions</h2>
							<div style={{ display: 'flex', gap: '10px' }}>
								<button
									id="dashboard_camera_control_btn"
									onClick={startDirections}
									disabled={isDirectionsActive}
									style={{ fontSize: '0.9em' }}
								>
									Start Directions
								</button>
								<button
									id="dashboard_camera_control_btn"
									onClick={stopDirections}
									disabled={!isDirectionsActive}
									style={{ fontSize: '0.9em' }}
								>
									Stop
								</button>
								<button
									id="dashboard_camera_control_btn"
									onClick={clearDirections}
									style={{ fontSize: '0.9em' }}
								>
									Clear
								</button>
							</div>
						</div>
						<div style={{
							flex: 1,
							overflowY: 'auto',
							display: 'flex',
							flexDirection: 'column',
							gap: '12px'
						}}>
							{directions.length === 0 ? (
								<div style={{
									textAlign: 'center',
									color: '#666',
									marginTop: '50px',
									fontSize: '1.1em'
								}}>
									Click "Start Directions" to begin navigation
								</div>
							) : (
								directions.map((direction) => (
									<div
										key={direction.id}
										style={{
											background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
											padding: '16px 20px',
											borderRadius: '12px',
											boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
											animation: 'slideIn 0.3s ease-out',
											border: '1px solid rgba(255, 255, 255, 0.1)'
										}}
									>
										<div style={{
											fontSize: '1.1em',
											fontWeight: '500',
											marginBottom: '8px',
											lineHeight: '1.4'
										}}>
											📍 {direction.text}
										</div>
										<div style={{
											fontSize: '0.85em',
											opacity: 0.8,
											fontStyle: 'italic'
										}}>
											{direction.timestamp.toLocaleTimeString()}
										</div>
									</div>
								))
							)}
						</div>
					</div>
				</div>
			</div>
			<style>{`
				@keyframes slideIn {
					from {
						opacity: 0;
						transform: translateY(-20px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}
				@keyframes pulse {
					0%, 100% {
						opacity: 1;
					}
					50% {
						opacity: 0.6;
					}
				}
			`}</style>
		</div>
	)
}
