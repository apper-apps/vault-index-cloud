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

const ConfigurationPanel = ({ onConfigSaved, className = "" }) => {
  const [configs, setConfigs] = useState([])
  const [activeConfig, setActiveConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [testing, setTesting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    accessKey: '',
    secretKey: '',
    region: 'us-east-1',
    bucketName: ''
  })

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
      await bucketConfigService.testConnection(formData)
      toast.success('Connection test successful!')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setTesting(false)
    }
  }

const handleSaveConfig = async () => {
    if (!validateForm()) return
    
    try {
      const savedConfig = await bucketConfigService.create(formData)
      
      // Create completely serializable config for postMessage compatibility
      const serializableConfig = {
        Id: savedConfig.Id,
        name: savedConfig.name,
        bucketName: savedConfig.bucketName,
        region: savedConfig.region,
        isActive: savedConfig.isActive,
        createdAt: savedConfig.createdAt ? 
          (typeof savedConfig.createdAt === 'string' ? savedConfig.createdAt : new Date(savedConfig.createdAt).toISOString()) : 
          null
      }
      
      setConfigs(prev => [...prev, savedConfig])
      setActiveConfig(savedConfig)
      setFormData({
        name: '',
        accessKey: '',
        secretKey: '',
        region: 'us-east-1',
        bucketName: ''
      })
      setShowForm(false)
      toast.success('Configuration saved successfully!')
      
      // Safe callback with error handling and serialization verification
      try {
        // Double-check serializability before callback
        JSON.stringify(serializableConfig)
        onConfigSaved?.(serializableConfig)
      } catch (callbackError) {
        console.error('Callback error:', callbackError)
        // Fallback with minimal safe config
        const minimalConfig = {
          Id: savedConfig.Id,
          name: savedConfig.name,
          isActive: savedConfig.isActive
        }
        try {
          onConfigSaved?.(minimalConfig)
        } catch (fallbackError) {
          console.error('Fallback callback also failed:', fallbackError)
        }
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to save configuration')
    }
  }

const handleSetActive = async (configId) => {
    try {
      const updatedConfig = await bucketConfigService.setActive(configId)
      
      // Create completely serializable version for postMessage
      const serializableConfig = {
        Id: updatedConfig.Id,
        name: updatedConfig.name,
        bucketName: updatedConfig.bucketName,
        region: updatedConfig.region,
        isActive: updatedConfig.isActive,
        updatedAt: updatedConfig.updatedAt ? 
          (typeof updatedConfig.updatedAt === 'string' ? updatedConfig.updatedAt : new Date(updatedConfig.updatedAt).toISOString()) : 
          null
      }
      
      setActiveConfig(updatedConfig)
      setConfigs(prev => prev.map(c => ({ ...c, isActive: c.Id === configId })))
      toast.success('Configuration activated!')
      
      // Safe callback with error handling and serialization verification
      try {
        // Double-check serializability before callback
        JSON.stringify(serializableConfig)
        onConfigSaved?.(serializableConfig)
      } catch (callbackError) {
        console.error('Callback error:', callbackError)
        // Fallback with minimal safe config
        const minimalConfig = {
          Id: updatedConfig.Id,
          name: updatedConfig.name,
          isActive: updatedConfig.isActive
        }
        try {
          onConfigSaved?.(minimalConfig)
        } catch (fallbackError) {
          console.error('Fallback callback also failed:', fallbackError)
        }
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to activate configuration')
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