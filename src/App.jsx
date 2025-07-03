import "@/index.css";
import { Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import React, { useEffect, useState } from "react";
import ErrorComponent from "@/components/ui/Error";
import S3Manager from "@/components/pages/S3Manager";

// Simple postMessage wrapper that only sends basic data types
function safePostMessage(targetWindow, data, targetOrigin = "*") {
  if (targetWindow && targetWindow.postMessage) {
    try {
      // Deep serialize data to handle complex objects and prevent DataCloneError
      const safeData = deepSerialize(data);
      targetWindow.postMessage(safeData, targetOrigin);
    } catch (error) {
      console.warn('Failed to send message:', error);
      // Fallback with minimal safe data
      try {
        targetWindow.postMessage({
          type: 'error',
          message: 'Communication error occurred',
          timestamp: Date.now()
        }, targetOrigin);
      } catch (fallbackError) {
        console.error('Complete postMessage failure:', fallbackError);
      }
    }
  }
}

// Helper function to safely serialize objects
function serializeObject(obj, visited = new WeakSet()) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  // Prevent circular references
  if (visited.has(obj)) {
    return '[Circular Reference]';
  }
  visited.add(obj);
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => serializeObject(item, visited));
  }
  
  // Handle special objects that can't be cloned
  if (obj instanceof Request || obj instanceof Response || 
      obj instanceof File || obj instanceof Blob ||
      typeof obj === 'function' || obj instanceof Error) {
    return {
      type: obj.constructor.name,
      toString: obj.toString ? obj.toString() : '[Object]'
    };
  }
  
  // Handle Date objects
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  // Handle regular objects
  const result = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      try {
        result[key] = serializeObject(obj[key], visited);
      } catch (error) {
        result[key] = '[Unserializable]';
      }
    }
  }
  
  return result;
}

// Deep serialize with additional safety checks
function deepSerialize(data) {
  try {
    // First attempt: JSON round-trip to catch most issues
    const jsonString = JSON.stringify(data);
    return JSON.parse(jsonString);
  } catch (error) {
    // Fallback: manual serialization
    return serializeObject(data);
  }
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
        const sdkUrl = import.meta.env.VITE_APPER_SDK_CDN_URL;
        const projectId = import.meta.env.VITE_APPER_PROJECT_ID;
        const publicKey = import.meta.env.VITE_APPER_PUBLIC_KEY;

        if (!sdkUrl || !projectId || !publicKey) {
          console.warn('Apper configuration not found - running in standalone mode');
          setApperReady(true);
          return;
        }

        script = document.createElement('script');
        script.src = sdkUrl;
        script.async = true;
        
        timeoutId = setTimeout(() => {
          if (isComponentMounted) {
            console.error('Apper SDK loading timeout');
            setApperReady(true); // Continue without Apper
          }
        }, 10000);

        script.onload = async () => {
          if (!isComponentMounted) return;

          try {
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }

            if (window.Apper && typeof window.Apper.init === 'function') {
              await window.Apper.init({
                projectId: projectId,
                publicKey: publicKey,
                postMessage: safePostMessage,
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
            } else {
              setApperReady(true);
            }

          } catch (error) {
            console.error('Apper initialization error:', error);
            if (isComponentMounted) {
              setApperReady(true); // Continue without Apper
            }
          }
        };
        
        script.onerror = () => {
          if (!isComponentMounted) return;
          
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          
          console.warn('Failed to load Apper SDK - continuing in standalone mode');
          setApperReady(true);
        };
        
        document.head.appendChild(script);
        
      } catch (error) {
        console.error('Error initializing Apper:', error);
        if (isComponentMounted) {
          setApperReady(true); // Continue without Apper
        }
      }
    };

    initializeApper();

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

  if (apperError) {
    return <ErrorComponent message={`Apper initialization failed: ${apperError.message || apperError}`} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-aws-gray via-white to-gray-50">
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