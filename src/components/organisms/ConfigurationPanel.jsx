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

// Enhanced safe serialization function for Apper communication
function serializeForApper(obj, visited = new WeakSet()) {
  try {
    // Handle null/undefined/primitives first
    if (obj === null || obj === undefined) return obj;
    
    // Handle primitives - exclude problematic types
    if (typeof obj !== 'object') {
      if (typeof obj === 'function' || typeof obj === 'symbol' || typeof obj === 'undefined') {
        return null; // Return null instead of string representation
      }
      // Handle bigint
      if (typeof obj === 'bigint') {
        return obj.toString();
      }
      return obj;
    }
    
    // Handle circular references
    if (visited.has(obj)) {
      return null; // Return null instead of string to avoid cloning issues
    }
    visited.add(obj);
    
    // Handle Date objects first (before general object checking)
    if (obj instanceof Date) {
      return obj.toISOString();
    }
    
// Handle all non-cloneable Web API objects and DOM elements comprehensively
    if ((typeof Request !== 'undefined' && obj instanceof Request) || 
        (typeof Response !== 'undefined' && obj instanceof Response) || 
        (typeof FormData !== 'undefined' && obj instanceof FormData) || 
        (typeof File !== 'undefined' && obj instanceof File) || 
        (typeof Blob !== 'undefined' && obj instanceof Blob) || 
        (typeof ArrayBuffer !== 'undefined' && obj instanceof ArrayBuffer) ||
        (typeof Element !== 'undefined' && obj instanceof Element) || 
        (typeof Node !== 'undefined' && obj instanceof Node) ||
        obj instanceof Error || obj instanceof RegExp ||
        obj instanceof Map || obj instanceof Set ||
        obj instanceof Promise || obj instanceof WeakMap ||
        obj instanceof WeakSet || 
        (typeof SharedArrayBuffer !== 'undefined' && obj instanceof SharedArrayBuffer) ||
        obj.constructor?.name?.includes('Request') ||
        obj.constructor?.name?.includes('Response') ||
        obj.constructor?.name?.includes('Element') ||
        obj.constructor?.name?.includes('HTML') ||
        obj.constructor?.name?.includes('SVG') ||
        obj.nodeType !== undefined || // DOM nodes
        obj.window !== undefined || // Window objects
        typeof obj.then === 'function' || // Promises and thenables
        obj.constructor?.name?.includes('Stream') // Streams
      ) {
      return null; // Return null to completely avoid serialization
    }
    
    // Handle Arrays
    if (Array.isArray(obj)) {
      const cleaned = obj.map(item => serializeForApper(item, visited))
                        .filter(item => item !== null && item !== undefined);
      visited.delete(obj);
      return cleaned;
    }
    
    // Handle plain objects - only process enumerable own properties
    const result = {};
    
    try {
      // Use Object.entries for better safety
      for (const [key, value] of Object.entries(obj)) {
        // Skip non-string keys
        if (typeof key !== 'string') continue;
        
        const serializedValue = serializeForApper(value, visited);
        if (serializedValue !== null && serializedValue !== undefined) {
          result[key] = serializedValue;
        }
      }
    } catch (error) {
      console.warn('Error during object serialization:', error);
      visited.delete(obj);
      return null;
    }
    
    visited.delete(obj);
    return result;
  } catch (error) {
    console.error('Critical serialization error:', error);
    return null; // Return null instead of error object
  }
}

// Enhanced validation for serialized data with comprehensive checks
function validateSerializedData(data) {
  if (data === null || data === undefined) return true;
  
  try {
    // Test JSON serialization/deserialization round trip
    const jsonString = JSON.stringify(data);
    if (jsonString === undefined || jsonString === null) return false;
    
    const parsed = JSON.parse(jsonString);
    if (parsed === undefined) return false;
    
    // Deep validation to ensure no problematic data
    const validateDeep = (obj, depth = 0) => {
      // Prevent infinite recursion
      if (depth > 50) return false;
      
      if (obj === null || obj === undefined) return true;
      if (typeof obj !== 'object') {
        // Check for non-serializable primitives
        return typeof obj !== 'function' && typeof obj !== 'symbol' && typeof obj !== 'undefined';
      }
      
// Check for problematic object types
      if ((typeof Request !== 'undefined' && obj instanceof Request) || 
          (typeof Response !== 'undefined' && obj instanceof Response) || 
          (typeof FormData !== 'undefined' && obj instanceof FormData) || 
          (typeof File !== 'undefined' && obj instanceof File) || 
          (typeof Blob !== 'undefined' && obj instanceof Blob) || 
          obj instanceof Error ||
          (typeof ArrayBuffer !== 'undefined' && obj instanceof ArrayBuffer) || 
          (typeof SharedArrayBuffer !== 'undefined' && obj instanceof SharedArrayBuffer) ||
          obj.constructor?.name?.includes('Request') ||
          obj.constructor?.name?.includes('Response') ||
          obj.constructor?.name?.includes('Stream') ||
          obj.nodeType !== undefined) {
        return false;
      }
      
      if (Array.isArray(obj)) {
        return obj.every(item => validateDeep(item, depth + 1));
      }
      
      // Validate object properties
      try {
        for (const [key, value] of Object.entries(obj)) {
          if (typeof key !== 'string') return false;
          if (!validateDeep(value, depth + 1)) return false;
        }
        return true;
      } catch (error) {
        return false;
      }
    };
    
    return validateDeep(parsed);
  } catch (error) {
    console.error('Data validation failed:', error);
    return false;
  }
}

// Enhanced safe postMessage wrapper with comprehensive error handling
function safePostMessage(targetWindow, data, targetOrigin = '*') {
  try {
    // First serialize the data
    const serializedData = serializeForApper(data);
    
    // Validate serialized data
    if (!validateSerializedData(serializedData)) {
      console.warn('Data failed validation before postMessage');
      return false;
    }
    
    // Final JSON test
    const testSerialization = JSON.stringify(serializedData);
    if (testSerialization === undefined) {
      console.warn('Final JSON serialization failed');
      return false;
    }
    
    targetWindow.postMessage(serializedData, targetOrigin);
    return true;
  } catch (error) {
    console.error('SafePostMessage failed:', error);
    
    // Handle specific DataCloneError
    if (error.name === 'DataCloneError' || error.message.includes('DataCloneError')) {
      console.error('DataCloneError detected - attempting minimal fallback');
      try {
        // Send minimal error notification
        targetWindow.postMessage({
          type: 'SERIALIZATION_ERROR',
          error: 'DataCloneError',
          timestamp: Date.now()
        }, targetOrigin);
      } catch (fallbackError) {
        console.error('Even minimal fallback failed:', fallbackError);
      }
    }
    
    return false;
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
            data: {
              id: String(savedConfig?.id || ''),
              name: String(savedConfig?.name || ''),
              bucketName: String(savedConfig?.bucketName || ''),
              region: String(savedConfig?.region || ''),
              isActive: Boolean(savedConfig?.isActive)
            },
            timestamp: Date.now()
          });
          
          // Enhanced validation
          if (!validateSerializedData(apperNotificationData)) {
            throw new Error('Data validation failed - contains non-serializable content');
          }
          
          window.Apper.sendNotification(apperNotificationData);
        } catch (error) {
          console.error('Failed to send Apper notification:', error);
          
          // Guaranteed safe fallback notification
          try {
            const fallbackData = {
              type: 'config_saved',
              status: 'success',
              configId: String(savedConfig?.id || 'unknown'),
              timestamp: Date.now()
            };
            
            window.Apper.sendNotification(fallbackData);
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
      
// Notify Apper about the new configuration with enhanced safe postMessage
      if (window.parent && window.parent.postMessage) {
        const apperNotificationData = serializeForApper({
          type: 'S3_CONFIG_SAVED',
          config: {
            id: String(savedConfig.id || ''),
            name: String(savedConfig.name || ''),
            bucketName: String(savedConfig.bucketName || ''),
            region: String(savedConfig.region || ''),
            savedAt: Date.now()
          }
        });
        
        // Use the enhanced safePostMessage function
        const success = safePostMessage(window.parent, apperNotificationData, '*');
        
        if (!success) {
          console.warn('Failed to notify Apper about config save, sending minimal fallback');
          // Send guaranteed safe fallback notification
          const fallbackData = {
            type: 'S3_CONFIG_SAVED_ERROR',
            error: 'notification_failed',
            configId: String(savedConfig.id || 'unknown'),
            timestamp: Date.now()
          };
          
          try {
            window.parent.postMessage(fallbackData, '*');
          } catch (fallbackError) {
            console.error('Even minimal fallback notification failed:', fallbackError);
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
      
// Notify Apper about the active config change with enhanced safe postMessage
      if (window.parent && window.parent.postMessage) {
        const serializedConfig = serializeForApper({
          type: 'S3_CONFIG_ACTIVATED',
          config: {
            id: String(updatedConfig.id || updatedConfig.Id || ''),
            name: String(updatedConfig.name || ''),
            bucketName: String(updatedConfig.bucketName || ''),
            region: String(updatedConfig.region || ''),
            isActive: Boolean(updatedConfig.isActive),
            activatedAt: Date.now()
          }
        });
        
        // Use the enhanced safePostMessage function
        const success = safePostMessage(window.parent, serializedConfig, '*');
        
        if (!success) {
          console.warn('Failed to notify Apper about config activation, sending minimal fallback');
          // Send guaranteed safe fallback notification
          const fallbackData = {
            type: 'S3_CONFIG_ACTIVATED_ERROR',
            error: 'notification_failed',
            configId: String(updatedConfig.id || updatedConfig.Id || 'unknown'),
            timestamp: Date.now()
          };
          
          try {
            window.parent.postMessage(fallbackData, '*');
          } catch (fallbackError) {
            console.error('Even minimal fallback notification failed:', fallbackError);
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
            configId: String(configId || ''),
            timestamp: Date.now()
          });
          
          // Enhanced validation
          if (!validateSerializedData(serializedConfig)) {
            throw new Error('Data validation failed - contains non-serializable content');
          }
          
          window.Apper.sendNotification(serializedConfig);
        } catch (error) {
          console.error('Failed to send Apper deletion notification:', error);
          
          // Guaranteed safe fallback notification
          try {
            const fallbackData = {
              type: 'config_deleted',
              configId: String(configId || 'unknown'),
              timestamp: Date.now()
            };
            
            window.Apper.sendNotification(fallbackData);
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