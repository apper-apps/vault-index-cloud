import { Routes, Route } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import S3Manager from '@/components/pages/S3Manager'

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-aws-gray via-white to-gray-50">
      <Routes>
        <Route path="/" element={<S3Manager />} />
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