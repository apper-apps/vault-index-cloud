import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import ApperIcon from "@/components/ApperIcon";
import Input from "@/components/atoms/Input";
import Button from "@/components/atoms/Button";
import StatusIndicator from "@/components/molecules/StatusIndicator";
import Error from "@/components/ui/Error";
import Loading from "@/components/ui/Loading";
import bucketConfigService from "@/services/api/bucketConfigService";

// Enhanced serialization for Apper SDK with comprehensive DataCloneError prevention
const serializeForApper = (obj) => {
  try {
    if (obj === null || obj === undefined) return null
    
    // Global seen set to track circular references across all levels
    const seen = new WeakSet()
    
    const serialize = (value) => {
      if (value === null || value === undefined) return value
      
      // Handle primitives first
      if (typeof value !== 'object') {
        if (typeof value === 'function') return '[Function]'
        if (typeof value === 'symbol') return '[Symbol]'
        if (typeof value === 'bigint') return value.toString()
        return value
      }
      
      // Check for circular references
      if (seen.has(value)) return '[Circular Reference]'
      seen.add(value)
      
// Handle built-in objects that can cause DataCloneError
      if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack }
      if (value instanceof Date) return value.toISOString()
      if (value instanceof RegExp) return value.toString()
      if (typeof File !== 'undefined' && value instanceof File) return { name: value.name, size: value.size, type: value.type, lastModified: value.lastModified }
      if (typeof Blob !== 'undefined' && value instanceof Blob) return { size: value.size, type: value.type }
      
      // Handle objects that definitely cannot be cloned
      if ((typeof Request !== 'undefined' && value instanceof Request) || (typeof Response !== 'undefined' && value instanceof Response)) return '[Request/Response Object]'
      if (value instanceof Promise) return '[Promise Object]'
      if (value instanceof WeakMap || value instanceof WeakSet) return '[WeakMap/WeakSet Object]'
      if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) return '[ArrayBuffer]'
      if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(value)) return '[TypedArray/DataView]'
      
      // Handle DOM objects
      if (typeof Window !== 'undefined' && value instanceof Window) return '[Window Object]'
      if (typeof Document !== 'undefined' && value instanceof Document) return '[Document Object]'
      if (typeof Element !== 'undefined' && value instanceof Element) return '[DOM Element]'
      if (typeof Node !== 'undefined' && value instanceof Node) return '[DOM Node]'
      if (typeof Event !== 'undefined' && value instanceof Event) return '[Event Object]'
      // Handle Proxy objects and complex constructors
      try {
        if (value.constructor && value.constructor.name === 'Object' && Object.getPrototypeOf(value) !== Object.prototype) {
          return '[Proxy/Complex Object]'
        }
      } catch (e) {
        return '[Unserializable Object]'
      }
      
      // Handle arrays
      if (Array.isArray(value)) {
        return value.map(item => {
          try {
            return serialize(item)
          } catch (e) {
            console.warn('Failed to serialize array item:', e)
            return '[Unserializable Item]'
          }
        })
      }
      
      // Handle plain objects
      const result = {}
      try {
        for (const [key, val] of Object.entries(value)) {
          try {
            result[key] = serialize(val)
          } catch (e) {
            console.warn(`Failed to serialize property ${key}:`, e)
            result[key] = '[Unserializable Property]'
          }
        }
      } catch (e) {
        return '[Object Enumeration Failed]'
      }
      
      return result
    }
    
    const serialized = serialize(obj)
    
    // Final validation - attempt JSON stringify to ensure it's truly serializable
    try {
      JSON.stringify(serialized)
    } catch (e) {
      console.warn('Serialized data still not JSON compatible:', e)
      return { error: 'Final serialization check failed', originalType: typeof obj }
    }
    
    return serialized
  } catch (error) {
    console.error('Critical serialization failure:', error)
    return {
      error: 'Serialization failed',
      originalType: typeof obj,
      timestamp: new Date().toISOString()
    }
  }
}

const ConfigurationPanel = ({ className, onConfigSaved }) => {
  const [configs, setConfigs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    accessKey: '',
    secretKey: '',
    region: 'us-east-1',
    bucketName: ''
  })
  const [isEditing, setIsEditing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [activeConfig, setActiveConfig] = useState(null)

  const [formErrors, setFormErrors] = useState({})

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    try {
      setLoading(true)
      setError(null)
      const [allConfigs, active] = await Promise.all([
        bucketConfigService.getAll(),
        bucketConfigService.getActive()
      ])
      setConfigs(allConfigs)
      setActiveConfig(active)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    const errors = {}
    
    if (!formData.name.trim()) errors.name = 'Configuration name is required'
    if (!formData.accessKey.trim()) errors.accessKey = 'Access Key is required'
    if (!formData.secretKey.trim()) errors.secretKey = 'Secret Key is required'
    if (!formData.region.trim()) errors.region = 'Region is required'
    if (!formData.bucketName.trim()) errors.bucketName = 'Bucket name is required'
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: null }))
    }
  }

const handleTestConnection = async () => {
    if (!validateForm()) return
    
    try {
      setTesting(true)
      
      // Create serializable test data to prevent postMessage errors
      const testData = {
        name: String(formData.name || '').trim(),
        accessKey: String(formData.accessKey || '').trim(),
        secretKey: String(formData.secretKey || '').trim(),
        region: String(formData.region || '').trim(),
        bucketName: String(formData.bucketName || '').trim()
      }
      
      await bucketConfigService.testConnection(testData)
      toast.success('Connection test successful!')
    } catch (err) {
      console.error('Connection test error:', err)
      toast.error(err.message || 'Connection test failed')
    } finally {
      setTesting(false)
    }
  }

const handleSaveConfig = async () => {
    if (!validateForm()) return
    
    try {
      // Serialize callback data for Apper SDK
      const serializedFormData = serializeForApper({
        name: formData.name?.trim(),
        accessKey: formData.accessKey?.trim(),
        secretKey: formData.secretKey?.trim(),
        region: formData.region?.trim(),
        bucketName: formData.bucketName?.trim(),
        timestamp: new Date().toISOString()
      })

      const savedConfig = await bucketConfigService.create(serializedFormData)
      await loadConfigs()
      
      // Safely notify Apper of configuration change
      if (window.Apper && typeof window.Apper.notifyConfigChange === 'function') {
        try {
          const apperNotificationData = serializeForApper({
            type: 'CONFIG_SAVED',
            config: {
              id: savedConfig?.id,
              name: savedConfig?.name,
              region: savedConfig?.region,
              timestamp: new Date().toISOString()
            }
          })
          
          // Use safe postMessage if available
          if (window.safePostMessage) {
            window.safePostMessage(window.parent, apperNotificationData, 'https://apper.integrately.com')
          } else {
            window.Apper.notifyConfigChange(apperNotificationData)
          }
        } catch (postMessageError) {
          console.warn('Failed to notify Apper of config change:', postMessageError)
          // Don't fail the save operation if notification fails
        }
      }
      
      // Reset form
      setFormData({
        name: '',
        accessKey: '',
        secretKey: '',
        region: 'us-east-1',
        bucketName: '',
      })
      setIsEditing(false)
      setShowForm(false)
      toast.success('Configuration saved successfully!')
    } catch (err) {
      console.error('Save config error:', err)
      toast.error(err.message || 'Failed to save configuration')
    }
  }
const handleSetActive = async (configId) => {
    try {
      const updatedConfig = await bucketConfigService.setActive(configId)
      setActiveConfig(updatedConfig)
      setConfigs(prev => prev.map(c => ({ ...c, isActive: c.Id === configId })))
      toast.success('Configuration activated!')
      
      // Serialize config data to prevent DataCloneError
      const serializedConfig = {
        Id: updatedConfig.Id,
        name: updatedConfig.name,
        bucketName: updatedConfig.bucketName,
        region: updatedConfig.region,
        isActive: updatedConfig.isActive,
        activatedAt: new Date().toISOString()
      }
      onConfigSaved?.(serializedConfig)
    } catch (err) {
      console.error('Configuration activation error:', err)
      toast.error(err.message || 'Failed to activate configuration')
    }
  }

  const handleDeleteConfig = async (configId) => {
    if (!window.confirm('Are you sure you want to delete this configuration?')) return
    
    try {
      await bucketConfigService.delete(configId)
      setConfigs(prev => prev.filter(c => c.Id !== configId))
      if (activeConfig?.Id === configId) {
        setActiveConfig(null)
      }
      toast.success('Configuration deleted!')
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (loading) return <Loading type="config" />
  if (error) return <Error message={error} onRetry={loadConfigs} type="connection" />

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AWS Configuration</h2>
          <p className="text-gray-600 mt-1">Manage your S3 bucket connections</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          icon={showForm ? "X" : "Plus"}
          variant="primary"
        >
          {showForm ? "Cancel" : "Add Configuration"}
        </Button>
      </div>

      {/* Current Status */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Connection Status</h3>
            <p className="text-sm text-gray-600 mt-1">
              {activeConfig ? `Connected to ${activeConfig.bucketName}` : 'No active configuration'}
            </p>
          </div>
          <StatusIndicator 
            status={activeConfig ? 'active' : 'inactive'} 
            label={activeConfig ? 'Connected' : 'Disconnected'}
          />
        </div>
      </motion.div>

      {/* Configuration Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="card p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">New Configuration</h3>
          
          <div className="space-y-4">
            <Input
              label="Configuration Name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              error={formErrors.name}
              placeholder="e.g., Production Bucket"
              required
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Access Key"
                value={formData.accessKey}
                onChange={(e) => handleInputChange('accessKey', e.target.value)}
                error={formErrors.accessKey}
                placeholder="AKIAIOSFODNN7EXAMPLE"
                required
              />
<Input
                label="Secret Key"
                type="password"
                value={formData.secretKey}
                onChange={(e) => handleInputChange('secretKey', e.target.value)}
                error={formErrors.secretKey}
                placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCY..."
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Region"
                value={formData.region}
                onChange={(e) => handleInputChange('region', e.target.value)}
                error={formErrors.region}
                placeholder="us-east-1"
                required
              />

              <Input
                label="Bucket Name"
                value={formData.bucketName}
                onChange={(e) => handleInputChange('bucketName', e.target.value)}
                error={formErrors.bucketName}
placeholder="my-s3-bucket"
                required
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleTestConnection}
                loading={testing}
                variant="outline"
                icon="Zap"
              >
                Test Connection
              </Button>
              
              <Button
                onClick={handleSaveConfig}
                icon="Save"
                variant="primary"
              >
                Save Configuration
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Saved Configurations */}
      {configs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <h3 className="text-lg font-semibold text-gray-900">Saved Configurations</h3>
          
          <div className="space-y-3">
            {configs.map((config) => (
              <motion.div
                key={config.Id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`card p-4 ${config.isActive ? 'ring-2 ring-aws-orange' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-gray-900">{config.name}</h4>
                      {config.isActive && (
                        <span className="bg-gradient-to-r from-aws-orange to-orange-500 text-white text-xs px-2 py-1 rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {config.bucketName} • {config.region}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {!config.isActive && (
                      <Button
                        onClick={() => handleSetActive(config.Id)}
                        variant="outline"
                        size="sm"
                        icon="Power"
                      >
                        Activate
                      </Button>
                    )}
                    
                    <Button
                      onClick={() => handleDeleteConfig(config.Id)}
                      variant="ghost"
                      size="sm"
                      icon="Trash2"
                      className="text-error hover:text-error hover:bg-error/10"
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default ConfigurationPanel