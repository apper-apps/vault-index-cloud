import { S3Client, ListObjectsV2Command, DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import bucketConfigService from '@/services/api/bucketConfigService'

class S3Service {
  constructor() {
    this.s3Client = null
    this.currentPath = ''
    this.bucketName = ''
  }

  async initializeClient() {
    try {
      const config = await bucketConfigService.getActive()
      if (!config) {
        throw new Error('No active S3 configuration found. Please configure your S3 settings first.')
      }

      this.s3Client = new S3Client({
        region: config.region,
        credentials: {
          accessKeyId: config.accessKey,
          secretAccessKey: config.secretKey
        }
      })
      this.bucketName = config.bucketName
      
      return this.s3Client
    } catch (error) {
      throw new Error(`Failed to initialize S3 client: ${error.message}`)
    }
  }

  async ensureClient() {
    if (!this.s3Client) {
      await this.initializeClient()
    }
    return this.s3Client
  }

  async listFiles(path = '') {
    try {
      await this.ensureClient()
      this.currentPath = path
      
      const prefix = path ? `${path}/` : ''
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        Delimiter: '/'
      })

      const response = await this.s3Client.send(command)
      
      // Process folders (CommonPrefixes)
      const folders = (response.CommonPrefixes || []).map(prefix => {
        const folderName = prefix.Prefix.slice(prefix.Prefix.lastIndexOf('/', prefix.Prefix.length - 2) + 1, -1)
        return {
          key: prefix.Prefix.slice(0, -1), // Remove trailing slash
          name: folderName,
          size: 0,
          lastModified: new Date().toISOString(),
          type: 'folder',
          etag: '',
          isFolder: true
        }
      })

      // Process files
      const files = (response.Contents || [])
        .filter(obj => obj.Key !== prefix) // Exclude the prefix itself
        .map(obj => ({
          key: obj.Key,
          name: obj.Key.split('/').pop(),
          size: obj.Size,
          lastModified: obj.LastModified.toISOString(),
          type: this.getFileType(obj.Key),
          etag: obj.ETag,
          isFolder: false
        }))

      return [...folders, ...files].sort((a, b) => {
        if (a.isFolder && !b.isFolder) return -1
        if (!a.isFolder && b.isFolder) return 1
        return a.name.localeCompare(b.name)
      })
    } catch (error) {
      throw new Error(`Failed to list files: ${error.message}`)
    }
  }

  async uploadFile(file, path = '', progressCallback) {
    try {
      await this.ensureClient()
      
      const key = path ? `${path}/${file.name}` : file.name
      const startTime = Date.now()
      let lastLoaded = 0
      
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: key,
          Body: file,
          ContentType: file.type
        }
      })

      upload.on('httpUploadProgress', (progress) => {
        if (progressCallback) {
          const loaded = progress.loaded || 0
          const total = progress.total || file.size
          const percentage = (loaded / total) * 100
          
          // Calculate speed
          const elapsed = (Date.now() - startTime) / 1000
          const bytesPerSecond = elapsed > 0 ? (loaded - lastLoaded) / elapsed : 0
          const mbPerSecond = bytesPerSecond / (1024 * 1024)
          
          lastLoaded = loaded
          progressCallback(percentage, mbPerSecond)
        }
      })

      await upload.done()
      return { key, size: file.size, type: file.type }
    } catch (error) {
      throw new Error(`Failed to upload file: ${error.message}`)
    }
  }

  async downloadFile(fileKey) {
    try {
      await this.ensureClient()
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey
      })

      const response = await this.s3Client.send(command)
      
      // Convert stream to blob
      const chunks = []
      const reader = response.Body.getReader()
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }
      
      const blob = new Blob(chunks, { type: response.ContentType })
      const url = URL.createObjectURL(blob)
      
      return {
        url,
        filename: fileKey.split('/').pop(),
        size: response.ContentLength
      }
    } catch (error) {
      throw new Error(`Failed to download file: ${error.message}`)
    }
  }

  async deleteFile(fileKey) {
    try {
      await this.ensureClient()
      
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey
      })

      await this.s3Client.send(command)
      return true
    } catch (error) {
      throw new Error(`Failed to delete file: ${error.message}`)
    }
  }

  async deleteFolder(folderKey) {
    try {
      await this.ensureClient()
      
      // List all objects in the folder
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: `${folderKey}/`
      })

      const response = await this.s3Client.send(listCommand)
      
      if (response.Contents && response.Contents.length > 0) {
        // Delete all objects in the folder
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: this.bucketName,
          Delete: {
            Objects: response.Contents.map(obj => ({ Key: obj.Key }))
          }
        })

        await this.s3Client.send(deleteCommand)
      }
      
      return true
    } catch (error) {
      throw new Error(`Failed to delete folder: ${error.message}`)
    }
  }

  async searchFiles(query, path = '') {
    try {
      await this.ensureClient()
      
      const prefix = path ? `${path}/` : ''
      const searchTerm = query.toLowerCase()
      
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix
      })

      const response = await this.s3Client.send(command)
      
      const filteredFiles = (response.Contents || [])
        .filter(obj => {
          const fileName = obj.Key.split('/').pop().toLowerCase()
          return fileName.includes(searchTerm)
        })
        .map(obj => ({
          key: obj.Key,
          name: obj.Key.split('/').pop(),
          size: obj.Size,
          lastModified: obj.LastModified.toISOString(),
          type: this.getFileType(obj.Key),
          etag: obj.ETag,
          isFolder: false
        }))

      return filteredFiles
    } catch (error) {
      throw new Error(`Failed to search files: ${error.message}`)
    }
  }

  async createFolder(folderName, path = '') {
    try {
      await this.ensureClient()
      
      const folderKey = path ? `${path}/${folderName}/` : `${folderName}/`
      
      // Check if folder already exists
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: folderKey,
        MaxKeys: 1
      })

      const response = await this.s3Client.send(listCommand)
      if (response.Contents && response.Contents.length > 0) {
        throw new Error('Folder already exists')
      }

      // Create folder by uploading an empty object with trailing slash
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: folderKey,
          Body: '',
          ContentType: 'application/x-directory'
        }
      })

      await upload.done()
      return true
    } catch (error) {
      throw new Error(`Failed to create folder: ${error.message}`)
    }
  }

  getFileType(key) {
    const extension = key.split('.').pop().toLowerCase()
    const mimeTypes = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
      'zip': 'application/zip',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain',
      'csv': 'text/csv',
      'json': 'application/json'
    }
    return mimeTypes[extension] || 'application/octet-stream'
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