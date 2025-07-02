import { motion } from 'framer-motion'
import ApperIcon from '@/components/ApperIcon'

const StatusIndicator = ({ 
  status = 'inactive', 
  label, 
  showIcon = true,
  className = ""
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'active':
        return {
          color: 'text-success',
          bgColor: 'bg-success',
          icon: 'CheckCircle',
          text: 'Connected'
        }
      case 'connecting':
        return {
          color: 'text-warning',
          bgColor: 'bg-warning',
          icon: 'Loader2',
          text: 'Connecting...'
        }
      case 'error':
        return {
          color: 'text-error',
          bgColor: 'bg-error',
          icon: 'AlertCircle',
          text: 'Error'
        }
      case 'inactive':
      default:
        return {
          color: 'text-gray-400',
          bgColor: 'bg-gray-400',
          icon: 'Circle',
          text: 'Disconnected'
        }
    }
  }

  const config = getStatusConfig()
  const displayText = label || config.text

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showIcon && (
        <div className="relative">
          <div className={`status-dot ${status} ${config.bgColor}`} />
          {status === 'active' && (
            <motion.div
              animate={{ scale: [1, 1.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-success rounded-full opacity-20"
            />
          )}
        </div>
      )}
      
      <span className={`text-sm font-medium ${config.color}`}>
        {displayText}
      </span>
      
      {status === 'connecting' && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <ApperIcon name="Loader2" className="w-4 h-4 text-warning" />
        </motion.div>
      )}
    </div>
  )
}

export default StatusIndicator