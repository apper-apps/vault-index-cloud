import bucketConfigsData from '@/services/mockData/bucketConfigs.json'

class BucketConfigService {
  constructor() {
    this.configs = [...bucketConfigsData]
    this.loadFromLocalStorage()
  }

  loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem('s3-vault-configs')
      if (stored) {
        this.configs = JSON.parse(stored)
      }
    } catch (error) {
      console.warn('Failed to load configs from localStorage:', error)
    }
  }

  saveToLocalStorage() {
    try {
      localStorage.setItem('s3-vault-configs', JSON.stringify(this.configs))
    } catch (error) {
      console.warn('Failed to save configs to localStorage:', error)
    }
  }

  async getAll() {
    await new Promise(resolve => setTimeout(resolve, 300))
    return [...this.configs]
  }

  async getById(id) {
    await new Promise(resolve => setTimeout(resolve, 200))
    const config = this.configs.find(c => c.Id === parseInt(id))
    if (!config) {
      throw new Error('Configuration not found')
    }
    return { ...config }
  }

  async getActive() {
    await new Promise(resolve => setTimeout(resolve, 200))
    const active = this.configs.find(c => c.isActive)
    return active ? { ...active } : null
  }

  async create(configData) {
    await new Promise(resolve => setTimeout(resolve, 400))
    
    // Deactivate all other configs
    this.configs.forEach(c => c.isActive = false)
    
    const newConfig = {
      Id: Math.max(...this.configs.map(c => c.Id), 0) + 1,
      ...configData,
      isActive: true
    }
    
    this.configs.push(newConfig)
    this.saveToLocalStorage()
    return { ...newConfig }
  }

  async update(id, configData) {
    await new Promise(resolve => setTimeout(resolve, 400))
    
    const index = this.configs.findIndex(c => c.Id === parseInt(id))
    if (index === -1) {
      throw new Error('Configuration not found')
    }

    // If setting this config as active, deactivate others
    if (configData.isActive) {
      this.configs.forEach(c => c.isActive = false)
    }

    this.configs[index] = { ...this.configs[index], ...configData }
    this.saveToLocalStorage()
    return { ...this.configs[index] }
  }

  async delete(id) {
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const index = this.configs.findIndex(c => c.Id === parseInt(id))
    if (index === -1) {
      throw new Error('Configuration not found')
    }

    this.configs.splice(index, 1)
    this.saveToLocalStorage()
    return true
  }

  async setActive(id) {
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const config = this.configs.find(c => c.Id === parseInt(id))
    if (!config) {
      throw new Error('Configuration not found')
    }

    // Deactivate all configs
    this.configs.forEach(c => c.isActive = false)
    
    // Activate the selected config
    config.isActive = true
    this.saveToLocalStorage()
    return { ...config }
  }

  async testConnection(configData) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Mock connection test - randomly succeed or fail for demo
    const success = Math.random() > 0.3
    
    if (!success) {
      throw new Error('Failed to connect to AWS S3. Please check your credentials and try again.')
    }
    
    return { success: true, message: 'Connection successful!' }
  }
}

export default new BucketConfigService()