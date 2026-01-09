import { useState } from 'react'
import { useNavigate } from "react-router"


export default function LoginPage() {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const navigate = useNavigate();

	const handleSubmit = () => {
		console.log("called")
		if (username == "admin" && password == "123456") {
			navigate('/dashboard');
		}  
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			handleSubmit();
		}
	};

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
				background: 'white',
				padding: '50px',
				borderRadius: '20px',
				boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
				maxWidth: '400px',
				width: '100%'
			}}>
				<h2 style={{
					fontSize: '2.5em',
					marginBottom: '10px',
					color: '#667eea',
					textAlign: 'center'
				}}>
					Welcome Back
				</h2>
				<p style={{
					textAlign: 'center',
					color: '#666',
					marginBottom: '30px'
				}}>
					Sign in to continue
				</p>

				<div style={{ marginBottom: '20px' }}>
					<label style={{
						display: 'block',
						marginBottom: '8px',
						color: '#333',
						fontWeight: '500'
					}}>
						Username
					</label>
					<input
						type="text"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						onKeyPress={handleKeyPress}
						placeholder="Enter username"
						style={{
							width: '100%',
							padding: '15px',
							border: '2px solid #e0e0e0',
							borderRadius: '10px',
							fontSize: '1em',
							outline: 'none',
							transition: 'border 0.3s',
							boxSizing: 'border-box'
						}}
						onFocus={(e) => e.target.style.borderColor = '#667eea'}
						onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
					/>
				</div>

				<div style={{ marginBottom: '30px' }}>
					<label style={{
						display: 'block',
						marginBottom: '8px',
						color: '#333',
						fontWeight: '500'
					}}>
						Password
					</label>
					<input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						onKeyPress={handleKeyPress}
						placeholder="Enter password"
						style={{
							width: '100%',
							padding: '15px',
							border: '2px solid #e0e0e0',
							borderRadius: '10px',
							fontSize: '1em',
							outline: 'none',
							transition: 'border 0.3s',
							boxSizing: 'border-box'
						}}
						onFocus={(e) => e.target.style.borderColor = '#667eea'}
						onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
					/>
				</div>

				<button
					onClick={handleSubmit}
					style={{
						width: '100%',
						padding: '15px',
						background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
						color: 'white',
						border: 'none',
						borderRadius: '10px',
						fontSize: '1.1em',
						fontWeight: 'bold',
						cursor: 'pointer',
						transition: 'all 0.3s'
					}}
					onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
					onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
				>
					Sign In
				</button>

				<p style={{
					textAlign: 'center',
					marginTop: '20px',
					color: '#999',
					fontSize: '0.9em'
				}}>
					Demo: admin / admin123
				</p>
			</div>
		</div>
	);
}

