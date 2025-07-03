import React, { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "react-toastify";
import ApperIcon from "@/components/ApperIcon";
import ProgressBar from "@/components/atoms/ProgressBar";
import Button from "@/components/atoms/Button";
import Error from "@/components/ui/Error";
import s3Service from "@/services/api/s3Service";

// Simple notification helper
function notifyParent(data) {
  if (window.parent && window.parent.postMessage) {
    try {
      const safeData = {
        type: typeof data.type === 'string' ? data.type : 'upload',
        status: typeof data.status === 'string' ? data.status : 'info',
        message: typeof data.message === 'string' ? data.message : '',
        timestamp: Date.now()
      };
      window.parent.postMessage(safeData, '*');
    } catch (error) {
      console.warn('Failed to notify parent:', error);
    }
  }
}

const FileUploader = ({ currentPath = '', onUploadComplete, className = "" }) => {
  // State management
  const [uploadTasks, setUploadTasks] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Refs
  const fileInputRef = useRef(null);

  // Helper function to safely serialize objects for postMessage
  function serializeObject(obj, visited = new WeakSet()) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    // Prevent circular references
    if (visited.has(obj)) {
      return '[Circular Reference]';
    }
    visited.add(obj);
    
    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => serializeObject(item, visited));
    }
// Handle all non-cloneable objects that would cause DataCloneError
    if ((typeof window !== 'undefined' && typeof window.Request !== 'undefined' && obj instanceof window.Request) || 
        (typeof window !== 'undefined' && typeof window.Response !== 'undefined' && obj instanceof window.Response) || 
        (typeof window !== 'undefined' && typeof window.File !== 'undefined' && obj instanceof window.File) || 
        (typeof Blob !== 'undefined' && obj instanceof Blob) ||
        (typeof Map !== 'undefined' && obj instanceof Map) ||
        (typeof Set !== 'undefined' && obj instanceof Set) ||
        (typeof WeakMap !== 'undefined' && obj instanceof WeakMap) ||
        (typeof WeakSet !== 'undefined' && obj instanceof WeakSet) ||
        (typeof Symbol !== 'undefined' && typeof obj === 'symbol') ||
        (typeof BigInt !== 'undefined' && typeof obj === 'bigint') ||
        typeof obj === 'function' || 
        obj instanceof Error ||
        obj instanceof RegExp ||
        (typeof ArrayBuffer !== 'undefined' && obj instanceof ArrayBuffer) ||
        (typeof SharedArrayBuffer !== 'undefined' && obj instanceof SharedArrayBuffer) ||
        (typeof DataView !== 'undefined' && obj instanceof DataView) ||
        (obj && typeof obj.constructor === 'function' && obj.constructor.name && 
         ['HTMLElement', 'Element', 'Node', 'Window', 'Document'].includes(obj.constructor.name))) {
      
      // Create safe representation
      const safeObj = {
        type: obj.constructor?.name || typeof obj,
        toString: '[Non-serializable Object]'
      };
      
      // Add specific handling for different types
try {
        if (typeof window !== 'undefined' && typeof window.File !== 'undefined' && obj instanceof window.File) {
          safeObj.name = obj.name;
          safeObj.size = obj.size;
          safeObj.type = obj.type;
          safeObj.lastModified = obj.lastModified;
        } else if (obj instanceof Error) {
          safeObj.message = obj.message;
          safeObj.stack = obj.stack;
          safeObj.name = obj.name;
        } else if (obj.toString && typeof obj.toString === 'function') {
          safeObj.toString = obj.toString();
        }
      } catch (error) {
        safeObj.toString = '[Unserializable]';
      }
      
      return safeObj;
    }
    
    // Handle Date objects
    if (obj instanceof Date) {
      return obj.toISOString();
    }
    
    // Handle regular objects
    const result = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        try {
          result[key] = serializeObject(obj[key], visited);
        } catch (error) {
          result[key] = '[Unserializable]';
        }
      }
    }
    
    return result;
  }

// Send notification to parent window with comprehensive error handling
  function notifyParentLocal(data) {
    try {
      const serializedData = serializeObject(data);
      
      // Additional safety check before postMessage
      if (typeof serializedData !== 'object' || serializedData === null) {
        console.warn('Invalid data for postMessage:', serializedData);
        return;
      }
      
      if (window.parent && window.parent.postMessage) {
        window.parent.postMessage(serializedData, '*');
      }
    } catch (error) {
      console.error('Failed to notify parent:', error);
      
      // Fallback: send minimal safe data
      try {
        if (window.parent && window.parent.postMessage) {
          window.parent.postMessage({
            type: 'error',
            message: 'Failed to serialize upload data',
            timestamp: new Date().toISOString()
          }, '*');
        }
      } catch (fallbackError) {
        console.error('Even fallback postMessage failed:', fallbackError);
      }
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };
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
    e.target.value = ''
  }

  const handleFileUpload = async (files) => {
    if (files.length === 0) return

    try {
      setIsUploading(true)
      
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

notifyParentLocal({
            type: 'file_upload_complete',
            status: 'success',
            message: `Uploaded ${file.name}`
          });

        } catch (error) {
          setUploadTasks(prev => prev.map(t => 
            t.id === taskId 
              ? { ...t, status: 'error', error: error.message }
              : t
          ))
          
          toast.error(`Failed to upload ${file.name}: ${error.message}`)

notifyParentLocal({
            type: 'file_upload_failed',
            status: 'error',
            message: `Failed to upload ${file.name}`
          });
        }

        return task
      })

      await Promise.all(uploadPromises)

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

notifyParentLocal({
        type: 'file_upload_complete',
        status: 'success',
        message: `Uploaded ${task.file.name}`
      });

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