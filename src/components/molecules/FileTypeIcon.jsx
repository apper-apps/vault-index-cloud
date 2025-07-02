import ApperIcon from '@/components/ApperIcon'

const FileTypeIcon = ({ type, className = "w-5 h-5" }) => {
  const getIconAndColor = (fileType) => {
    if (!fileType) return { icon: 'File', color: 'text-gray-500' }
    
    const type = fileType.toLowerCase()
    
    // Folders
    if (type === 'folder') {
      return { icon: 'Folder', color: 'text-blue-500' }
    }
    
    // Images
    if (type.startsWith('image/')) {
      return { icon: 'Image', color: 'text-green-500' }
    }
    
    // Videos
    if (type.startsWith('video/')) {
      return { icon: 'Video', color: 'text-purple-500' }
    }
    
    // Audio
    if (type.startsWith('audio/')) {
      return { icon: 'Music', color: 'text-yellow-500' }
    }
    
    // Documents
    if (type.includes('pdf')) {
      return { icon: 'FileText', color: 'text-red-500' }
    }
    
    if (type.includes('word') || type.includes('document')) {
      return { icon: 'FileText', color: 'text-blue-600' }
    }
    
    if (type.includes('excel') || type.includes('sheet')) {
      return { icon: 'FileSpreadsheet', color: 'text-green-600' }
    }
    
    if (type.includes('powerpoint') || type.includes('presentation')) {
      return { icon: 'Presentation', color: 'text-orange-500' }
    }
    
    // Archives
    if (type.includes('zip') || type.includes('rar') || type.includes('tar') || type.includes('gz')) {
      return { icon: 'Archive', color: 'text-orange-500' }
    }
    
    // Code files
    if (type.includes('javascript') || type.includes('json') || type.includes('css') || 
        type.includes('html') || type.includes('xml') || type.includes('sql')) {
      return { icon: 'Code', color: 'text-indigo-500' }
    }
    
    // Default
    return { icon: 'File', color: 'text-gray-500' }
  }

  const { icon, color } = getIconAndColor(type)
  
  return (
    <ApperIcon 
      name={icon} 
      className={`${className} ${color} file-icon ${type?.replace('/', '-')}`} 
    />
  )
}

export default FileTypeIcon