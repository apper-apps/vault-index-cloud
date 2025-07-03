import React, { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "react-toastify";
import ApperIcon from "@/components/ApperIcon";
import ProgressBar from "@/components/atoms/ProgressBar";
import Button from "@/components/atoms/Button";
import Error from "@/components/ui/Error";
import s3Service from "@/services/api/s3Service";
// Comprehensive serialization function for safe postMessage communication
function serializeForPostMessage(data, visited = new WeakSet()) {
  try {
    // Handle null/undefined/primitives first
    if (data === null || data === undefined) return data;
    
    // Handle primitives - exclude problematic types
    if (typeof data !== 'object') {
      if (typeof data === 'function' || typeof data === 'symbol' || typeof data === 'undefined') {
        return null; // Return null instead of string representation
      }
      // Handle bigint
      if (typeof data === 'bigint') {
        return data.toString();
      }
      return data;
    }
    
    // Handle circular references
    if (visited.has(data)) {
      return null; // Return null instead of string to avoid cloning issues
    }
    visited.add(data);
    
    // Handle Date objects first (before general object checking)
    if (data instanceof Date) {
      return data.toISOString();
    }
    
    // Comprehensive detection of all non-cloneable Web API objects and DOM elements
    if (
      // Core Web API objects
      (typeof Request !== 'undefined' && data instanceof Request) || 
      (typeof Response !== 'undefined' && data instanceof Response) || 
      (typeof FormData !== 'undefined' && data instanceof FormData) || 
      (typeof File !== 'undefined' && data instanceof File) || 
      (typeof Blob !== 'undefined' && data instanceof Blob) || 
      (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) ||
      (typeof SharedArrayBuffer !== 'undefined' && data instanceof SharedArrayBuffer) ||
      
      // DOM elements and nodes
      (typeof Element !== 'undefined' && data instanceof Element) || 
      (typeof Node !== 'undefined' && data instanceof Node) ||
      (typeof HTMLElement !== 'undefined' && data instanceof HTMLElement) ||
      (typeof SVGElement !== 'undefined' && data instanceof SVGElement) ||
      data.nodeType !== undefined || // Any DOM node
      data.window !== undefined || // Window objects
      
      // Other problematic types
      data instanceof Error || data instanceof RegExp ||
      data instanceof Map || data instanceof Set ||
      data instanceof Promise || data instanceof WeakMap ||
      data instanceof WeakSet || 
      typeof data.then === 'function' || // Promises and thenables
      
      // Stream objects
      (typeof ReadableStream !== 'undefined' && data instanceof ReadableStream) ||
      (typeof WritableStream !== 'undefined' && data instanceof WritableStream) ||
      (typeof TransformStream !== 'undefined' && data instanceof TransformStream) ||
      
      // Constructor name pattern matching for safety
      data.constructor?.name?.includes('Request') ||
      data.constructor?.name?.includes('Response') ||
      data.constructor?.name?.includes('Element') ||
      data.constructor?.name?.includes('HTML') ||
      data.constructor?.name?.includes('SVG') ||
      data.constructor?.name?.includes('Stream') ||
      data.constructor?.name?.includes('Buffer') ||
      
      // Event objects
      (typeof Event !== 'undefined' && data instanceof Event) ||
      data.constructor?.name?.includes('Event')
    ) {
      return null; // Return null to completely avoid serialization
    }
    
    // Handle Arrays
    if (Array.isArray(data)) {
      const cleaned = data.map(item => serializeForPostMessage(item, visited))
                        .filter(item => item !== null && item !== undefined);
      visited.delete(data);
      return cleaned;
    }
    
    // Handle plain objects - only process enumerable own properties
    const result = {};
    
    try {
      // Use Object.entries for better safety
      for (const [key, value] of Object.entries(data)) {
        // Skip non-string keys
        if (typeof key !== 'string') continue;
        
        const serializedValue = serializeForPostMessage(value, visited);
        if (serializedValue !== null && serializedValue !== undefined) {
          result[key] = serializedValue;
        }
      }
    } catch (error) {
      console.warn('Error during object serialization:', error);
      visited.delete(data);
      return null;
    }
    
    visited.delete(data);
    return result;
  } catch (error) {
    console.error('Critical serialization error:', error);
    return null; // Return null instead of error object
  }
}

// Enhanced safe postMessage wrapper with comprehensive error handling
function safePostMessage(targetWindow, data, targetOrigin = '*') {
  try {
    // First serialize the data
    const serializedData = serializeForPostMessage(data);
    
    // Validate serialized data
    if (serializedData === null || serializedData === undefined) {
      console.warn('Data serialization resulted in null/undefined, skipping postMessage');
      return false;
    }
    
    // Test JSON serialization as final validation
    const testSerialization = JSON.stringify(serializedData);
    if (testSerialization === undefined) {
      console.warn('Final JSON serialization failed, skipping postMessage');
      return false;
    }
    
    targetWindow.postMessage(serializedData, targetOrigin);
    return true;
  } catch (error) {
    console.error('SafePostMessage failed:', error);
    
    // Handle specific DataCloneError
    if (error.name === 'DataCloneError' || error.message.includes('DataCloneError')) {
      console.error('DataCloneError detected - attempting minimal fallback');
      try {
        // Send minimal error notification
        targetWindow.postMessage({
          type: 'SERIALIZATION_ERROR',
          error: 'DataCloneError',
          timestamp: Date.now()
        }, targetOrigin);
      } catch (fallbackError) {
        console.error('Even minimal fallback failed:', fallbackError);
      }
    }
    
    return false;
  }
}

const FileUploader = ({ currentPath = '', onUploadComplete, className = "" }) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadTasks, setUploadTasks] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef(null)

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileUpload(files)
    }
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      handleFileUpload(files)
    }
    e.target.value = '' // Reset input
  }

const handleFileUpload = async (files) => {
    if (files.length === 0) return

    try {
      setIsUploading(true)
      
      // Use actual S3 service for uploads with progress tracking
      const uploadPromises = files.map(async (file) => {
        const taskId = Math.random().toString(36).substr(2, 9)
        const task = {
          id: taskId,
          file: file,
          progress: 0,
          status: 'uploading',
          speed: 0,
          error: null
        }

        setUploadTasks(prev => [...prev, task])

        try {
          await s3Service.uploadFile(file, currentPath, (progress, speed) => {
            setUploadTasks(prev => prev.map(t => 
              t.id === taskId 
                ? { ...t, progress: Math.round(progress), speed: speed || 0 }
                : t
            ))
          })

          setUploadTasks(prev => prev.map(t => 
            t.id === taskId 
              ? { ...t, status: 'completed', progress: 100 }
              : t
          ))
          
          toast.success(`Successfully uploaded ${file.name}`)

          // Notify parent window about upload completion
          await notifyParent({
            type: 'FILE_UPLOAD_COMPLETE',
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            path: currentPath,
            timestamp: new Date().toISOString()
          })

        } catch (error) {
          setUploadTasks(prev => prev.map(t => 
            t.id === taskId 
              ? { ...t, status: 'error', error: error.message }
              : t
          ))
          
          toast.error(`Failed to upload ${file.name}: ${error.message}`)

          // Notify parent about upload failure
          await notifyParent({
            type: 'FILE_UPLOAD_FAILED',
            fileName: file.name,
            error: error.message,
            path: currentPath,
            timestamp: new Date().toISOString()
          })
        }

        return task
      })

      await Promise.all(uploadPromises)

      // Clear completed tasks after a delay
      setTimeout(() => {
        setUploadTasks(prev => prev.filter(task => task.status === 'error'))
        onUploadComplete?.()
      }, 2000)

    } catch (err) {
      console.error('Upload batch failed:', err)
      toast.error(`Upload failed: ${err.message}`)
    } finally {
      setIsUploading(false)
    }
  }

const notifyParent = async (data) => {
    if (!window.parent || !window.parent.postMessage) return;

    try {
      // Use enhanced safePostMessage with comprehensive serialization
      if (window.parent && window.parent.postMessage) {
        const success = safePostMessage(window.parent, data, '*');
        
        if (success) {
          console.log('File upload notification sent successfully');
          return;
        } else {
          console.warn('Primary notification failed, attempting fallback');
          
          // Fallback to global safe functions if available
          if (window.safePostMessage) {
            const fallbackSuccess = window.safePostMessage(window.parent, data, '*');
            if (fallbackSuccess) {
              console.log('File upload notification sent via global safePostMessage');
              return;
            }
          }
          
          // Last resort: send minimal safe data
          const safeData = {
            type: 'file_upload_complete',
            success: true,
            timestamp: Date.now(),
            message: 'File upload completed - detailed data could not be serialized'
          };
          
          try {
            window.parent.postMessage(safeData, '*');
            console.warn('Sent minimal file upload notification due to serialization issues');
          } catch (minimalError) {
            console.error('Even minimal notification failed:', minimalError);
          }
        }
      } else {
        console.warn('Parent window not available for file upload notification');
      }
    } catch (error) {
      console.error('Failed to send file upload notification:', error);
      
      // Final fallback
      try {
        if (window.parent && window.parent.postMessage) {
          window.parent.postMessage({
            type: 'file_upload_error',
            error: 'Notification failed',
            timestamp: Date.now()
          }, '*');
        }
      } catch (finalError) {
        console.error('Even fallback notification failed:', finalError);
      }
    }
  }

  const retryTask = async (taskId) => {
    const task = uploadTasks.find(t => t.id === taskId)
    if (!task) return

    setUploadTasks(prev => prev.map(t => 
      t.id === taskId 
        ? { ...t, status: 'uploading', progress: 0, error: null }
        : t
    ))

    try {
      await s3Service.uploadFile(task.file, currentPath, (progress, speed) => {
        setUploadTasks(prev => prev.map(t => 
          t.id === taskId 
            ? { ...t, progress: Math.round(progress), speed: speed || 0 }
            : t
        ))
      })

      setUploadTasks(prev => prev.map(t => 
        t.id === taskId 
          ? { ...t, status: 'completed', progress: 100 }
          : t
      ))
      
      toast.success(`Successfully uploaded ${task.file.name}`)

      // Notify parent about successful retry
      await notifyParent({
        type: 'FILE_UPLOAD_COMPLETE',
        fileName: task.file.name,
        fileSize: task.file.size,
        fileType: task.file.type,
        path: currentPath,
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      setUploadTasks(prev => prev.map(t => 
        t.id === taskId 
          ? { ...t, status: 'error', error: error.message }
          : t
      ))
      toast.error(`Retry failed: ${error.message}`)
    }
  }

  const removeTask = (taskId) => {
    setUploadTasks(prev => prev.filter(t => t.id !== taskId))
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatSpeed = (mbps) => {
    return `${mbps.toFixed(1)} MB/s`
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Upload Zone */}
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300
          ${isDragOver 
            ? 'border-aws-orange bg-aws-orange/5 drag-over' 
            : 'border-gray-300 hover:border-aws-orange/50 hover:bg-gray-50'
          }
        `}
      >
        <motion.div
          animate={isDragOver ? { scale: 1.05 } : { scale: 1 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-aws-orange to-orange-500 rounded-full flex items-center justify-center">
            <ApperIcon name="Upload" className="w-8 h-8 text-white" />
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {isDragOver ? 'Drop files here' : 'Upload Files'}
            </h3>
            <p className="text-gray-600 mb-4">
              Drag and drop files here, or click to browse
              {currentPath && (
                <span className="block text-sm text-aws-blue mt-1">
                  Uploading to: /{currentPath}
                </span>
              )}
            </p>
          </div>

          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="primary"
            icon="FolderOpen"
            disabled={isUploading}
          >
            Choose Files
          </Button>
        </motion.div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </motion.div>

      {/* Upload Progress */}
      <AnimatePresence>
        {uploadTasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            <h3 className="text-lg font-semibold text-gray-900">Upload Progress</h3>
            
            <div className="space-y-3">
              {uploadTasks.map((task) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="card p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {task.file.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {formatFileSize(task.file.size)}
                        {task.status === 'uploading' && task.speed > 0 && (
                          <span className="ml-2">• {formatSpeed(task.speed)}</span>
                        )}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      {task.status === 'completed' && (
                        <ApperIcon name="CheckCircle" className="w-5 h-5 text-success" />
                      )}
                      
                      {task.status === 'error' && (
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => retryTask(task.id)}
                            variant="ghost"
                            size="sm"
                            icon="RefreshCw"
                          >
                            Retry
                          </Button>
                          <Button
                            onClick={() => removeTask(task.id)}
                            variant="ghost"
                            size="sm"
                            icon="X"
                            className="text-error hover:text-error"
                          />
                        </div>
                      )}
                      
                      {task.status === 'uploading' && (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <ApperIcon name="Loader2" className="w-5 h-5 text-aws-orange" />
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {task.status !== 'completed' && (
                    <ProgressBar
                      value={task.progress}
                      variant={task.status === 'error' ? 'error' : 'primary'}
                      showLabel
                      label={task.status === 'error' ? task.error : 'Uploading...'}
                    />
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default FileUploader