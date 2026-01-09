export default function LandingPage() {

	return (
		<div style={{
			minHeight: '100vh',
			background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			padding: '20px'
		}}>
			<div style={{
				maxWidth: '800px',
				textAlign: 'center',
				color: 'white'
			}}>
				<h1 style={{
					fontSize: '3.5em',
					marginBottom: '20px',
					fontWeight: 'bold'
				}}>
					🚀 Vision Navigator
				</h1>

				<p style={{
					fontSize: '1.5em',
					marginBottom: '40px',
					opacity: 0.9
				}}>
					AI-Powered Real-Time Navigation & Object Detection
				</p>

				<div style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
					gap: '20px',
					marginBottom: '50px'
				}}>
					<div style={{
						background: 'rgba(255, 255, 255, 0.1)',
						padding: '30px',
						borderRadius: '15px',
						backdropFilter: 'blur(10px)'
					}}>
						<div style={{ fontSize: '2.5em', marginBottom: '10px' }}>📹</div>
						<h3>Live Streaming</h3>
						<p style={{ opacity: 0.8 }}>Broadcast & watch in real-time</p>
					</div>

					<div style={{
						background: 'rgba(255, 255, 255, 0.1)',
						padding: '30px',
						borderRadius: '15px',
						backdropFilter: 'blur(10px)'
					}}>
						<div style={{ fontSize: '2.5em', marginBottom: '10px' }}>🎯</div>
						<h3>Object Detection</h3>
						<p style={{ opacity: 0.8 }}>Mark & identify objects</p>
					</div>

					<div style={{
						background: 'rgba(255, 255, 255, 0.1)',
						padding: '30px',
						borderRadius: '15px',
						backdropFilter: 'blur(10px)'
					}}>
						<div style={{ fontSize: '2.5em', marginBottom: '10px' }}>🗣️</div>
						<h3>Voice Guidance</h3>
						<p style={{ opacity: 0.8 }}>AI-powered navigation</p>
					</div>
				</div>

				{/* Navigation Links */}
				<div style={{
					display: 'flex',
					justifyContent: 'center',
					gap: '40px',
					fontSize: '1.2em'
				}}>
					<a
						href="/login"
						style={{
							color: 'white',
							textDecoration: 'none',
							fontWeight: 'bold',
							borderBottom: '2px solid transparent'
						}}
						onMouseOver={(e) => e.currentTarget.style.borderBottom = '2px solid white'}
						onMouseOut={(e) => e.currentTarget.style.borderBottom = '2px solid transparent'}
					>
						Login
					</a>

					<a
						href="/about"
						style={{
							color: 'white',
							textDecoration: 'none',
							fontWeight: 'bold',
							borderBottom: '2px solid transparent'
						}}
						onMouseOver={(e) => e.currentTarget.style.borderBottom = '2px solid white'}
						onMouseOut={(e) => e.currentTarget.style.borderBottom = '2px solid transparent'}
					>
						About Us
					</a>
				</div>
			</div>
		</div>
	);
}


