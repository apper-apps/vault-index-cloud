import { motion } from 'framer-motion'
import ApperIcon from '@/components/ApperIcon'

const Error = ({ message = "Something went wrong", onRetry, type = 'default' }) => {
  const getErrorIcon = () => {
    switch (type) {
      case 'connection':
        return 'WifiOff'
      case 'auth':
        return 'ShieldAlert'
      case 'file':
        return 'FileX'
      case 'preview':
        return 'Eye'
      case 'share':
        return 'Share2'
      default:
        return 'AlertTriangle'
    }
  }

const getErrorTitle = () => {
    switch (type) {
      case 'connection':
        return 'Connection Failed'
      case 'auth':
        return 'Authentication Error'
      case 'file':
        return 'File Operation Failed'
      case 'preview':
        return 'Preview Failed'
      case 'share':
        return 'Share Failed'
      default:
        return 'Error Occurred'
    }
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center min-h-64 p-6 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
        className="w-16 h-16 bg-gradient-to-br from-error to-red-600 rounded-full flex items-center justify-center mb-4 shadow-lg"
      >
        <ApperIcon name={getErrorIcon()} className="w-8 h-8 text-white" />
      </motion.div>

      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-xl font-bold text-gray-900 mb-2"
      >
        {getErrorTitle()}
      </motion.h3>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-gray-600 mb-6 max-w-md"
      >
        {message}
      </motion.p>

      {onRetry && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          onClick={onRetry}
          className="btn-primary flex items-center gap-2"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ApperIcon name="RefreshCw" className="w-4 h-4" />
          Try Again
        </motion.button>
      )}
    </motion.div>
  )
}

export default Error