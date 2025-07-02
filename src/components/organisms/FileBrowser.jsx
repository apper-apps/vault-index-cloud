import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-toastify'
import { format } from 'date-fns'
import Button from '@/components/atoms/Button'
import SearchBar from '@/components/molecules/SearchBar'
import FileTypeIcon from '@/components/molecules/FileTypeIcon'
import Loading from '@/components/ui/Loading'
import Error from '@/components/ui/Error'
import Empty from '@/components/ui/Empty'
import s3Service from '@/services/api/s3Service'
import ApperIcon from '@/components/ApperIcon'

const FileBrowser = ({ currentPath = '', onPathChange, onRefresh, className = "" }) => {
  const [files, setFiles] = useState([])
  const [filteredFiles, setFilteredFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')

  useEffect(() => {
    loadFiles()
  }, [currentPath])

  useEffect(() => {
    filterAndSortFiles()
  }, [files, searchQuery, sortBy, sortOrder])

  const loadFiles = async () => {
    try {
      setLoading(true)
      setError(null)
      const fileList = await s3Service.listFiles(currentPath)
      setFiles(fileList)
      setSelectedFiles(new Set())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filterAndSortFiles = () => {
    let filtered = [...files]

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(file =>
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      // Folders first
      if (a.isFolder && !b.isFolder) return -1
      if (!a.isFolder && b.isFolder) return 1

      let aValue, bValue

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'size':
          aValue = a.size
          bValue = b.size
          break
        case 'modified':
          aValue = new Date(a.lastModified)
          bValue = new Date(b.lastModified)
          break
        default:
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    setFilteredFiles(filtered)
  }

  const handleFileClick = (file) => {
    if (file.isFolder) {
      onPathChange?.(file.key)
    }
  }

  const handleFileSelect = (fileKey) => {
    const newSelected = new Set(selectedFiles)
    if (newSelected.has(fileKey)) {
      newSelected.delete(fileKey)
    } else {
      newSelected.add(fileKey)
    }
    setSelectedFiles(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(filteredFiles.map(f => f.key)))
    }
  }

  const handleDownload = async (fileKey, fileName) => {
    try {
      const downloadInfo = await s3Service.downloadFile(fileKey)
      
      // Create download link
      const link = document.createElement('a')
      link.href = downloadInfo.url
      link.download = downloadInfo.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Clean up blob URL
      setTimeout(() => URL.revokeObjectURL(downloadInfo.url), 100)
      
      toast.success(`Downloaded ${fileName}`)
    } catch (err) {
      toast.error(`Failed to download ${fileName}: ${err.message}`)
    }
  }

  const handleDelete = async (fileKey, fileName, isFolder = false) => {
    if (!window.confirm(`Are you sure you want to delete ${fileName}?`)) return

    try {
      if (isFolder) {
        await s3Service.deleteFolder(fileKey)
      } else {
        await s3Service.deleteFile(fileKey)
      }
      
      toast.success(`Deleted ${fileName}`)
      loadFiles()
      onRefresh?.()
    } catch (err) {
      toast.error(`Failed to delete ${fileName}: ${err.message}`)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedFiles.size === 0) return
    
    const fileNames = Array.from(selectedFiles).map(key => 
      files.find(f => f.key === key)?.name
    ).join(', ')
    
    if (!window.confirm(`Are you sure you want to delete ${selectedFiles.size} file(s)?\n\n${fileNames}`)) return

    try {
      const deletePromises = Array.from(selectedFiles).map(async (fileKey) => {
        const file = files.find(f => f.key === fileKey)
        if (file?.isFolder) {
          await s3Service.deleteFolder(fileKey)
        } else {
          await s3Service.deleteFile(fileKey)
        }
      })

      await Promise.all(deletePromises)
      toast.success(`Deleted ${selectedFiles.size} file(s)`)
      setSelectedFiles(new Set())
      loadFiles()
      onRefresh?.()
    } catch (err) {
      toast.error(`Failed to delete files: ${err.message}`)
    }
  }

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '-'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString) => {
    return format(new Date(dateString), 'MMM dd, yyyy HH:mm')
  }

  const getBreadcrumbs = () => {
    if (!currentPath) return []
    
    const parts = currentPath.split('/')
    return parts.map((part, index) => ({
      name: part,
      path: parts.slice(0, index + 1).join('/')
    }))
  }

  if (loading) return <Loading type="files" />
  if (error) return <Error message={error} onRetry={loadFiles} type="file" />

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">File Browser</h2>
          
          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-2 text-sm text-gray-600 mt-2">
            <button
              onClick={() => onPathChange?.('')}
              className="hover:text-aws-blue transition-colors"
            >
              Root
            </button>
            {getBreadcrumbs().map((crumb, index) => (
              <div key={index} className="flex items-center space-x-2">
                <ApperIcon name="ChevronRight" className="w-4 h-4" />
                <button
                  onClick={() => onPathChange?.(crumb.path)}
                  className="hover:text-aws-blue transition-colors"
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {selectedFiles.size > 0 && (
            <Button
              onClick={handleBulkDelete}
              variant="danger"
              size="sm"
              icon="Trash2"
            >
              Delete ({selectedFiles.size})
            </Button>
          )}
          
          <Button
            onClick={loadFiles}
            variant="outline"
            size="sm"
            icon="RefreshCw"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Search and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex-1">
          <SearchBar
            onSearch={setSearchQuery}
            placeholder="Search files and folders..."
          />
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [column, order] = e.target.value.split('-')
              setSortBy(column)
              setSortOrder(order)
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-aws-blue focus:ring-2 focus:ring-aws-blue/20"
          >
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="size-asc">Size (Small to Large)</option>
            <option value="size-desc">Size (Large to Small)</option>
            <option value="modified-desc">Modified (Newest)</option>
            <option value="modified-asc">Modified (Oldest)</option>
          </select>
        </div>
      </div>

      {/* File List */}
      {filteredFiles.length === 0 ? (
        <Empty
          type={searchQuery ? 'search' : 'files'}
          message={searchQuery ? 'No files match your search' : 'This folder is empty'}
          description={searchQuery ? 'Try adjusting your search terms' : 'Upload some files to get started'}
        />
      ) : (
        <div className="card overflow-hidden">
          {/* Table Header */}
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <div className="flex items-center">
              <div className="flex items-center mr-4">
                <input
                  type="checkbox"
                  checked={filteredFiles.length > 0 && selectedFiles.size === filteredFiles.length}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-aws-orange focus:ring-aws-orange"
                />
              </div>
              
              <div className="grid grid-cols-12 gap-4 flex-1 text-sm font-semibold text-gray-700">
                <div className="col-span-5 flex items-center gap-2">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1 hover:text-aws-blue transition-colors"
                  >
                    Name
                    {sortBy === 'name' && (
                      <ApperIcon 
                        name={sortOrder === 'asc' ? 'ChevronUp' : 'ChevronDown'} 
                        className="w-4 h-4" 
                      />
                    )}
                  </button>
                </div>
                
                <div className="col-span-2 flex items-center gap-2">
                  <button
                    onClick={() => handleSort('size')}
                    className="flex items-center gap-1 hover:text-aws-blue transition-colors"
                  >
                    Size
                    {sortBy === 'size' && (
                      <ApperIcon 
                        name={sortOrder === 'asc' ? 'ChevronUp' : 'ChevronDown'} 
                        className="w-4 h-4" 
                      />
                    )}
                  </button>
                </div>
                
                <div className="col-span-3 flex items-center gap-2">
                  <button
                    onClick={() => handleSort('modified')}
                    className="flex items-center gap-1 hover:text-aws-blue transition-colors"
                  >
                    Modified
                    {sortBy === 'modified' && (
                      <ApperIcon 
                        name={sortOrder === 'asc' ? 'ChevronUp' : 'ChevronDown'} 
                        className="w-4 h-4" 
                      />
                    )}
                  </button>
                </div>
                
                <div className="col-span-2 text-center">Actions</div>
              </div>
            </div>
          </div>

          {/* File Rows */}
          <div className="divide-y divide-gray-200">
            <AnimatePresence>
              {filteredFiles.map((file, index) => (
                <motion.div
                  key={file.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center">
                    <div className="flex items-center mr-4">
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(file.key)}
                        onChange={() => handleFileSelect(file.key)}
                        className="rounded border-gray-300 text-aws-orange focus:ring-aws-orange"
                      />
                    </div>
                    
                    <div className="grid grid-cols-12 gap-4 flex-1 items-center">
                      {/* Name */}
                      <div className="col-span-5 flex items-center gap-3">
                        <FileTypeIcon type={file.isFolder ? 'folder' : file.type} />
                        <button
                          onClick={() => handleFileClick(file)}
                          className={`text-left truncate ${
                            file.isFolder 
                              ? 'text-aws-blue hover:text-aws-blue/80 font-medium' 
                              : 'text-gray-900 hover:text-gray-700'
                          } transition-colors`}
                        >
                          {file.name}
                        </button>
                      </div>
                      
                      {/* Size */}
                      <div className="col-span-2 text-sm text-gray-600">
                        {formatFileSize(file.size)}
                      </div>
                      
                      {/* Modified */}
                      <div className="col-span-3 text-sm text-gray-600">
                        {formatDate(file.lastModified)}
                      </div>
                      
                      {/* Actions */}
                      <div className="col-span-2 flex items-center justify-center gap-2">
                        {!file.isFolder && (
                          <Button
                            onClick={() => handleDownload(file.key, file.name)}
                            variant="ghost"
                            size="sm"
                            icon="Download"
                            className="text-aws-blue hover:text-aws-blue hover:bg-aws-blue/10"
                          />
                        )}
                        
                        <Button
                          onClick={() => handleDelete(file.key, file.name, file.isFolder)}
                          variant="ghost"
                          size="sm"
                          icon="Trash2"
                          className="text-error hover:text-error hover:bg-error/10"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  )
}

export default FileBrowser