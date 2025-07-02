import { motion } from 'framer-motion'

const ProgressBar = ({ 
  value = 0, 
  max = 100, 
  variant = 'primary',
  size = 'md',
  showLabel = false,
  label = '',
  className = ''
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))

  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'bg-gradient-to-r from-aws-orange to-orange-500'
      case 'success':
        return 'bg-gradient-to-r from-success to-green-500'
      case 'warning':
        return 'bg-gradient-to-r from-warning to-yellow-500'
      case 'error':
        return 'bg-gradient-to-r from-error to-red-500'
      default:
        return 'bg-gradient-to-r from-aws-orange to-orange-500'
    }
  }

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-2'
      case 'md':
        return 'h-3'
      case 'lg':
        return 'h-4'
      default:
        return 'h-3'
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-700 font-medium">{label}</span>
          <span className="text-gray-600">{Math.round(percentage)}%</span>
        </div>
      )}
      
      <div className={`progress-bar bg-gray-200 ${getSizeClasses()}`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`h-full ${getVariantClasses()} rounded-full relative overflow-hidden`}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </motion.div>
      </div>
    </div>
  )
}

export default ProgressBar