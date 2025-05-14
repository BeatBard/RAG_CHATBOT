'use client';

import { useState, useEffect } from 'react';

// Type for document info
interface DocumentInfo {
  filename: string;
  size: number;
  active: boolean;
  last_modified?: string;
  upload_date?: string;
}

// Support both local and network access, but avoid hydration errors
const getApiUrl = () => {
  // Default API URL for server-side rendering
  return 'http://localhost:8000';
};

// Theme colors
const colors = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  secondary: '#059669',
  secondaryDark: '#047857',
  background: '#f8fafc',
  surface: '#ffffff',
  error: '#dc2626',
  warning: '#f59e0b',
  text: {
    primary: '#1e293b',
    secondary: '#475569',
    disabled: '#94a3b8',
    hint: '#334155',
  },
  human: '#eff6ff',
  humanBorder: '#bfdbfe',
  ai: '#ecfdf5',
  aiBorder: '#a7f3d0',
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
  const [activeDocumentName, setActiveDocumentName] = useState('');
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    // Set the dynamic API URL only on the client-side to avoid hydration errors
    const hostname = window.location.hostname;
    const dynamicApiUrl = `http://${hostname}:8000`;
    setApiUrl(dynamicApiUrl);
    
    // Check server health using a local function to avoid hydration issues
    const checkServerHealth = async (url: string) => {
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
          fetchHistory(url);
          fetchDocuments(url);
        } else {
          console.log('Server responded with error:', response.status);
          setServerStatus('offline');
        }
      } catch (error) {
        console.error('Health check failed:', error);
        setServerStatus('offline');
      }
    };

    // Call the health check function
    checkServerHealth(dynamicApiUrl);
    
    // Check server health every 5 seconds
    const interval = setInterval(() => checkServerHealth(dynamicApiUrl), 5000);
    
    // Clean up the interval when component unmounts
    return () => clearInterval(interval);
  }, []);

  const fetchHistory = async (url = apiUrl) => {
    if (serverStatus !== 'online' || !url) return;
    
    try {
      console.log('Fetching history from:', `${url}/history`);
      const response = await fetch(`${url}/history`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('History data full response:', JSON.stringify(data));
        
        // Update history array
        if (data.history && Array.isArray(data.history)) {
          setHistory(data.history);
          console.log(`Set history with ${data.history.length} messages`);
        } else {
          console.warn('History is not an array:', data.history);
          setHistory([]);
        }
        
        // Update conversation summary - add detailed logging
        console.log('Raw summary value:', data.summary);
        console.log('Summary type:', typeof data.summary);
        console.log('Summary length:', data.summary ? data.summary.length : 0);
        
        if (data.summary !== undefined) {
          console.log('Setting summary:', data.summary);
          setSummary(data.summary);
        } else {
          console.warn('Summary is undefined in response');
          setSummary('');
        }
        
        // Properly handle memory attributes - ensure it's an array
        if (data.memory_attributes && Array.isArray(data.memory_attributes)) {
          setMemoryAttributes(data.memory_attributes);
        } else if (data.memory_attributes && typeof data.memory_attributes === 'object') {
          // If it's an object instead of an array, convert to array of keys
          setMemoryAttributes(Object.keys(data.memory_attributes));
        } else {
          setMemoryAttributes([]);
        }
        
        // Properly handle chain attributes
        if (data.chain_attributes && Array.isArray(data.chain_attributes)) {
          setChainAttributes(data.chain_attributes);
        } else if (data.chain_attributes && typeof data.chain_attributes === 'object') {
          setChainAttributes(Object.keys(data.chain_attributes));
        } else {
          setChainAttributes([]);
        }
        
        // Save any additional debug information
        if (data.debug) {
          setDebugInfo(data.debug);
        }
      } else {
        console.error(`Failed to fetch history: ${response.status}`, await response.text());
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const fetchDocuments = async (url = apiUrl) => {
    if (serverStatus !== 'online' || !url) return;
    
    try {
      const response = await fetch(`${url}/documents`);
      if (response.ok) {
        const data = await response.json();
        console.log('Documents:', data);
        setDocuments(data || []);
        // Find active document
        const activeDoc = data?.find((doc: DocumentInfo) => doc.active);
        if (activeDoc) {
          setActiveDocumentName(activeDoc.filename);
        }
      } else {
        console.error('Failed to fetch documents:', response.status);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const ask = async (url = apiUrl) => {
    if (!question.trim() || serverStatus !== 'online' || !url) return;
    
    // Add user message to history immediately for better UX
    const userMessage = { role: 'human', content: question };
    setHistory([...history, userMessage]);
    
    setLoading(true);
    setError('');
    try {
      console.log('Sending request to:', `${url}/ask`);
      const res = await fetch(`${url}/ask`, {
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
          setError(`🔥 Server error: ${errorData.detail || 'Unknown error'}`);
        } else {
          setError(`Error: ${errorData.detail || 'Unknown error'}`);
        }
      } else {
        const data = await res.json();
        console.log('Response data:', data);
        
        if (data.answer) {
          const aiMessage = { role: 'ai', content: data.answer };
          setHistory([...history, userMessage, aiMessage]);
          
          // Fetch updated history with new summary after getting answer
          setTimeout(() => {
            fetchHistory(url);
          }, 500);
        }
        
        setQuestion('');
      }
    } catch (error) {
      console.error('Error sending question:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // File upload handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, url = apiUrl) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !url) return;
    
    const file = files[0];
    const formData = new FormData();
    formData.append('file', file);
    
    setUploadStatus('Uploading...');
    
    try {
      const response = await fetch(`${url}/upload-document`, {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const result = await response.json();
        setUploadStatus(`✅ Successfully uploaded ${result.filename}`);
        // Refresh documents list
        fetchDocuments(url);
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
  const activateDocument = async (filename: string, url = apiUrl) => {
    if (serverStatus !== 'online' || !url) return;
    
    try {
      const response = await fetch(`${url}/activate-document/${filename}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        setUploadStatus(`✅ Activated document: ${filename}`);
        // Refresh documents list
        fetchDocuments(url);
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
  const resetMemory = async (url = apiUrl) => {
    if (serverStatus !== 'online' || !url) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${url}/reset-memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Memory reset successful:', data);
        
        // Clear all conversation data
        setHistory([]);
        setSummary('');
        
        // Show confirmation to the user
        setError(''); // Clear any previous error
        
        // Add system message to history
        const systemMessage = { role: 'ai', content: 'Memory has been reset successfully.' };
        setHistory([systemMessage]);
        
        // Refresh history data
        setTimeout(() => {
          fetchHistory(url);
        }, 500);
      } else {
        console.error('Failed to reset memory:', response.status);
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error occurred' }));
        setError(`Failed to reset memory: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error resetting memory:', error);
      setError('Network error when resetting memory. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Format file size
  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Force summary generation
  const generateSummary = async (url = apiUrl) => {
    if (serverStatus !== 'online' || !url) return;
    
    try {
      console.log('Forcing summary generation via:', `${url}/generate-summary`);
      const response = await fetch(`${url}/generate-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Summary generation result:', data);
        
        if (data.summary) {
          setSummary(data.summary);
          setError('Summary generated successfully');
          setTimeout(() => setError(''), 3000);
        } else {
          setError(`Summary generation warning: ${data.message}`);
        }
        
        // Refresh history data
        setTimeout(() => {
          fetchHistory(url);
        }, 500);
      } else {
        console.error('Failed to generate summary:', response.status);
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error occurred' }));
        setError(`Failed to generate summary: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      setError('Network error when generating summary. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white text-gray-800">
      {/* Header */}
      <header className="pt-8 pb-6 text-center">
        <h1 className="text-5xl font-bold text-blue-600 mb-2">RAG Chatbot</h1>
        <p className="text-gray-600 text-lg">Intelligent document-based conversations</p>
        
        {/* Server Status Indicator */}
        <div className="mt-4 flex justify-center">
          <div className={`px-4 py-2 rounded-full text-sm font-medium inline-flex items-center ${
            serverStatus === 'online' ? 'bg-green-100 text-green-700' :
            serverStatus === 'offline' ? 'bg-red-100 text-red-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            <span className={`w-3 h-3 rounded-full mr-2 ${
              serverStatus === 'online' ? 'bg-green-500' :
              serverStatus === 'offline' ? 'bg-red-500' :
              'bg-yellow-500'
            }`}></span>
            {serverStatus === 'online' ? 'Server Online' :
             serverStatus === 'offline' ? 'Server Offline' :
             'Checking Server...'}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar - Documents */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-200">
              <h2 className="text-xl font-semibold mb-4 text-blue-600 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
                Documents
              </h2>
              <div className="space-y-4">
                {/* Upload Button */}
                <div>
                  <label className="block">
                    <div className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-center transition-colors cursor-pointer flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      Upload Document
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".txt,.md,.pdf" 
                      onChange={(e) => {
                        if (apiUrl) handleFileUpload(e, apiUrl);
                      }} 
                    />
                  </label>
                </div>
                
                {/* Upload Status */}
                {uploadStatus && (
                  <div className="text-sm py-2 px-3 rounded bg-gray-100 text-gray-700">
                    {uploadStatus}
                  </div>
                )}
                
                {/* Active Document Info */}
                {activeDocumentName && (
                  <div className="text-sm py-2 px-3 rounded bg-blue-50 text-blue-700">
                    <div className="font-semibold mb-1">Active Document:</div>
                    <div className="truncate">{activeDocumentName}</div>
                  </div>
                )}
                
                {/* Document List */}
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {documents.length > 0 ? (
                    documents.map((doc) => (
                      <div
                        key={doc.filename}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          doc.active
                            ? 'bg-blue-100 border border-blue-200'
                            : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                        }`}
                        onClick={() => !doc.active && apiUrl && activateDocument(doc.filename, apiUrl)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate mr-2 text-sm">{doc.filename}</span>
                          {doc.active && <span className="text-green-600 text-xs">✓</span>}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatFileSize(doc.size)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 text-center py-4 italic">
                      No documents available. Upload one to start.
                    </div>
                  )}
                </div>
                
                {/* Memory Management Button */}
                <button
                  onClick={() => {
                    if (apiUrl) resetMemory(apiUrl);
                  }}
                  className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-center transition-colors flex items-center justify-center"
                  disabled={serverStatus !== 'online'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                  Reset Memory
                </button>
                
                {/* Toggle Debug Panel */}
                <button
                  onClick={() => setShowDebug(!showDebug)}
                  className={`w-full mt-2 px-4 py-2 rounded-lg text-center transition-colors flex items-center justify-center ${
                    showDebug 
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-white' 
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                  {showDebug ? 'Hide Debug Info' : 'Show Debug Info'}
                </button>
              </div>
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="lg:col-span-9">
            <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-200 h-[600px] flex flex-col">
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <p className="text-lg">No conversation yet</p>
                    <p className="text-sm mt-2">Start by asking a question about your document</p>
                  </div>
                ) : (
                  history.map((msg, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg max-w-[85%] message-animation ${
                        msg.role === 'human'
                          ? 'bg-blue-100 border border-blue-200 ml-auto'
                          : 'bg-green-50 border border-green-200'
                      }`}
                    >
                      <div className="text-sm font-medium mb-1 flex items-center">
                        {msg.role === 'human' ? (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                            <span className="text-blue-700">You</span>
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                              <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
                            </svg>
                            <span className="text-green-700">Assistant</span>
                          </>
                        )}
                      </div>
                      <div className="text-gray-700 whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  ))
                )}
                
                {/* Loading indicator */}
                {loading && (
                  <div className="flex items-center justify-center space-x-2 text-gray-500 p-4">
                    <div className="animate-bounce h-2 w-2 bg-blue-500 rounded-full"></div>
                    <div className="animate-bounce h-2 w-2 bg-blue-500 rounded-full animation-delay-200"></div>
                    <div className="animate-bounce h-2 w-2 bg-blue-500 rounded-full animation-delay-400"></div>
                    <span className="ml-2">Thinking...</span>
                  </div>
                )}
              </div>

              {/* Error display */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Input Area */}
              <div className="mt-auto">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (apiUrl) ask(apiUrl);
                  }}
                  className="flex space-x-2"
                >
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask a question..."
                    className="flex-1 p-3 bg-gray-50 border border-gray-300 text-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading || serverStatus !== 'online'}
                  />
                  <button
                    type="submit"
                    disabled={loading || serverStatus !== 'online' || !question.trim()}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center ${
                      loading || serverStatus !== 'online' || !question.trim()
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Send
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Debug Panel */}
        {showDebug && (
          <div className="mt-6 bg-white rounded-xl shadow-lg p-5 border border-gray-200">
            <h2 className="text-xl font-semibold mb-4 text-yellow-600">Debug Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium mb-2 text-gray-700">Conversation Summary</h3>
                <div className="bg-gray-50 p-3 rounded-lg overflow-x-auto text-sm text-gray-700 border border-gray-200 min-h-[100px] whitespace-pre-wrap">
                  {summary ? summary : 'No summary available'}
                  {summary === "" && <div className="text-yellow-600 mt-2">Summary is empty - try asking a few questions to generate a summary</div>}
                </div>
                <div className="mt-2 text-right">
                  <button 
                    onClick={() => {
                      if (apiUrl) generateSummary(apiUrl);
                    }}
                    className="px-4 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-xs font-medium"
                    disabled={loading || serverStatus !== 'online'}
                  >
                    Force Generate Summary
                  </button>
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-2 text-gray-700">Memory Attributes</h3>
                <pre className="bg-gray-50 p-3 rounded-lg overflow-x-auto text-xs text-gray-700 border border-gray-200 min-h-[100px] max-h-[200px]">
                  {JSON.stringify(memoryAttributes, null, 2) || 'No memory attributes available'}
                </pre>
              </div>
            </div>
            
            <div className="mt-4">
              <h3 className="font-medium mb-2 text-gray-700">Chain Attributes</h3>
              <pre className="bg-gray-50 p-3 rounded-lg overflow-x-auto text-xs text-gray-700 border border-gray-200 max-h-[150px]">
                {JSON.stringify(chainAttributes, null, 2) || 'No chain attributes available'}
              </pre>
            </div>
            
            <div className="mt-4">
              <h3 className="font-medium mb-2 text-gray-700">Chat History</h3>
              <div className="bg-gray-50 p-3 rounded-lg overflow-x-auto text-sm text-gray-700 border border-gray-200 max-h-[200px]">
                {history.length > 0 ? (
                  <ol className="list-decimal pl-5 space-y-2">
                    {history.map((msg, idx) => (
                      <li key={idx}>
                        <span className="font-semibold">{msg.role}:</span> {msg.content.substring(0, 100)}{msg.content.length > 100 ? '...' : ''}
                      </li>
                    ))}
                  </ol>
                ) : (
                  'No chat history available'
                )}
              </div>
            </div>
            
            {/* Additional Debug Information */}
            {Object.keys(debugInfo).length > 0 && (
              <div className="mt-4">
                <h3 className="font-medium mb-2 text-gray-700 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 text-yellow-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  System Information
                </h3>
                <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700 border border-gray-200">
                  <table className="w-full text-left">
                    <tbody>
                      {Object.entries(debugInfo).map(([key, value]) => (
                        <tr key={key} className="border-b border-gray-200 last:border-0">
                          <td className="py-2 pr-2 font-medium">{key.replace(/_/g, ' ')}:</td>
                          <td className="py-2">{value !== null ? String(value) : 'null'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            <div className="mt-4 text-right">
              <button 
                onClick={() => {
                  if (apiUrl) resetMemory(apiUrl);
                }}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
              >
                Reset Conversation Memory
              </button>
            </div>
          </div>
        )}
      </main>
      
      <footer className="py-4 text-center text-gray-500 text-sm">
        <p>RAG Chatbot with Memory | Powered by Mistral AI</p>
      </footer>
    </div>
  );
}
