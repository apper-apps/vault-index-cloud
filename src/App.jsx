import "@/index.css";
import { Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import React, { useEffect, useState } from "react";
import ErrorComponent from "@/components/ui/Error";
import S3Manager from "@/components/pages/S3Manager";
// Enhanced safe serialization function to handle complex objects and prevent DataCloneError
function safeSerialize(data, visited = new WeakSet()) {
  try {
    // Handle null/undefined/primitives first
    if (data === null || data === undefined) return data;
    
    // Handle primitives - exclude problematic types
    if (typeof data !== 'object') {
      if (typeof data === 'function' || typeof data === 'symbol' || typeof data === 'undefined') {
        return null; // Return null instead of string representation to avoid cloning issues
      }
      // Handle bigint
      if (typeof data === 'bigint') {
        return data.toString();
      }
      return data;
    }
    
    // Handle circular references
    if (visited.has(data)) {
      return null; // Return null instead of string to avoid cloning issues
    }
    visited.add(data);
    
    // Handle Date objects first (before general object checking)
    if (data instanceof Date) {
      return data.toISOString();
    }
    
    // Handle all non-cloneable Web API objects comprehensively
    if (data instanceof Request || data instanceof Response || 
        data instanceof FormData || data instanceof File || 
        data instanceof Blob || data instanceof ArrayBuffer ||
        data instanceof Element || data instanceof Node ||
        data instanceof Error || data instanceof RegExp ||
        data instanceof Map || data instanceof Set ||
        data instanceof Promise || data instanceof WeakMap ||
        data instanceof WeakSet || data instanceof SharedArrayBuffer ||
        data.constructor?.name?.includes('Request') ||
        data.constructor?.name?.includes('Response') ||
        data.constructor?.name?.includes('Element') ||
        data.constructor?.name?.includes('HTML') ||
        data.constructor?.name?.includes('SVG') ||
        data.nodeType !== undefined || // DOM nodes
        data.window !== undefined || // Window objects
        typeof data.then === 'function' || // Promises and thenables
        data.constructor?.name?.includes('Stream') // Streams
      ) {
      return null; // Return null to completely avoid serialization
    }
    
    // Handle Arrays
    if (Array.isArray(data)) {
      const cleaned = data.map(item => safeSerialize(item, visited))
                        .filter(item => item !== null && item !== undefined);
      visited.delete(data);
      return cleaned;
    }
    
    // Handle plain objects - only process enumerable own properties
    const result = {};
    
    try {
      // Use Object.entries for better safety
      for (const [key, value] of Object.entries(data)) {
        // Skip non-string keys
        if (typeof key !== 'string') continue;
        
        const serializedValue = safeSerialize(value, visited);
        if (serializedValue !== null && serializedValue !== undefined) {
          result[key] = serializedValue;
        }
      }
    } catch (error) {
      console.warn('Error during object serialization:', error);
      visited.delete(data);
      return null;
    }
    
    visited.delete(data);
    return result;
  } catch (error) {
    console.error('Critical serialization error:', error);
    return null; // Return null instead of error object to avoid further issues
  }
}
// Enhanced safe postMessage wrapper with comprehensive error handling
function safePostMessage(targetWindow, data, targetOrigin = "*") {
  if (!targetWindow || !targetWindow.postMessage) {
    console.warn('Target window not available for postMessage');
    return false;
  }
  
  try {
    console.log('Attempting to send postMessage with data:', typeof data, data);
    const serializedData = safeSerialize(data);
    
// Additional validation to ensure data is truly serializable
    const testSerialization = JSON.stringify(serializedData);
    JSON.parse(testSerialization); // This will throw if there are issues
    
    console.log('Sending serialized data via postMessage:', serializedData);
    targetWindow.postMessage(serializedData, targetOrigin);
    console.log('PostMessage sent successfully');
    return true;
  } catch (error) {
    console.error('Failed to send message via postMessage:', error);
    console.error('Original data type:', typeof data);
    console.error('Serialization attempt result:', typeof serializedData);
    
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

    // Enhanced safePostMessage with comprehensive error handling
    const enhancedSafePostMessage = (targetWindow, data, targetOrigin = '*') => {
      try {
        // First, serialize the data
        const serializedData = safeSerialize(data);
        
        // Validate serialized data
        if (serializedData === null || serializedData === undefined) {
          console.warn('Data serialization resulted in null/undefined, skipping postMessage');
          return false;
        }
        
        // Test JSON serialization as final validation
        const testSerialization = JSON.stringify(serializedData);
        if (testSerialization === undefined) {
          console.warn('Final JSON serialization failed, skipping postMessage');
          return false;
        }
        
        // Send the message
        targetWindow.postMessage(serializedData, targetOrigin);
        return true;
      } catch (error) {
        console.error('SafePostMessage failed:', error);
        
        // Handle specific DataCloneError
        if (error.name === 'DataCloneError' || error.message.includes('DataCloneError')) {
          console.error('DataCloneError detected - attempting minimal fallback');
          try {
            // Send minimal error notification
            targetWindow.postMessage({
              type: 'SERIALIZATION_ERROR',
              error: 'DataCloneError',
              timestamp: Date.now()
            }, targetOrigin);
          } catch (fallbackError) {
            console.error('Even minimal fallback failed:', fallbackError);
          }
        }
        
        return false;
      }
    };

    window.safePostMessage = enhancedSafePostMessage;
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