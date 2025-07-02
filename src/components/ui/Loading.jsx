import { motion } from 'framer-motion'

const Loading = ({ type = 'default' }) => {
  if (type === 'files') {
    return (
      <div className="space-y-4 p-6">
        {[...Array(8)].map((_, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity, 
              repeatType: 'reverse',
              delay: index * 0.1 
            }}
            className="flex items-center space-x-4 p-3 rounded-lg bg-white/50"
          >
            <div className="w-8 h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded shimmer" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded shimmer" style={{ width: `${60 + Math.random() * 30}%` }} />
              <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 rounded shimmer" style={{ width: `${30 + Math.random() * 20}%` }} />
            </div>
            <div className="w-20 h-3 bg-gradient-to-r from-gray-200 to-gray-300 rounded shimmer" />
            <div className="w-24 h-3 bg-gradient-to-r from-gray-200 to-gray-300 rounded shimmer" />
          </motion.div>
        ))}
      </div>
    )
  }

  if (type === 'config') {
    return (
      <div className="space-y-6 p-6">
        <div className="space-y-4">
          <div className="h-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded shimmer w-48" />
          <div className="space-y-3">
            {[...Array(5)].map((_, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0.6 }}
                animate={{ opacity: 1 }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity, 
                  repeatType: 'reverse',
                  delay: index * 0.1 
                }}
                className="space-y-2"
              >
                <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded shimmer w-32" />
                <div className="h-12 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg shimmer" />
              </motion.div>
            ))}
          </div>
          <div className="h-12 bg-gradient-to-r from-aws-orange/20 to-orange-300/20 rounded-lg shimmer" />
        </div>
      </div>
    )
}

  if (type === 'preview') {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 space-y-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full"
        />
        <p className="text-sm text-gray-600">Loading preview...</p>
      </div>
    )
  }

  if (type === 'share') {
    return (
      <div className="flex flex-col items-center justify-center min-h-32 space-y-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full"
        />
        <p className="text-sm text-gray-600">Generating share link...</p>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-64">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="w-8 h-8 border-3 border-aws-orange border-t-transparent rounded-full"
      />
    </div>
  )
}

export default Loading