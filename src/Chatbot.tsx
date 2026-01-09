import React, { useState, useRef, useEffect } from 'react';
import './Chatbot.css';

interface Message {
	role: 'user' | 'assistant';
	content: string;
}

const Chatbot: React.FC = () => {
	const [isOpen, setIsOpen] = useState<boolean>(false);
	const [messages, setMessages] = useState<Message[]>([
		{ role: 'assistant', content: 'Hi! How can I help you today?' }
	]);
	const [input, setInput] = useState<string>('');
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const API_BASE_URL = 'http://20.193.158.43:8001';

	const scrollToBottom = (): void => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	const sendMessage = async (): Promise<void> => {
		if (!input.trim() || isLoading) return;

		const userMessage: Message = { role: 'user', content: input };
		setMessages(prev => [...prev, userMessage]);
		const currentInput = input;
		setInput('');
		setIsLoading(true);

		try {
			// Using simple endpoint (non-streaming)
			const response = await fetch(`${API_BASE_URL}/generate`,{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content: currentInput })
			});

			if (!response.ok) {
				throw new Error(`API error: ${response.status}`);
			}

			const data = await response.json();
			const botReply = data.response || 'Sorry, I could not process that.';

			setMessages(prev => [...prev, { role: 'assistant', content: botReply }]);
		} catch (error) {
			console.error('Chatbot error:', error);
			setMessages(prev => [...prev, {
				role: 'assistant',
				content: 'Sorry, there was an error connecting to the AI. Make sure the backend server is running on port 5000.'
			}]);
		} finally {
			setIsLoading(false);
		}
	};

	const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	};

	return (
		<>
			<div className={`chatbot-container ${isOpen ? 'open' : ''}`}>
				<div className="chatbot-header">
					<h3>AI Assistant</h3>
					<button className="close-btn" onClick={() => setIsOpen(false)}>×</button>
				</div>

				<div className="chatbot-messages">
					{messages.map((msg, idx) => (
						<div key={idx} className={`message ${msg.role}`}>
							<div className="message-content">{msg.content}</div>
						</div>
					))}
					{isLoading && (
						<div className="message assistant">
							<div className="message-content typing">
								<span></span><span></span><span></span>
							</div>
						</div>
					)}
					<div ref={messagesEndRef} />
				</div>

				<div className="chatbot-input">
					<input
						type="text"
						value={input}
						onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
						onKeyPress={handleKeyPress}
						placeholder="Type your message..."
						disabled={isLoading}
					/>
					<button onClick={sendMessage} disabled={isLoading || !input.trim()}>
						Send
					</button>
				</div>
			</div>

			<button
				className={`chatbot-toggle ${isOpen ? 'hidden' : ''}`}
				onClick={() => setIsOpen(true)}
			>
				💬
			</button>
		</>
	);
};

export default Chatbot;
