import "@/index.css";
import { Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import React, { useEffect, useState } from "react";
import ErrorComponent from "@/components/ui/Error";
import S3Manager from "@/components/pages/S3Manager";

// Enhanced safe serialization function to handle complex objects and prevent DataCloneError
function safeSerialize(data, visited = new WeakSet()) {
try {
    // Handle null/undefined/primitives
    if (data === null || data === undefined || typeof data !== 'object') {
      return data;
    }
    
    // Handle circular references
    if (visited.has(data)) {
      return '[Circular Reference]';
    }
    visited.add(data);
    
    // Handle non-cloneable types comprehensively
    if (data instanceof Request) {
      return { 
        __type: 'Request', 
        url: data.url, 
        method: data.method,
        headers: data.headers ? Object.fromEntries(data.headers) : {}
      };
    }
    
    if (data instanceof Response) {
      return { 
        __type: 'Response', 
        status: data.status, 
        statusText: data.statusText,
        url: data.url,
        ok: data.ok
      };
    }
    
    if (data instanceof Promise) {
      return { __type: 'Promise', state: 'pending' };
    }
    
    if (typeof data === 'function') {
      return { __type: 'Function', name: data.name || 'anonymous' };
    }
    
    if (data instanceof Error) {
      return { 
        __type: 'Error', 
        name: data.name, 
        message: data.message,
        stack: data.stack ? data.stack.split('\n').slice(0, 3).join('\n') : undefined
      };
    }
    
    if (data instanceof File) {
      return { 
        __type: 'File', 
        name: data.name, 
        size: data.size, 
        type: data.type,
        lastModified: data.lastModified
      };
    }
    
    if (data instanceof Date) {
      return { __type: 'Date', value: data.toISOString() };
    }
    
    // Handle DOM elements
    if (data instanceof Element) {
      return { 
        __type: 'Element', 
        tagName: data.tagName,
        id: data.id,
        className: data.className
      };
    }
    
    // Handle other non-cloneable objects
    if (data instanceof RegExp) {
      return { __type: 'RegExp', pattern: data.source, flags: data.flags };
    }
    
    if (data instanceof Map) {
      return { __type: 'Map', entries: Array.from(data.entries()) };
    }
    
    if (data instanceof Set) {
      return { __type: 'Set', values: Array.from(data.values()) };
    }
    
    if (data instanceof FormData) {
      return { __type: 'FormData', entries: Array.from(data.entries()) };
    }
    
    if (data instanceof ArrayBuffer) {
      return { __type: 'ArrayBuffer', byteLength: data.byteLength };
    }
    
    // Handle arrays
    if (Array.isArray(data)) {
      return data.map(item => safeSerialize(item, visited));
    }
    
    // Handle objects
    const serialized = {};
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        try {
          serialized[key] = safeSerialize(data[key], visited);
        } catch (error) {
          console.warn(`Failed to serialize property ${key}:`, error);
          serialized[key] = '[Serialization Error]';
        }
      }
    }
    
    return serialized;
  } catch (error) {
    console.error('Serialization error:', error);
    return { error: 'Serialization failed', originalType: typeof data };
  }
}
// Enhanced safe postMessage wrapper with comprehensive error handling
function safePostMessage(targetWindow, data, targetOrigin = "*") {
  if (!targetWindow || !targetWindow.postMessage) {
    console.warn('Target window not available for postMessage');
    return false;
  }
  
  try {
    const serializedData = safeSerialize(data);
    
    // Additional validation to ensure data is truly serializable
    const testSerialization = JSON.stringify(serializedData);
    JSON.parse(testSerialization); // This will throw if there are issues
    
    targetWindow.postMessage(serializedData, targetOrigin);
    return true;
  } catch (error) {
    console.error('Failed to send message via postMessage:', error);
    
    // Fallback: send minimal safe data
    try {
      const fallbackData = {
        __type: 'FallbackMessage',
        originalType: typeof data,
        error: 'Serialization failed',
        timestamp: Date.now()
      };
      targetWindow.postMessage(fallbackData, targetOrigin);
    } catch (fallbackError) {
      console.error('Even fallback postMessage failed:', fallbackError);
    }
    
    return false;
  }
}
// Enhanced error handler for postMessage events
function handlePostMessageError(event) {
  console.error('PostMessage error event:', event);
  
  // Check for DataCloneError patterns
  if (event.error && event.error.name === 'DataCloneError') {
    console.error('DataCloneError detected in postMessage communication');
    
    // Attempt to send a safe error notification
    try {
      if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({
          type: 'APPER_DATACLONE_ERROR',
          error: 'Communication failed due to non-serializable data',
          timestamp: Date.now()
        }, '*');
      }
    } catch (notificationError) {
      console.error('Failed to send DataCloneError notification:', notificationError);
    }
  }
  
  // Log detailed error information
  if (event.data && event.data.__type === 'FallbackMessage') {
    console.warn('Received fallback message due to serialization issues');
  }
  
  // Notify user of communication issues
  if (window.toast) {
    window.toast.error('Communication error with Apper. Please try again.');
  }
}
// Initialize error handling for postMessage
if (typeof window !== 'undefined') {
  window.addEventListener('messageerror', handlePostMessageError);
}

function App() {
  const [apperReady, setApperReady] = useState(false);
  const [apperError, setApperError] = useState(null);

  useEffect(() => {
    let script = null;
    let timeoutId = null;
    let isComponentMounted = true;

    const initializeApper = async () => {
      try {
        // Validate environment variables
        const sdkUrl = import.meta.env.VITE_APPER_SDK_CDN_URL;
        const projectId = import.meta.env.VITE_APPER_PROJECT_ID;
        const publicKey = import.meta.env.VITE_APPER_PUBLIC_KEY;

        if (!sdkUrl || !projectId || !publicKey) {
          throw new Error('Missing required Apper configuration. Please check your environment variables.');
        }

        script = document.createElement('script');
        script.src = sdkUrl;
        script.async = true;
        
        // Set up timeout for script loading
        timeoutId = setTimeout(() => {
          if (isComponentMounted) {
            console.error('Apper SDK loading timeout');
            setApperError(new Error('Apper SDK failed to load within timeout period'));
          }
        }, 15000); // 15 second timeout

        script.onload = async () => {
          if (!isComponentMounted) return;

          try {
            // Clear the loading timeout
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }

            // Poll for SDK availability with timeout
            const pollForSDK = async (maxAttempts = 50, interval = 200) => {
              for (let i = 0; i < maxAttempts; i++) {
                if (!isComponentMounted) return false;
                
                if (window.Apper && typeof window.Apper.init === 'function') {
                  return true;
                }
                
                await new Promise(resolve => setTimeout(resolve, interval));
              }
              return false;
            };

            const sdkReady = await pollForSDK();
            
            if (!sdkReady) {
              throw new Error('Apper SDK not available after polling. The SDK may have failed to initialize properly.');
            }

            // Initialize the SDK
            await window.Apper.init({
              projectId: projectId,
              publicKey: publicKey,
              postMessage: (data, targetOrigin) => {
                return safePostMessage(window, data, targetOrigin);
              },
              onError: (error) => {
                console.error('Apper runtime error:', error);
                if (isComponentMounted) {
                  setApperError(error);
                }
              },
              onReady: () => {
                console.log('Apper SDK initialized successfully');
                if (isComponentMounted) {
                  setApperReady(true);
                }
              }
            });

          } catch (error) {
            console.error('Apper initialization error:', error);
            if (isComponentMounted) {
              setApperError(new Error(`Apper initialization failed: ${error.message || error}`));
            }
          }
        };
        
        script.onerror = (error) => {
          if (!isComponentMounted) return;
          
          console.error('Failed to load Apper SDK:', error);
          
          // Clear timeout on error
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          
          setApperError(new Error(`Failed to load Apper SDK from ${sdkUrl}. Please check your internet connection and try again.`));
        };
        
        document.head.appendChild(script);
        
      } catch (error) {
        console.error('Error initializing Apper:', error);
        if (isComponentMounted) {
          setApperError(new Error(`Apper setup failed: ${error.message || error}`));
        }
      }
    };

    initializeApper();

    // Cleanup function
    return () => {
      isComponentMounted = false;
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    const handlePostMessageError = (event) => {
      if (event.data && event.data.type === 'APPER_ERROR') {
        console.error('Apper postMessage error:', event.data.error);
        setApperError(event.data.error);
      } else if (event.data && event.data.type === 'APPER_SERIALIZATION_ERROR') {
        console.error('Apper serialization error - data could not be cloned');
        setApperError('Communication error: Data serialization failed');
      } else if (event.data && event.data.type === 'APPER_DATACLONE_ERROR') {
        console.error('DataCloneError detected in postMessage');
        setApperError('Communication error: Unable to send data to integration service');
      }
    };

    window.safePostMessage = safePostMessage;
    window.safeSerialize = safeSerialize;
    window.addEventListener('message', handlePostMessageError);
    
    return () => {
      delete window.safePostMessage;
      delete window.safeSerialize;
      window.removeEventListener('message', handlePostMessageError);
    };
  }, []);

if (apperError) {
    return <ErrorComponent message={`Apper initialization failed: ${apperError.message || apperError}`} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-aws-gray via-white to-gray-50">
      {apperError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 mx-4 mt-4">
          <strong>Integration Warning:</strong> {apperError}
        </div>
      )}
      
      <Routes>
        <Route path="/" element={<S3Manager apperReady={apperReady} />} />
      </Routes>
      
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
        style={{ zIndex: 9999 }}
      />
    </div>
  );
}

export default App;