import { useState } from 'react'
import { motion } from 'framer-motion'
import ApperIcon from '@/components/ApperIcon'

const SearchBar = ({ 
  onSearch, 
  placeholder = "Search files...", 
  className = "",
  debounceMs = 300 
}) => {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  const handleInputChange = (e) => {
    const value = e.target.value
    setQuery(value)
    
    // Debounce search
    clearTimeout(window.searchTimeout)
    window.searchTimeout = setTimeout(() => {
      onSearch(value)
    }, debounceMs)
  }

  const handleClear = () => {
    setQuery('')
    onSearch('')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative ${className}`}
    >
      <div className="relative">
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
          <ApperIcon name="Search" className="w-5 h-5 text-gray-400" />
        </div>
        
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={`
            w-full pl-12 pr-12 py-3 
            border-2 border-gray-200 rounded-lg 
            focus:border-aws-blue focus:ring-2 focus:ring-aws-blue/20 
            transition-all duration-200 outline-none
            ${isFocused ? 'shadow-lg' : ''}
          `}
        />
        
        {query && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={handleClear}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 
                     text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <ApperIcon name="X" className="w-5 h-5" />
          </motion.button>
        )}
      </div>
      
      {isFocused && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 rounded-lg bg-gradient-to-r from-aws-blue/10 to-aws-orange/10 -z-10"
        />
      )}
    </motion.div>
  )
}

export default SearchBar