import s3FilesData from "@/services/mockData/s3Files.json";

class S3Service {
  constructor() {
    this.files = [...s3FilesData]
    this.currentPath = ''
  }

  async listFiles(path = '') {
    await new Promise(resolve => setTimeout(resolve, 400))
    this.currentPath = path
    
    // Filter files by current path
    let filteredFiles = this.files.filter(file => {
      if (!path) {
        // Root level - show files in root and first level folders
        return !file.key.includes('/') || file.key.split('/').length === 2
      } else {
        // Show files in the current path
        return file.key.startsWith(path + '/') && 
               file.key.split('/').length === path.split('/').length + 2
      }
    })

    // Add folder representations
    const folders = new Set()
    this.files.forEach(file => {
      if (file.key.startsWith(path ? path + '/' : '')) {
        const relativePath = file.key.slice(path ? path.length + 1 : 0)
        const folderName = relativePath.split('/')[0]
        if (relativePath.includes('/') && folderName) {
          folders.add(folderName)
        }
      }
    })

    const folderItems = Array.from(folders).map(folderName => ({
      key: path ? `${path}/${folderName}` : folderName,
      name: folderName,
      size: 0,
      lastModified: new Date().toISOString(),
      type: 'folder',
      etag: '',
      isFolder: true
    }))

    const result = [...folderItems, ...filteredFiles.map(file => ({
      ...file,
      name: file.key.split('/').pop(),
      isFolder: false
    }))]

    return result.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1
      if (!a.isFolder && b.isFolder) return 1
      return a.name.localeCompare(b.name)
    })
  }

  async uploadFiles(files, path = '') {
    const uploadTasks = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file: file,
      progress: 0,
      status: 'pending',
      speed: 0,
      error: null
    }))

    // Simulate upload progress
    for (const task of uploadTasks) {
      task.status = 'uploading'
      
      // Simulate progress updates
      for (let progress = 0; progress <= 100; progress += Math.random() * 20) {
        task.progress = Math.min(100, progress)
        task.speed = Math.random() * 5 + 1 // MB/s
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Simulate occasional failures
      if (Math.random() < 0.1) {
        task.status = 'error'
        task.error = 'Upload failed due to network error'
      } else {
        task.status = 'completed'
        task.progress = 100
        
        // Add file to our mock data
        const fileKey = path ? `${path}/${file.name}` : file.name
        this.files.push({
          key: fileKey,
          name: file.name,
          size: file.size,
          lastModified: new Date().toISOString(),
          type: file.type,
          etag: `"${Math.random().toString(36).substr(2, 32)}"`,
          isFolder: false
        })
      }
    }

    return uploadTasks
  }

  async downloadFile(fileKey) {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const file = this.files.find(f => f.key === fileKey)
    if (!file) {
      throw new Error('File not found')
    }

    // Simulate download by creating a blob URL
    const blob = new Blob(['Mock file content for ' + file.name], { type: file.type })
    const url = URL.createObjectURL(blob)
    
    return {
      url,
      filename: file.name,
      size: file.size
    }
  }

  async deleteFile(fileKey) {
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const index = this.files.findIndex(f => f.key === fileKey)
    if (index === -1) {
      throw new Error('File not found')
    }

    this.files.splice(index, 1)
    return true
  }

  async deleteFolder(folderKey) {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Remove all files in the folder
    this.files = this.files.filter(f => !f.key.startsWith(folderKey + '/'))
    return true
  }

  async searchFiles(query, path = '') {
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const searchTerm = query.toLowerCase()
    const filteredFiles = this.files.filter(file => {
      const inPath = path ? file.key.startsWith(path + '/') : true
      const matchesQuery = file.name.toLowerCase().includes(searchTerm)
      return inPath && matchesQuery
    })

    return filteredFiles.map(file => ({
      ...file,
      name: file.key.split('/').pop(),
      isFolder: false
    }))
  }

  async createFolder(folderName, path = '') {
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const folderKey = path ? `${path}/${folderName}` : folderName
    
    // Check if folder already exists
    const existingFolder = this.files.some(f => f.key.startsWith(folderKey + '/'))
    if (existingFolder) {
      throw new Error('Folder already exists')
    }

    // Create a placeholder file to represent the folder
    this.files.push({
      key: folderKey + '/.placeholder',
      name: '.placeholder',
      size: 0,
      lastModified: new Date().toISOString(),
      type: 'text/plain',
      etag: `"${Math.random().toString(36).substr(2, 32)}"`,
      isFolder: false
    })

    return true
  }

  getCurrentPath() {
    return this.currentPath
  }

  getPathBreadcrumbs() {
    if (!this.currentPath) return []
    
    const parts = this.currentPath.split('/')
return parts.map((part, index) => ({
      name: part,
      path: parts.slice(0, index + 1).join('/')
    }))
  }
}

export default new S3Service()