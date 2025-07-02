import { Routes, Route } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import { useEffect, useState } from 'react'
import S3Manager from '@/components/pages/S3Manager'

function App() {
  const [apperReady, setApperReady] = useState(false)
  const [apperError, setApperError] = useState(null)

  useEffect(() => {
    // Initialize Apper SDK
    const initializeApper = async () => {
      try {
        // Load Apper SDK script
        const script = document.createElement('script')
        script.src = import.meta.env.VITE_APPER_SDK_CDN_URL
        script.async = true
        
        script.onload = () => {
          // Initialize Apper with proper error handling
if (window.Apper) {
            try {
              window.Apper.init({
                projectId: import.meta.env.VITE_APPER_PROJECT_ID,
                publicKey: import.meta.env.VITE_APPER_PUBLIC_KEY,
                onError: (error) => {
                  console.error('Apper SDK Error:', error)
                  setApperError(error.message || 'Apper initialization failed')
                },
                onReady: () => {
                  console.log('Apper SDK initialized successfully')
                  setApperReady(true)
                }
              })
            } catch (initError) {
              console.error('Apper initialization error:', initError)
              setApperError(initError.message)
            }
          } else {
            setApperError('Apper SDK not loaded')
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
      }
    }

    window.addEventListener('message', handlePostMessageError)
    
    return () => {
      window.removeEventListener('message', handlePostMessageError)
    }
  }, [])

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