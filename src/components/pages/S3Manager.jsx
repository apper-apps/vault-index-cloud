import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import ApperIcon from "@/components/ApperIcon";
import ConfigurationPanel from "@/components/organisms/ConfigurationPanel";
import FileUploader from "@/components/organisms/FileUploader";
import FileBrowser from "@/components/organisms/FileBrowser";
import bucketConfigService from "@/services/api/bucketConfigService";

const S3Manager = () => {
  const [activeConfig, setActiveConfig] = useState(null)
  const [currentPath, setCurrentPath] = useState('')
  const [activeTab, setActiveTab] = useState('browser')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadActiveConfig()
  }, [])

  const loadActiveConfig = async () => {
    try {
      setLoading(true)
      const config = await bucketConfigService.getActive()
      setActiveConfig(config)
    } catch (err) {
      console.error('Failed to load active config:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleConfigSaved = (config) => {
    setActiveConfig(config)
    toast.success('Configuration updated successfully!')
  }

  const handlePathChange = (newPath) => {
    setCurrentPath(newPath)
  }

const handleUploadComplete = () => {
    // Refresh file browser if it's the active tab
    if (activeTab === 'browser') {
      window.dispatchEvent(new window.CustomEvent('refreshFiles'))
    }
    // Force a reload of the active config to ensure consistency
    loadActiveConfig()
  }

  const handleRefresh = () => {
    // Trigger refresh for file browser
    window.dispatchEvent(new window.CustomEvent('refreshFiles'))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-aws-gray via-white to-gray-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-3 border-aws-orange border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-aws-gray via-white to-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-aws-orange to-orange-500 rounded-lg flex items-center justify-center">
                <ApperIcon name="Cloud" className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">S3 Vault</h1>
                <p className="text-sm text-gray-600">AWS S3 File Manager</p>
              </div>
            </div>

            {activeConfig && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                <span className="text-sm text-gray-700">
                  Connected to <span className="font-medium">{activeConfig.bucketName}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!activeConfig ? (
          /* Configuration Setup */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-aws-orange to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <ApperIcon name="Settings" className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome to S3 Vault</h2>
              <p className="text-lg text-gray-600">Configure your AWS S3 credentials to get started</p>
            </div>

            <ConfigurationPanel onConfigSaved={handleConfigSaved} />
          </motion.div>
        ) : (
          /* Main Application */
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="card p-6 sticky top-8">
                <nav className="space-y-2">
                  <button
                    onClick={() => setActiveTab('browser')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                      activeTab === 'browser'
                        ? 'bg-gradient-to-r from-aws-orange to-orange-500 text-white shadow-lg'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <ApperIcon name="FolderOpen" className="w-5 h-5" />
                    <span className="font-medium">File Browser</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('upload')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                      activeTab === 'upload'
                        ? 'bg-gradient-to-r from-aws-orange to-orange-500 text-white shadow-lg'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <ApperIcon name="Upload" className="w-5 h-5" />
                    <span className="font-medium">Upload Files</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('config')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                      activeTab === 'config'
                        ? 'bg-gradient-to-r from-aws-orange to-orange-500 text-white shadow-lg'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <ApperIcon name="Settings" className="w-5 h-5" />
                    <span className="font-medium">Configuration</span>
                  </button>
                </nav>

                {/* Current Path Display */}
                {currentPath && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Current Location</h3>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <ApperIcon name="FolderOpen" className="w-4 h-4" />
                        <span className="truncate">/{currentPath}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="min-h-96"
              >
                {activeTab === 'browser' && (
                  <FileBrowser
                    currentPath={currentPath}
                    onPathChange={handlePathChange}
                    onRefresh={handleRefresh}
                  />
                )}

                {activeTab === 'upload' && (
                  <FileUploader
                    currentPath={currentPath}
                    onUploadComplete={handleUploadComplete}
                  />
                )}

                {activeTab === 'config' && (
                  <ConfigurationPanel onConfigSaved={handleConfigSaved} />
                )}
              </motion.div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default S3Manager