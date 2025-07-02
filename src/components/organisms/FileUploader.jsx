import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-toastify'
import Button from '@/components/atoms/Button'
import ProgressBar from '@/components/atoms/ProgressBar'
import s3Service from '@/services/api/s3Service'
import ApperIcon from '@/components/ApperIcon'

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

        } catch (error) {
          setUploadTasks(prev => prev.map(t => 
            t.id === taskId 
              ? { ...t, status: 'error', error: error.message }
              : t
          ))
          
          toast.error(`Failed to upload ${file.name}: ${error.message}`)
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
      toast.error('Failed to start upload: ' + err.message)
    } finally {
      setIsUploading(false)
    }
  }

  const removeTask = (taskId) => {
    setUploadTasks(prev => prev.filter(task => task.id !== taskId))
  }

const retryTask = async (taskId) => {
    const task = uploadTasks.find(t => t.id === taskId)
    if (!task) return

    try {
      setUploadTasks(prev => prev.map(t => 
        t.id === taskId 
          ? { ...t, status: 'uploading', progress: 0, error: null }
          : t
      ))

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

      setTimeout(() => {
        removeTask(taskId)
        onUploadComplete?.()
      }, 2000)

    } catch (err) {
      setUploadTasks(prev => prev.map(t => 
        t.id === taskId 
          ? { ...t, status: 'error', error: err.message }
          : t
      ))
      toast.error(`Retry failed: ${err.message}`)
    }
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