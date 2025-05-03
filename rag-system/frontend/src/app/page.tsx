'use client';

import { useState, useEffect } from 'react';

// Support both local and network access
// Use window.location.hostname to get the current hostname dynamically
const getApiUrl = () => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  // Handle both localhost and IP addresses
  return `http://${hostname}:8000`;
};

export default function Home() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [apiUrl, setApiUrl] = useState('');

  useEffect(() => {
    // Set the API URL when the component mounts
    const url = getApiUrl();
    setApiUrl(url);
    
    // Check server health
    const checkServerHealth = async () => {
      try {
        console.log('Checking server health at:', url);
        const response = await fetch(`${url}/health`, {
          // No-cache to ensure we get fresh status
          cache: 'no-cache',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          console.log('Server is online');
          setServerStatus('online');
        } else {
          console.log('Server responded with error:', response.status);
          setServerStatus('offline');
        }
      } catch (error) {
        console.error('Health check failed:', error);
        setServerStatus('offline');
      }
    };

    checkServerHealth();
    
    // Check server health every 5 seconds
    const interval = setInterval(checkServerHealth, 5000);
    
    // Clean up the interval when component unmounts
    return () => clearInterval(interval);
  }, []);

  const ask = async () => {
    if (!question.trim() || serverStatus !== 'online') return;
    setLoading(true);
    setError('');
    try {
      console.log('Sending request to:', `${apiUrl}/ask`);
      const res = await fetch(`${apiUrl}/ask`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ input: question }),
      });

      console.log('Response status:', res.status);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Unknown error occurred' }));
        console.error('Error response:', errorData);
        
        if (res.status === 503) {
          setError('⚠️ The service is temporarily unavailable due to high demand. Please try again in a few moments.');
        } else if (res.status === 404) {
          setError('❌ API endpoint not found. Please check if the backend server is running.');
        } else if (res.status === 500) {
          setError(`❌ Server error: ${errorData.detail || 'Something went wrong on the server.'}`);
        } else {
          setError(`❌ Error: ${errorData.detail || 'Something went wrong. Please try again.'}`);
        }
        setAnswer('');
        return;
      }

      const data = await res.json();
      console.log('Success response:', data);
      setAnswer(data.answer);
    } catch (error) {
      console.error('Network error:', error);
      setError(`❌ Network error. Please check if the backend server is running at ${apiUrl}`);
      setAnswer('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 700, margin: 'auto' }}>
      <h1>🤖 RAG Chatbot</h1>
      
      {serverStatus === 'checking' && (
        <div style={{ 
          marginTop: 20, 
          padding: '10px', 
          background: '#fff3e0', 
          border: '1px solid #ffcc80',
          borderRadius: 6,
          color: '#e65100'
        }}>
          🔄 Checking server status at {apiUrl}...
        </div>
      )}
      
      {serverStatus === 'offline' && (
        <div style={{ 
          marginTop: 20, 
          padding: '10px', 
          background: '#fff3f3', 
          border: '1px solid #ffcdd2',
          borderRadius: 6,
          color: '#d32f2f'
        }}>
          ❌ Backend server is offline. Please start the server at {apiUrl}
        </div>
      )}

      <input
        type="text"
        placeholder="Ask something..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        style={{
          padding: 12,
          width: '100%',
          fontSize: '16px',
          marginTop: 20,
          border: '1px solid #ccc',
          borderRadius: 8,
        }}
      />
      <button
        onClick={ask}
        disabled={loading || serverStatus !== 'online'}
        style={{
          marginTop: 12,
          padding: '10px 20px',
          background: serverStatus === 'online' ? '#0070f3' : '#ccc',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          cursor: serverStatus === 'online' ? 'pointer' : 'not-allowed',
        }}
      >
        {loading ? 'Thinking...' : 'Ask'}
      </button>

      {error && (
        <div style={{ 
          marginTop: 20, 
          padding: '10px', 
          background: '#fff3f3', 
          border: '1px solid #ffcdd2',
          borderRadius: 6,
          color: '#d32f2f'
        }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 32 }}>
        <h2>💬 Answer:</h2>
        <p>{answer}</p>
      </div>
    </main>
  );
}
