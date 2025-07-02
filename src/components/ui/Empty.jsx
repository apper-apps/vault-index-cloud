import { motion } from 'framer-motion'
import ApperIcon from '@/components/ApperIcon'

const Empty = ({ 
  message = "No items found", 
  description = "There are no items to display at the moment",
  action,
  actionLabel = "Get Started",
  icon = "Inbox",
  type = 'default'
}) => {
  const getEmptyContent = () => {
    switch (type) {
      case 'files':
        return {
          icon: 'FolderOpen',
          message: 'No files found',
          description: 'This folder is empty. Upload some files to get started.',
        }
      case 'search':
        return {
          icon: 'Search',
          message: 'No results found',
          description: 'Try adjusting your search terms or browse all files.',
        }
      case 'config':
        return {
          icon: 'Settings',
          message: 'No configuration found',
          description: 'Set up your AWS S3 credentials to start managing files.',
        }
      default:
        return { icon, message, description }
    }
  }

  const content = getEmptyContent()

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
        className="w-20 h-20 bg-gradient-to-br from-aws-blue to-blue-600 rounded-full flex items-center justify-center mb-6 shadow-lg"
      >
        <ApperIcon name={content.icon} className="w-10 h-10 text-white" />
      </motion.div>

      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-2xl font-bold text-gray-900 mb-3"
      >
        {content.message}
      </motion.h3>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-gray-600 mb-8 max-w-md text-lg"
      >
        {content.description}
      </motion.p>

      {action && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onClick={action}
          className="btn-primary flex items-center gap-2 text-lg px-6 py-3"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ApperIcon name="Plus" className="w-5 h-5" />
          {actionLabel}
        </motion.button>
      )}
    </motion.div>
  )
}

export default Empty