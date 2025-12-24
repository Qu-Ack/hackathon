import "./App.css"
import { useRef, useEffect, useState } from 'react';
import { socket } from "./socket";

const rtcConfig: RTCConfiguration = {
	iceServers: [
		{ urls: "stun:stun.l.google.com:19302" }
	]
};

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
	const [isBroadcasting, setIsBroadcasting] = useState(false);
	const [isWatching, setIsWatching] = useState(false);
	const localStreamRef = useRef<MediaStream | null>(null);

	function onConnect() {
		console.log("connected");
	}

	function onPause() {
		if (localVideo.current) {
			localVideo.current.pause();
		}
	}

	function onResume() {
		if (localVideo.current) {
			localVideo.current.play();
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

	return (
		<div id="app">
			<h1 id="dashboard_heading"> Dashboard </h1>
			<div id="dashboard_video_feed_container">
				<div id="dashboard_camera_feed_container">
					<video
						ref={localVideo}
						id="dashboard_camera_feed"
						autoPlay
						muted />
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
					</div>
				</div>
				<div id="dashboard_chat_box"></div>
			</div>
		</div>
	)
}
