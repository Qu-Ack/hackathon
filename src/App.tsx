import "./App.css"
import { useRef, useEffect, useState } from 'react';
import { socket } from "./socket";

const rtcConfig: RTCConfiguration = {
	iceServers: [
		{
			urls: ["stun:stun.relay.metered.ca:80", "stun:global.stun.metered.ca:3478"],
		},
		{
			urls: "turn:global.relay.metered.ca:80",
			username: "3711b6ade72f58c45a556c24",
			credential: "Veg3jfxJJVVaHD85",
		},
		{
			urls: "turn:global.relay.metered.ca:80?transport=tcp",
			username: "3711b6ade72f58c45a556c24",
			credential: "Veg3jfxJJVVaHD85",
		},
		{
			urls: "turn:global.relay.metered.ca:443",
			username: "3711b6ade72f58c45a556c24",
			credential: "Veg3jfxJJVVaHD85",
		},
		{
			urls: "turns:global.relay.metered.ca:443?transport=tcp",
			username: "3711b6ade72f58c45a556c24",
			credential: "Veg3jfxJJVVaHD85",
		},
	],
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
		});
		return stream;
	} catch (err) {
		console.error('Error getting media stream:', err);
		throw err;
	}
}

export default function App() {
	const localVideo = useRef<HTMLVideoElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const chatBoxRef = useRef<HTMLDivElement | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	
	const [isBroadcasting, setIsBroadcasting] = useState(false);
	const [isWatching, setIsWatching] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
	const [isDrawing, setIsDrawing] = useState(false);
	const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
	const [annotations, setAnnotations] = useState<Annotation[]>([]);
	const [directions, setDirections] = useState<Direction[]>([]);
	const [isRecording, setIsRecording] = useState(false);
	const [isListening, setIsListening] = useState(false);
	const [error, setError] = useState<string>('');
	
	const localStreamRef = useRef<MediaStream | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
	const watcherPCRef = useRef<RTCPeerConnection | null>(null);

	const ELEVEN_LABS_API_KEY = 'sk_1ec99cd9a2ce501decaf27f53c2fb1a0c7edfe3bb9beefa8';
	const VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';
	const MODULE_X_BASE_URL = 'http://192.168.1.2:5000'; // Update with your module X URL

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
				await audioRef.current.play().catch(err => console.error('Audio playback error:', err));
			}
		} catch (err) {
			console.error('Text-to-speech error:', err);
			setError('Failed to play audio');
		}
	}

	async function captureAndSendFrame() {
		if (!localVideo.current) {
			console.error('No video element available');
			return;
		}

		try {
			console.log('Capturing current frame...');
			setIsRecording(true);

			const video = localVideo.current;
			const canvas = document.createElement('canvas');
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;
			const ctx = canvas.getContext('2d');

			if (!ctx) {
				console.error('Could not get canvas context');
				setIsRecording(false);
				return;
			}

			ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
			console.log('Frame captured:', canvas.width, 'x', canvas.height);

			canvas.toBlob(async (blob) => {
				if (!blob) {
					console.error('Failed to create blob from canvas');
					setIsRecording(false);
					return;
				}

				console.log('Image blob created. Size:', blob.size, 'bytes');
				await sendImageToModuleX(blob);
				setIsRecording(false);
			}, 'image/jpeg', 0.95);

		} catch (err) {
			console.error('Error capturing frame:', err);
			setIsRecording(false);
			setError('Failed to capture frame');
		}
	}

	async function sendImageToModuleX(imageBlob: Blob) {
		try {
			console.log('Preparing to send image to Module X...');
			console.log('Image blob size:', imageBlob.size, 'bytes');

			const formData = new FormData();
			formData.append('image', imageBlob, 'frame.jpg');
			formData.append('timestamp', new Date().toISOString());

			console.log('Sending image to:', `${MODULE_X_BASE_URL}/image`);

			const response = await fetch(`${MODULE_X_BASE_URL}/image`, {
				method: 'POST',
				body: formData
			});

			console.log('Response status:', response.status);

			if (!response.ok) {
				const errorText = await response.text();
				console.error('Error response:', errorText);
				throw new Error(`Failed to send image: ${response.status} - ${errorText}`);
			}

			const result = await response.json();
			console.log('Image sent successfully:', result);
		} catch (err) {
			console.error('Error sending image to Module X:', err);
			setError('Failed to send image to Module X');
		}
	}

	useEffect(() => {
		socket.on('module_x_callback', (data) => {
			console.log('Received callback from Module X:', data);
			captureAndSendFrame();
		});

		return () => {
			socket.off('module_x_callback');
		};
	}, []);

	useEffect(() => {
		socket.on('module_x_instruction', (data) => {
			console.log('Received instruction from Module X:', data);
			const instruction = data.instruction || data.text;

			if (instruction) {
				const newDirection: Direction = {
					id: Date.now() + Math.random(),
					text: instruction,
					timestamp: new Date()
				};

				setDirections(prev => [...prev, newDirection]);
				textToSpeech(instruction);

				setTimeout(() => {
					if (chatBoxRef.current) {
						chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
					}
				}, 100);
			}
		});

		return () => {
			socket.off('module_x_instruction');
		};
	}, []);

	async function sendAcknowledgment(goalId: string) {
		try {
			const response = await fetch(`${MODULE_X_BASE_URL}/ack`, {
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
				setError('Failed to send acknowledgment');
				return;
			}

			console.log("Acknowledgment sent successfully");
		} catch (err) {
			console.error("Error sending acknowledgment:", err);
			setError('Error sending acknowledgment');
		}
	}

	async function speechToText(audioBlob: Blob): Promise<string | null> {
		try {
			const formData = new FormData();
			formData.append("file", audioBlob, "audio.webm");
			formData.append("model_id", "scribe_v1");

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
				throw new Error(`ElevenLabs STT error ${response.status}: ${errText}`);
			}

			const data = await response.json();
			return data.text ?? null;
		} catch (err) {
			console.error("Speech-to-text error:", err);
			setError('Speech recognition failed');
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

			setTimeout(() => {
				if (mediaRecorder.state === 'recording') {
					mediaRecorder.stop();
				}
			}, 5000);

		} catch (err) {
			console.error('Microphone access error:', err);
			setError('Could not access microphone. Please grant permission.');
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
			console.log("Sending annotations to Module X...");

			const response = await fetch(`${MODULE_X_BASE_URL}/activate`, {
				method: "POST",
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					annotations: annotations,
					timestamp: new Date().toISOString()
				}),
			});

			if (!response.ok) {
				console.error("Failed to activate Module X:", response);
				setError('Failed to activate Module X');
				return;
			}

			const result = await response.json();
			console.log("Module X activated:", result);

			setAnnotations([]);

			const newDirection: Direction = {
				id: Date.now(),
				text: "Module X activated - waiting for instructions...",
				timestamp: new Date()
			};
			setDirections(prev => [...prev, newDirection]);

		} catch (err) {
			console.error("Error sending annotations:", err);
			setError('Error sending annotations to Module X');
		}
	}

	function captureFrame(): string | undefined {
		if (!localVideo.current || !canvasRef.current) return;

		const video = localVideo.current;
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

	function clearDirections() {
		setDirections([]);
	}

	async function startBroadcast() {
		try {
			const stream = await getMediaStream();
			if (!stream) {
				setError("Could not access camera");
				return;
			}

			localStreamRef.current = stream;
			if (localVideo.current) {
				localVideo.current.srcObject = stream;
			}

			socket.emit("start-broadcast");
			setIsBroadcasting(true);
			setError('');
		} catch (err) {
			console.error('Error starting broadcast:', err);
			setError('Failed to start broadcast. Please allow camera access.');
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

		peerConnectionsRef.current.forEach(pc => {
			pc.close();
		});
		peerConnectionsRef.current.clear();

		socket.emit("broadcast-ended");
		setIsBroadcasting(false);
	}

	function watchBroadcast() {
		console.log('Requesting to watch broadcast...');
		socket.emit("watch");
		setError('');
	}

	function stopWatching() {
		console.log('Stopping watch...');

		if (localVideo.current) {
			localVideo.current.srcObject = null;
		}

		if (watcherPCRef.current) {
			console.log('Closing watcher connection, state:', watcherPCRef.current.connectionState);
			watcherPCRef.current.close();
			watcherPCRef.current = null;
		}

		socket.emit("stop-watching");
		setIsWatching(false);
	}

	useEffect(() => {
		if (!socket) return;

		const onWatcherJoined = async (watcherId: string) => {
			if (!localStreamRef.current) {
				console.error('No local stream available');
				return;
			}

			console.log('Watcher joined:', watcherId);

			const pc = new RTCPeerConnection(rtcConfig);
			peerConnectionsRef.current.set(watcherId, pc);

			localStreamRef.current.getTracks().forEach(track => {
				pc.addTrack(track, localStreamRef.current!);
			});

			pc.onicecandidate = e => {
				if (e.candidate) {
					socket.emit("ice", { to: watcherId, candidate: e.candidate });
				}
			};

			pc.oniceconnectionstatechange = () => {
				console.log(`ICE state for ${watcherId}:`, pc.iceConnectionState);
			};

			pc.onconnectionstatechange = () => {
				console.log(`Connection state for ${watcherId}:`, pc.connectionState);
			};

			try {
				const offer = await pc.createOffer();
				await pc.setLocalDescription(offer);
				socket.emit("offer", { to: watcherId, offer });
			} catch (err) {
				console.error('Error creating offer:', err);
			}
		};

		const onIce = async ({ from, candidate }: any) => {
			try {
				if (peerConnectionsRef.current.has(from)) {
					await peerConnectionsRef.current.get(from)!.addIceCandidate(new RTCIceCandidate(candidate));
				} else if (watcherPCRef.current) {
					await watcherPCRef.current.addIceCandidate(new RTCIceCandidate(candidate));
				}
			} catch (err) {
				console.error('Error adding ICE candidate:', err);
			}
		};

		const onAnswer = async ({ from, answer }: any) => {
			const pc = peerConnectionsRef.current.get(from);
			if (pc && pc.signalingState !== "closed") {
				try {
					await pc.setRemoteDescription(new RTCSessionDescription(answer));
				} catch (err) {
					console.error('Error setting remote description:', err);
				}
			}
		};

		const onOffer = async ({ from, offer }: any) => {
			console.log('Received offer from:', from);

			if (watcherPCRef.current) {
				watcherPCRef.current.close();
			}

			watcherPCRef.current = new RTCPeerConnection(rtcConfig);

			watcherPCRef.current.ontrack = e => {
				console.log('Received track:', e.track.kind);
				if (localVideo.current && e.streams[0]) {
					localVideo.current.srcObject = e.streams[0];
				}
			};

			watcherPCRef.current.onicecandidate = e => {
				if (e.candidate) {
					socket.emit("ice", { to: from, candidate: e.candidate });
				}
			};

			watcherPCRef.current.oniceconnectionstatechange = () => {
				console.log('Watcher ICE state:', watcherPCRef.current?.iceConnectionState);
			};

			watcherPCRef.current.onconnectionstatechange = () => {
				console.log('Watcher connection state:', watcherPCRef.current?.connectionState);
			};

			try {
				await watcherPCRef.current.setRemoteDescription(new RTCSessionDescription(offer));
				const answer = await watcherPCRef.current.createAnswer();
				await watcherPCRef.current.setLocalDescription(answer);
				socket.emit("answer", { to: from, answer });
				setIsWatching(true);
			} catch (err) {
				console.error('Error handling offer:', err);
				setError('Failed to connect to broadcast');
			}
		};

		const onBroadcastEnded = () => {
			console.log('Broadcast ended');
			if (watcherPCRef.current) {
				watcherPCRef.current.close();
				watcherPCRef.current = null;
			}
			if (localVideo.current) {
				localVideo.current.srcObject = null;
			}
			setIsWatching(false);
		};

		const onWatcherLeft = (watcherId: string) => {
			console.log('Watcher left:', watcherId);
			const pc = peerConnectionsRef.current.get(watcherId);
			if (pc) {
				pc.close();
				peerConnectionsRef.current.delete(watcherId);
			}
		};

		socket.on("watcher-joined", onWatcherJoined);
		socket.on("answer", onAnswer);
		socket.on("offer", onOffer);
		socket.on("ice", onIce);
		socket.on("broadcast-ended", onBroadcastEnded);
		socket.on("watcher-left", onWatcherLeft);

		return () => {
			socket.off("watcher-joined", onWatcherJoined);
			socket.off("answer", onAnswer);
			socket.off("offer", onOffer);
			socket.off("ice", onIce);
			socket.off("broadcast-ended", onBroadcastEnded);
			socket.off("watcher-left", onWatcherLeft);

			peerConnectionsRef.current.forEach(pc => pc.close());
			peerConnectionsRef.current.clear();

			if (watcherPCRef.current) {
				watcherPCRef.current.close();
				watcherPCRef.current = null;
			}
		};
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
			<h1 id="dashboard_heading">Dashboard</h1>
			
			{error && (
				<div style={{
					background: '#ff4444',
					color: 'white',
					padding: '12px',
					margin: '10px',
					borderRadius: '8px',
					textAlign: 'center'
				}}>
					{error}
					<button 
						onClick={() => setError('')}
						style={{
							marginLeft: '10px',
							background: 'white',
							color: '#ff4444',
							border: 'none',
							padding: '4px 12px',
							borderRadius: '4px',
							cursor: 'pointer'
						}}
					>
						×
					</button>
				</div>
			)}

			<div id="dashboard_video_feed_container">
				<div id="dashboard_camera_feed_container">
					<div style={{ position: 'relative', display: 'inline-block' }}>
						<video
							ref={localVideo}
							id="dashboard_camera_feed"
							autoPlay
							playsInline
							muted
							style={{ display: 'block', maxWidth: '100%' }}
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
						{isRecording && (
							<div style={{
								position: 'absolute',
								top: '10px',
								right: '10px',
								background: '#4CAF50',
								color: 'white',
								padding: '8px 16px',
								borderRadius: '20px',
								fontWeight: 'bold',
								animation: 'pulse 1.5s infinite'
							}}>
								📸 Capturing Frame
							</div>
						)}
					</div>
					<div id="dashboard_camera_controls">
						<button 
							id="dashboard_camera_control_btn"
							onClick={startBroadcast}
							disabled={isBroadcasting}
						>
							Start Broadcasting
						</button>
						<button 
							id="dashboard_camera_control_btn"
							onClick={stopBroadcast}
							disabled={!isBroadcasting}
						>
							Stop Broadcast
						</button>
						<button 
							id="dashboard_camera_control_btn"
							onClick={watchBroadcast}
							disabled={isWatching || isBroadcasting}
						>
							Watch Broadcast
						</button>
						<button 
							id="dashboard_camera_control_btn"
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
						<button 
							id="dashboard_camera_control_btn"
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
							<h2 style={{ margin: 0, fontSize: '1.5em' }}>Module X Instructions</h2>
							<div style={{ display: 'flex', gap: '10px' }}>
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
									Send annotations to activate Module X
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
		</div>
	);
}
