import "@/index.css";
import { Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import React, { useEffect, useState } from "react";
import Error from "@/components/ui/Error";
import S3Manager from "@/components/pages/S3Manager";

function App() {
  const [apperReady, setApperReady] = useState(false)
  const [apperError, setApperError] = useState(null)
// Helper function to safely serialize data for postMessage
const safeSerialize = (data) => {
    try {
      // Global seen set to track circular references across all levels
      const seen = new WeakSet()
      
      const serialize = (obj) => {
        if (obj === null || obj === undefined) return obj
        
        // Handle primitives first
        if (typeof obj !== 'object') {
          if (typeof obj === 'function') return '[Function]'
          if (typeof obj === 'symbol') return '[Symbol]'
          if (typeof obj === 'bigint') return obj.toString()
          return obj
        }
        
        // Check for circular references
        if (seen.has(obj)) return '[Circular Reference]'
        seen.add(obj)
        
        // Handle built-in objects that can cause DataCloneError
        if (obj instanceof Error) return { name: obj.name, message: obj.message, stack: obj.stack }
        if (obj instanceof Date) return obj.toISOString()
        if (obj instanceof RegExp) return obj.toString()
        if (obj instanceof File) return { name: obj.name, size: obj.size, type: obj.type, lastModified: obj.lastModified }
        if (obj instanceof Blob) return { size: obj.size, type: obj.type }
        
        // Handle objects that definitely cannot be cloned
        if (obj instanceof Request || obj instanceof Response) return '[Request/Response Object]'
        if (obj instanceof Promise) return '[Promise Object]'
        if (obj instanceof WeakMap || obj instanceof WeakSet) return '[WeakMap/WeakSet Object]'
        if (obj instanceof ArrayBuffer) return '[ArrayBuffer]'
        if (ArrayBuffer.isView(obj)) return '[TypedArray/DataView]'
        
        // Handle DOM objects
        if (typeof Window !== 'undefined' && obj instanceof Window) return '[Window Object]'
        if (typeof Document !== 'undefined' && obj instanceof Document) return '[Document Object]'
        if (typeof Element !== 'undefined' && obj instanceof Element) return '[DOM Element]'
        if (typeof Node !== 'undefined' && obj instanceof Node) return '[DOM Node]'
        if (typeof Event !== 'undefined' && obj instanceof Event) return '[Event Object]'
        
        // Handle Proxy objects
        try {
          if (obj.constructor && obj.constructor.name === 'Object' && Object.getPrototypeOf(obj) !== Object.prototype) {
            return '[Proxy/Complex Object]'
          }
        } catch (e) {
          return '[Unserializable Object]'
        }
        
        // Handle arrays
        if (Array.isArray(obj)) {
          return obj.map(item => {
            try {
              return serialize(item)
            } catch (e) {
              console.warn('Failed to serialize array item:', e)
              return '[Unserializable Item]'
            }
          })
        }
        
        // Handle plain objects
        const result = {}
        try {
          for (const [key, value] of Object.entries(obj)) {
            try {
              result[key] = serialize(value)
            } catch (e) {
              console.warn(`Failed to serialize property ${key}:`, e)
              result[key] = '[Unserializable Property]'
            }
          }
        } catch (e) {
          return '[Object Enumeration Failed]'
        }
        
        return result
      }
      
      const serialized = serialize(data)
      
      // Final validation - attempt JSON stringify to ensure it's truly serializable
      try {
        JSON.stringify(serialized)
      } catch (e) {
        console.warn('Serialized data still not JSON compatible:', e)
        return { error: 'Final serialization check failed', originalType: typeof data }
      }
      
      return serialized
    } catch (error) {
      console.warn('Critical serialization failure:', error)
      return { error: 'Serialization failed', originalType: typeof data, timestamp: new Date().toISOString() }
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