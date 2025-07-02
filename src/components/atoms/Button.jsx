import { motion } from 'framer-motion'
import ApperIcon from '@/components/ApperIcon'

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  icon, 
  iconPosition = 'left',
  loading = false,
  disabled = false,
  onClick,
  className = '',
  ...props 
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'btn-primary'
      case 'secondary':
        return 'btn-secondary'
      case 'outline':
        return 'btn-outline'
      case 'danger':
        return 'btn-danger'
      case 'ghost':
        return 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 font-medium px-4 py-2 rounded-lg transition-all duration-200'
      default:
        return 'btn-primary'
    }
  }

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-sm'
      case 'md':
        return 'px-4 py-2 text-base'
      case 'lg':
        return 'px-6 py-3 text-lg'
      default:
        return 'px-4 py-2 text-base'
    }
  }

  const buttonClasses = `
    ${getVariantClasses()} 
    ${getSizeClasses()} 
    ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''} 
    ${className}
  `.trim()

  return (
    <motion.button
      whileHover={!disabled && !loading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      onClick={!disabled && !loading ? onClick : undefined}
      disabled={disabled || loading}
      className={buttonClasses}
      {...props}
    >
      <div className="flex items-center justify-center gap-2">
        {loading && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <ApperIcon name="Loader2" className="w-4 h-4" />
          </motion.div>
        )}
        
        {!loading && icon && iconPosition === 'left' && (
          <ApperIcon name={icon} className="w-4 h-4" />
        )}
        
        {children}
        
        {!loading && icon && iconPosition === 'right' && (
          <ApperIcon name={icon} className="w-4 h-4" />
        )}
      </div>
    </motion.button>
  )
}

export default Button