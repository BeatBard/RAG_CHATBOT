'use client';

import { useState, useEffect } from 'react';

// Type for document info
interface DocumentInfo {
  filename: string;
  size: number;
  active: boolean;
}

// Support both local and network access
// Use window.location.hostname to get the current hostname dynamically
const getApiUrl = () => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  // Handle both localhost and IP addresses
  return `http://${hostname}:8000`;
};

// Theme colors
const colors = {
  primary: '#1a73e8',
  primaryDark: '#0d47a1',
  secondary: '#34a853',
  secondaryDark: '#1b5e20',
  background: '#f8f9fa',
  surface: '#ffffff',
  error: '#d32f2f',
  warning: '#ff9800',
  text: {
    primary: '#202124',
    secondary: '#5f6368',
    disabled: '#9aa0a6',
    hint: '#3c4043',
  },
  human: '#e8f0fe',
  humanBorder: '#d2e3fc',
  ai: '#e6f4ea',
  aiBorder: '#ceead6',
};

export default function Home() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [apiUrl, setApiUrl] = useState('');
  const [history, setHistory] = useState<{role: string, content: string}[]>([]);
  const [summary, setSummary] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [memoryAttributes, setMemoryAttributes] = useState<string[]>([]);
  const [chainAttributes, setChainAttributes] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [showDocuments, setShowDocuments] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

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
          
          // If server is online, fetch conversation history and documents
          fetchHistory();
          fetchDocuments();
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

  const fetchHistory = async () => {
    if (serverStatus !== 'online' || !apiUrl) return;
    
    try {
      const response = await fetch(`${apiUrl}/history`);
      if (response.ok) {
        const data = await response.json();
        console.log('History data:', data);
        setHistory(data.history || []);
        setSummary(data.summary || '');
        setMemoryAttributes(data.memory_attributes || []);
        setChainAttributes(data.chain_attributes || []);
      } else {
        console.error('Failed to fetch history:', response.status);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const fetchDocuments = async () => {
    if (serverStatus !== 'online' || !apiUrl) return;
    
    try {
      const response = await fetch(`${apiUrl}/documents`);
      if (response.ok) {
        const data = await response.json();
        console.log('Documents:', data);
        setDocuments(data || []);
      } else {
        console.error('Failed to fetch documents:', response.status);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

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
      
      // Fetch updated history after getting an answer
      fetchHistory();
    } catch (error) {
      console.error('Network error:', error);
      setError(`❌ Network error. Please check if the backend server is running at ${apiUrl}`);
      setAnswer('');
    } finally {
      setLoading(false);
      setQuestion(''); // Clear the input after asking
    }
  };

  // File upload handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const formData = new FormData();
    formData.append('file', file);
    
    setUploadStatus('Uploading...');
    
    try {
      const response = await fetch(`${apiUrl}/upload-document`, {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const result = await response.json();
        setUploadStatus(`✅ Successfully uploaded ${result.filename}`);
        // Refresh documents list
        fetchDocuments();
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        setUploadStatus(`❌ Upload failed: ${errorData.detail}`);
      }
    } catch (error) {
      setUploadStatus(`❌ Upload failed: Network error`);
      console.error('Upload error:', error);
    }
  };

  // Activate a document
  const activateDocument = async (filename: string) => {
    if (serverStatus !== 'online' || !apiUrl) return;
    
    try {
      const response = await fetch(`${apiUrl}/activate-document/${filename}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        setUploadStatus(`✅ Activated document: ${filename}`);
        // Refresh documents list
        fetchDocuments();
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        setUploadStatus(`❌ Failed to activate: ${errorData.detail}`);
      }
    } catch (error) {
      setUploadStatus(`❌ Network error while activating document`);
      console.error('Activation error:', error);
    }
  };

  // Reset the conversation memory
  const resetMemory = async () => {
    if (serverStatus !== 'online' || !apiUrl) return;
    
    try {
      const response = await fetch(`${apiUrl}/reset-memory`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const result = await response.json();
        setError(`✅ ${result.message}`);
        // Refresh history to show it's been cleared
        fetchHistory();
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        setError(`❌ Failed to reset memory: ${errorData.detail}`);
      }
    } catch (error) {
      setError(`❌ Network error while resetting memory`);
      console.error('Reset memory error:', error);
    }
  };

  return (
    <main style={{ 
      padding: 40, 
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', 
      maxWidth: 800, 
      margin: 'auto',
      color: colors.text.primary,
      background: colors.background,
      borderRadius: 12,
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    }}>
      <h1 style={{ color: colors.primaryDark, marginBottom: 24 }}>🤖 RAG Chatbot with Memory</h1>
      
      {serverStatus === 'checking' && (
        <div style={{ 
          marginTop: 20, 
          padding: '12px 16px', 
          background: '#fff3e0', 
          border: '1px solid #ffcc80',
          borderRadius: 8,
          color: '#e65100'
        }}>
          🔄 Checking server status at {apiUrl}...
        </div>
      )}
      
      {serverStatus === 'offline' && (
        <div style={{ 
          marginTop: 20, 
          padding: '12px 16px', 
          background: '#ffebee', 
          border: '1px solid #ffcdd2',
          borderRadius: 8,
          color: colors.error
        }}>
          ❌ Backend server is offline. Please start the server at {apiUrl}
        </div>
      )}

      <div style={{ 
        display: 'flex', 
        marginTop: 24,
        gap: 8 
      }}>
        <input
          type="text"
          placeholder="Ask something..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && ask()}
          style={{
            padding: '12px 16px',
            flex: 1,
            fontSize: 16,
            border: '1px solid #dadce0',
            borderRadius: 8,
            outline: 'none',
            color: colors.text.primary
          }}
        />
        <button
          onClick={ask}
          disabled={loading || serverStatus !== 'online'}
          style={{
            padding: '0 24px',
            background: serverStatus === 'online' ? colors.primary : '#dadce0',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: serverStatus === 'online' ? 'pointer' : 'not-allowed',
            fontWeight: 500,
            fontSize: 16,
            transition: 'background 0.2s'
          }}
        >
          {loading ? 'Thinking...' : 'Ask'}
        </button>
      </div>

      {error && (
        <div style={{ 
          marginTop: 20, 
          padding: '12px 16px', 
          background: '#ffebee', 
          border: '1px solid #ffcdd2',
          borderRadius: 8,
          color: colors.error
        }}>
          {error}
        </div>
      )}

      {answer && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ color: colors.primaryDark, marginBottom: 12 }}>💬 Answer:</h2>
          <div style={{
            padding: 16,
            background: colors.ai,
            border: `1px solid ${colors.aiBorder}`,
            borderRadius: 8,
            fontSize: 16,
            lineHeight: 1.5
          }}>
            {answer}
          </div>
        </div>
      )}

      <div style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setShowHistory(!showHistory)}
            style={{
              padding: '8px 16px',
              background: showHistory ? colors.primary : '#f1f3f4',
              color: showHistory ? 'white' : colors.text.primary,
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'all 0.2s'
            }}
          >
            {showHistory ? 'Hide Conversation Memory' : 'Show Conversation Memory'}
          </button>
          
          <button 
            onClick={() => setShowDebug(!showDebug)}
            style={{
              padding: '8px 16px',
              background: showDebug ? colors.primary : '#f1f3f4',
              color: showDebug ? 'white' : colors.text.primary,
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'all 0.2s'
            }}
          >
            {showDebug ? 'Hide Debug Info' : 'Show Debug Info'}
          </button>
          
          <button 
            onClick={fetchHistory}
            style={{
              padding: '8px 16px',
              background: '#e8f0fe',
              color: colors.primary,
              border: '1px solid #d2e3fc',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            Refresh Memory
          </button>
          
          <button 
            onClick={resetMemory}
            style={{
              padding: '8px 16px',
              background: '#fce8e6',
              color: colors.error,
              border: '1px solid #fadad9',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            Reset Memory
          </button>
        </div>

        {showHistory && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ color: colors.primaryDark, marginBottom: 12 }}>Conversation Summary:</h3>
            <div style={{ 
              padding: 16, 
              background: '#fff',
              border: '1px solid #e8eaed',
              borderRadius: 8,
              color: summary ? colors.text.primary : colors.text.secondary,
              fontSize: 16,
              lineHeight: 1.5
            }}>
              {summary || 'No conversation summary yet.'}
            </div>

            <h3 style={{ color: colors.primaryDark, marginTop: 24, marginBottom: 12 }}>Message History:</h3>
            {history.length === 0 ? (
              <p style={{ color: colors.text.secondary, fontStyle: 'italic' }}>No conversation history yet.</p>
            ) : (
              <div>
                {history.map((msg, index) => (
                  <div key={index} style={{ 
                    marginBottom: 12,
                    padding: 16,
                    background: msg.role === 'human' ? colors.human : colors.ai,
                    borderRadius: 8,
                    border: `1px solid ${msg.role === 'human' ? colors.humanBorder : colors.aiBorder}`
                  }}>
                    <strong style={{ 
                      color: msg.role === 'human' ? colors.primary : colors.secondary,
                      display: 'block',
                      marginBottom: 8,
                      fontSize: 14
                    }}>
                      {msg.role === 'human' ? '👤 You:' : '🤖 AI:'}
                    </strong>
                    <p style={{ 
                      margin: 0,
                      color: colors.text.primary,
                      lineHeight: 1.5,
                      fontSize: 16
                    }}>
                      {msg.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {showDebug && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ color: colors.primaryDark, marginBottom: 12 }}>Debug Information:</h3>
            <div style={{ 
              padding: 16, 
              background: '#f8f9fa', 
              border: '1px solid #dadce0',
              borderRadius: 8,
              fontFamily: 'monospace',
              fontSize: 14,
              lineHeight: 1.5,
              color: colors.text.primary
            }}>
              <h4 style={{ color: colors.primary, marginTop: 0 }}>Chain Attributes:</h4>
              <ul style={{ color: colors.text.secondary }}>
                {chainAttributes.length > 0 ? (
                  chainAttributes.map((attr, index) => (
                    <li key={`chain_${index}`}>{attr}</li>
                  ))
                ) : (
                  <li style={{ fontStyle: 'italic' }}>No chain attributes available</li>
                )}
              </ul>
              
              <h4 style={{ color: colors.primary }}>Memory Attributes:</h4>
              <ul style={{ color: colors.text.secondary }}>
                {memoryAttributes.length > 0 ? (
                  memoryAttributes.map((attr, index) => (
                    <li key={`memory_${index}`}>{attr}</li>
                  ))
                ) : (
                  <li style={{ fontStyle: 'italic' }}>No memory attributes available</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Document Management Section */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => setShowDocuments(!showDocuments)}
          style={{
            background: colors.primary,
            color: 'white',
            border: 'none',
            padding: '10px 16px',
            borderRadius: 8,
            cursor: 'pointer',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            fontSize: 14,
          }}
        >
          {showDocuments ? '📁 Hide Documents' : '📁 Manage Documents'}
        </button>

        {showDocuments && (
          <div style={{ 
            background: 'white', 
            padding: 16, 
            borderRadius: 8,
            border: '1px solid #ddd',
            marginBottom: 16
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: colors.primaryDark }}>Document Management</h3>
            
            {/* Upload new document */}
            <div style={{ marginBottom: 16 }}>
              <label 
                htmlFor="file-upload" 
                style={{ 
                  display: 'inline-block', 
                  cursor: 'pointer',
                  background: colors.secondary,
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: 6,
                  marginRight: 8
                }}
              >
                📄 Upload New Document
              </label>
              <input 
                id="file-upload" 
                type="file" 
                accept=".txt,.md" 
                onChange={handleFileUpload} 
                style={{ display: 'none' }}
              />
              {uploadStatus && (
                <span style={{ marginLeft: 8, fontSize: 14 }}>{uploadStatus}</span>
              )}
            </div>
            
            {/* Document list - update to allow switching */}
            {documents.length > 0 ? (
              <div>
                <h4 style={{ margin: '16px 0 8px', color: colors.text.secondary }}>Available Documents</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {documents.map((doc) => (
                    <li 
                      key={doc.filename}
                      style={{ 
                        padding: '8px 12px',
                        marginBottom: 4,
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        background: doc.active ? '#e8f0fe' : 'white',
                        border: `1px solid ${doc.active ? '#d2e3fc' : '#eee'}`,
                        cursor: doc.active ? 'default' : 'pointer'
                      }}
                      onClick={() => !doc.active && activateDocument(doc.filename)}
                    >
                      <span style={{ 
                        fontWeight: doc.active ? 'bold' : 'normal',
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        {doc.active && <span style={{ color: colors.primary, marginRight: 8 }}>✓</span>}
                        {doc.filename}
                      </span>
                      <span style={{ fontSize: 12, color: colors.text.secondary }}>
                        {(doc.size / 1024).toFixed(1)} KB
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p style={{ color: colors.text.secondary, fontStyle: 'italic' }}>
                No documents available yet. Upload one to start.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
