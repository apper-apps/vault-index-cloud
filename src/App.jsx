import { Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import React, { useEffect, useState } from "react";
import "@/index.css";
import Error from "@/components/ui/Error";
import S3Manager from "@/components/pages/S3Manager";

function App() {
  const [apperReady, setApperReady] = useState(false)
  const [apperError, setApperError] = useState(null)
// Helper function to safely serialize data for postMessage
  const safeSerialize = (data) => {
    try {
      // Handle common non-serializable objects
      const serialize = (obj) => {
        if (obj === null || obj === undefined) return obj
        if (typeof obj === 'function') return '[Function]'
        if (obj instanceof Error) return { name: obj.name, message: obj.message, stack: obj.stack }
        if (obj instanceof Request || obj instanceof Response) return '[Request/Response Object]'
        if (obj instanceof File) return { name: obj.name, size: obj.size, type: obj.type }
        if (obj instanceof Date) return obj.toISOString()
        if (obj instanceof RegExp) return obj.toString()
        
        if (Array.isArray(obj)) {
          return obj.map(serialize)
        }
        
        if (typeof obj === 'object') {
          const seen = new WeakSet()
          const serializeObject = (o) => {
            if (seen.has(o)) return '[Circular Reference]'
            seen.add(o)
            
            const result = {}
            for (const [key, value] of Object.entries(o)) {
              try {
                result[key] = serialize(value)
              } catch (e) {
                result[key] = '[Unserializable]'
              }
            }
            return result
          }
          return serializeObject(obj)
        }
        
        return obj
      }
      
      return serialize(data)
    } catch (error) {
      console.warn('Serialization failed:', error)
      return { error: 'Serialization failed', originalType: typeof data }
    }
  }

  useEffect(() => {
    // Initialize Apper SDK
    const initializeApper = async () => {
      try {
        // Load Apper SDK script
        const script = document.createElement('script')
        script.src = import.meta.env.VITE_APPER_SDK_CDN_URL
        script.async = true
        
        script.onload = async () => {
          try {
            if (window.Apper) {
              await window.Apper.init({
                integrationId: 'your-integration-id',
                onError: (error) => {
                  console.error('Apper SDK Error:', error)
                  const safeError = safeSerialize(error)
                  setApperError(safeError.message || safeError.error || 'Apper initialization failed')
                },
                onReady: () => {
                  console.log('Apper SDK initialized successfully')
                  setApperReady(true)
                },
                // Add postMessage wrapper to ensure safe serialization
                postMessage: (data, targetOrigin) => {
                  try {
                    const serializedData = safeSerialize(data)
                    window.postMessage(serializedData, targetOrigin)
                  } catch (error) {
                    console.error('PostMessage serialization error:', error)
                    if (error.name === 'DataCloneError') {
                      console.warn('Data contains non-cloneable objects, attempting fallback')
                      window.postMessage({ error: 'Data serialization failed', type: 'APPER_SERIALIZATION_ERROR' }, targetOrigin)
                    }
                  }
                }
              })
            }
          } catch (error) {
            console.error('Failed to initialize Apper SDK:', error)
            setApperError(error.message || 'SDK initialization failed')
          }
        }
        
        script.onerror = () => {
          setApperError('Failed to load Apper SDK')
        }
        
        document.head.appendChild(script)
        
        // Cleanup function
        return () => {
          if (document.head.contains(script)) {
            document.head.removeChild(script)
          }
        }
      } catch (error) {
        console.error('Error initializing Apper:', error)
        setApperError(error.message)
      }
    }

    initializeApper()
  }, [])
// Add global error handler for postMessage errors
  useEffect(() => {
    const handlePostMessageError = (event) => {
      if (event.data && event.data.type === 'APPER_ERROR') {
        console.error('Apper postMessage error:', event.data.error)
        setApperError(event.data.error)
      } else if (event.data && event.data.type === 'APPER_SERIALIZATION_ERROR') {
        console.error('Apper serialization error - data could not be cloned')
        setApperError('Communication error: Data serialization failed')
      } else if (event.data && event.data.type === 'APPER_DATACLONE_ERROR') {
        console.error('DataCloneError detected in postMessage')
        setApperError('Communication error: Unable to send data to integration service')
      }
    }

    // Enhanced postMessage wrapper for the entire app
    const safePostMessage = (targetWindow, data, targetOrigin = '*') => {
      try {
        const serializedData = safeSerialize(data)
        targetWindow.postMessage(serializedData, targetOrigin)
      } catch (error) {
        console.error('SafePostMessage error:', error)
        if (error.name === 'DataCloneError') {
          // Fallback: send minimal error data
          targetWindow.postMessage({
            type: 'APPER_DATACLONE_ERROR',
            error: 'Data contains non-cloneable objects',
            timestamp: Date.now()
          }, targetOrigin)
        }
      }
    }

    // Make safePostMessage available globally for other components
    window.safePostMessage = safePostMessage
    window.addEventListener('message', handlePostMessageError)
    
    return () => {
      delete window.safePostMessage
      window.removeEventListener('message', handlePostMessageError)
    }
  }, [safeSerialize])
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
  )
}

export default App