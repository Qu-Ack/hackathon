export default function About() {
	return (
		<div style={{
			minHeight: '100vh',
			background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			padding: '20px',
			color: 'white'
		}}>
			<div style={{
				maxWidth: '900px',
				width: '100%',
				textAlign: 'center'
			}}>
				<h1 style={{
					fontSize: '3em',
					marginBottom: '15px',
					fontWeight: 'bold'
				}}>
					About Us
				</h1>

				<p style={{
					fontSize: '1.2em',
					opacity: 0.9,
					marginBottom: '40px'
				}}>
					We are a team of students from <strong>Indian Institute of Information Technology, Kota (IIIT Kota)</strong>,
					building <strong>Vision Navigator</strong> — an AI-powered real-time navigation and object detection system
					designed to assist visually impaired users.
				</p>

				<div style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
					gap: '25px'
				}}>
					{[
						{
							name: "Daksh Sangal",
							id: "2023KUCP1010"
						},
						{
							name: "Gourang Jain",
							id: "2023KUCP1027"
						},
						{
							name: "Ashmit Singh",
							id: "2023KUCP1014"
						},
						{
							name: "Sarthak Singh Tariyal",
							id: "2023KUEC2016"
						}
					].map((member) => (
						<div
							key={member.id}
							style={{
								background: 'rgba(255, 255, 255, 0.12)',
								padding: '25px',
								borderRadius: '15px',
								backdropFilter: 'blur(10px)',
								boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
							}}
						>
							<div style={{ fontSize: '2.5em', marginBottom: '10px' }}>👤</div>
							<h3 style={{ marginBottom: '8px' }}>{member.name}</h3>
							<p style={{ opacity: 0.85 }}>ID: {member.id}</p>
							<p style={{ opacity: 0.7, fontSize: '0.9em' }}>IIIT Kota</p>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}


