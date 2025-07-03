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
const serializeForApper = (obj, visited = new WeakSet()) => {
  try {
    // Handle null/undefined
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    // Handle primitives
    if (typeof obj !== 'object') {
      return obj;
    }
    
    // Handle circular references
    if (visited.has(obj)) {
      return '[Circular Reference]';
    }
    visited.add(obj);
    
    // Handle specific problematic types
    if (obj instanceof Request) {
      return {
        __type: 'Request',
        url: obj.url,
        method: obj.method,
        headers: Object.fromEntries(obj.headers || [])
      };
    }
    
    if (obj instanceof Response) {
      return {
        __type: 'Response',
        status: obj.status,
        statusText: obj.statusText,
        url: obj.url
      };
    }
    
    if (obj instanceof Promise) {
      return { __type: 'Promise', state: 'pending' };
    }
    
    if (typeof obj === 'function') {
      return { __type: 'Function', name: obj.name || 'anonymous' };
    }
    
    if (obj instanceof Error) {
      return {
        __type: 'Error',
        name: obj.name,
        message: obj.message
      };
    }
    
    if (obj instanceof Date) {
      return { __type: 'Date', value: obj.toISOString() };
    }
    
    if (obj instanceof File) {
      return {
        __type: 'File',
        name: obj.name,
        size: obj.size,
        type: obj.type
      };
    }
    
    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => serializeForApper(item, visited));
    }
    
    // Handle objects - create a clean copy
    const serialized = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        try {
          serialized[key] = serializeForApper(obj[key], visited);
        } catch (error) {
          console.warn(`Failed to serialize property ${key}:`, error);
          serialized[key] = '[Serialization Error]';
        }
      }
    }
    
    return serialized;
  } catch (error) {
    console.error('Apper serialization error:', error);
    return { error: 'Serialization failed', originalType: typeof obj };
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
      
      const testData = {
        accessKey: formData.accessKey?.trim(),
        secretKey: formData.secretKey?.trim(),
        region: formData.region?.trim(),
        bucketName: formData.bucketName?.trim()
      }
      
      const result = await bucketConfigService.testConnection(testData)
      
      if (result.success) {
        toast.success('Connection test successful!')
      } else {
        toast.error(result.message || 'Connection test failed')
      }
    } catch (err) {
      console.error('Test connection error:', err)
      toast.error(err.message || 'Failed to test connection')
    } finally {
      setTesting(false)
    }
  }
const handleSaveConfig = async () => {
    if (!validateForm()) return
    
    try {
      const configData = {
        name: formData.name.trim(),
        accessKey: formData.accessKey.trim(),
        secretKey: formData.secretKey.trim(),
        region: formData.region.trim(),
        bucketName: formData.bucketName.trim()
      }
      
      const savedConfig = await bucketConfigService.save(configData)
      
      // Update local state
      setConfigs(prev => [...prev, savedConfig])
      
      // Send notification to Apper if available with enhanced error handling
      if (window.Apper) {
        try {
          const apperNotificationData = serializeForApper({
            type: 'config_saved',
            data: savedConfig,
            timestamp: new Date().toISOString()
          });
          
          // Validate serialization worked
          const testSerialization = JSON.stringify(apperNotificationData);
          JSON.parse(testSerialization);
          
          window.Apper.sendNotification(apperNotificationData);
        } catch (error) {
          console.error('Failed to send Apper notification:', error);
          
          // Send minimal fallback notification
          try {
            window.Apper.sendNotification({
              type: 'config_saved',
              status: 'success',
              timestamp: new Date().toISOString()
            });
          } catch (fallbackError) {
            console.error('Even fallback Apper notification failed:', fallbackError);
          }
        }
      }
      
      // Reset form and hide it
      setFormData({
        name: '',
        accessKey: '',
        secretKey: '',
        region: 'us-east-1',
        bucketName: ''
      })
      setShowForm(false)
      
      // Notify Apper about the new configuration with safe postMessage
      if (window.parent && window.parent.postMessage) {
        const apperNotificationData = serializeForApper({
          type: 'S3_CONFIG_SAVED',
          config: {
            id: savedConfig.id,
            name: savedConfig.name,
            bucketName: savedConfig.bucketName,
            region: savedConfig.region,
            savedAt: new Date().toISOString()
          }
        })
        
        try {
          // Use global safePostMessage if available
          if (window.safePostMessage) {
            window.safePostMessage(window.parent, apperNotificationData, '*')
          } else {
            window.parent.postMessage(apperNotificationData, '*')
          }
        } catch (postError) {
          console.warn('Failed to notify Apper about config save:', postError)
          if (postError.name === 'DataCloneError') {
            console.error('DataCloneError: Configuration data contains non-cloneable objects')
            // Send minimal fallback notification
            try {
              window.parent.postMessage({
                type: 'S3_CONFIG_SAVED_ERROR',
                error: 'Configuration saved but notification failed due to data serialization',
                configId: savedConfig.id,
                timestamp: Date.now()
              }, '*')
            } catch (fallbackError) {
              console.error('Even fallback notification failed:', fallbackError)
            }
          }
        }
      }
      
      // Call callback if provided
      if (onConfigSaved) {
        const serializedConfig = serializeForApper({
          id: savedConfig.id,
          name: savedConfig.name,
          bucketName: savedConfig.bucketName,
          region: savedConfig.region,
          isActive: savedConfig.isActive,
          createdAt: savedConfig.createdAt
        })
        onConfigSaved(serializedConfig)
      }
      
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
      
      // Notify Apper about the active config change with safe postMessage
      if (window.parent && window.parent.postMessage) {
        const serializedConfig = serializeForApper({
          type: 'S3_CONFIG_ACTIVATED',
          config: {
            id: updatedConfig.Id,
            name: updatedConfig.name,
            bucketName: updatedConfig.bucketName,
            region: updatedConfig.region,
            isActive: updatedConfig.isActive,
            activatedAt: new Date().toISOString()
          }
        })
        
        try {
          // Use global safePostMessage if available
          if (window.safePostMessage) {
            window.safePostMessage(window.parent, serializedConfig, '*')
          } else {
            window.parent.postMessage(serializedConfig, '*')
          }
        } catch (postError) {
          console.warn('Failed to notify Apper about config activation:', postError)
          if (postError.name === 'DataCloneError') {
            console.error('DataCloneError: Config activation data contains non-cloneable objects')
            // Send minimal fallback notification
            try {
              window.parent.postMessage({
                type: 'S3_CONFIG_ACTIVATED_ERROR',
                error: 'Configuration activated but notification failed due to data serialization',
                configId: updatedConfig.Id,
                timestamp: Date.now()
              }, '*')
            } catch (fallbackError) {
              console.error('Even fallback notification failed:', fallbackError)
            }
          }
        }
      }
      
      // Serialize config data to prevent DataCloneError
      const serializedConfig = serializeForApper({
        Id: updatedConfig.Id,
        name: updatedConfig.name,
        bucketName: updatedConfig.bucketName,
        region: updatedConfig.region,
        isActive: updatedConfig.isActive,
        activatedAt: new Date().toISOString()
      })
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
      
      // Send notification to Apper if available with enhanced error handling
      if (window.Apper) {
        try {
          const serializedConfig = serializeForApper({
            type: 'config_deleted',
            configId: configId,
            timestamp: new Date().toISOString()
          });
          
          // Validate serialization worked
          const testSerialization = JSON.stringify(serializedConfig);
          JSON.parse(testSerialization);
          
          window.Apper.sendNotification(serializedConfig);
        } catch (error) {
          console.error('Failed to send Apper deletion notification:', error);
          
          // Send minimal fallback notification
          try {
            window.Apper.sendNotification({
              type: 'config_deleted',
              configId: configId,
              timestamp: new Date().toISOString()
            });
          } catch (fallbackError) {
            console.error('Even fallback Apper deletion notification failed:', fallbackError);
          }
        }
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