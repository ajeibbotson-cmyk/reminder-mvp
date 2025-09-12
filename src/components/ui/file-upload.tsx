'use client'

import { useState, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Upload, FileText, X, AlertCircle, Check, FileSpreadsheet, Image } from 'lucide-react'
import { Button } from "./button"
import { Card } from "./card"
import { Progress } from "./progress"
import { Badge } from "./badge"
import { Alert, AlertDescription } from "./alert"
import { cn } from '@/lib/utils'

interface FileUploadProps {
  onFileSelect: (files: File[]) => void
  onFileRemove?: (index: number) => void
  acceptedTypes?: string[]
  maxFiles?: number
  maxFileSize?: number // in bytes
  isLoading?: boolean
  uploadProgress?: number
  error?: string
  className?: string
  locale?: string
  allowMultiple?: boolean
  showPreview?: boolean
  placeholder?: string
  description?: string
}

interface UploadedFile {
  file: File
  preview?: string
  id: string
}

export function FileUpload({
  onFileSelect,
  onFileRemove,
  acceptedTypes = ['.csv', '.xlsx', '.xls'],
  maxFiles = 1,
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  isLoading = false,
  uploadProgress,
  error,
  className,
  locale = 'en',
  allowMultiple = false,
  showPreview = true,
  placeholder,
  description
}: FileUploadProps) {
  const t = useTranslations('fileUpload')
  const [dragActive, setDragActive] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isValidFile = useCallback((file: File): { valid: boolean; error?: string } => {
    // Check file type
    if (acceptedTypes.length > 0) {
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
      const isValidType = acceptedTypes.some(type => 
        type.toLowerCase() === fileExtension || 
        file.type.includes(type.replace('.', ''))
      )
      
      if (!isValidType) {
        return {
          valid: false,
          error: `File type not supported. Accepted types: ${acceptedTypes.join(', ')}`
        }
      }
    }

    // Check file size
    if (file.size > maxFileSize) {
      return {
        valid: false,
        error: `File size exceeds ${formatFileSize(maxFileSize)} limit`
      }
    }

    return { valid: true }
  }, [acceptedTypes, maxFileSize])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const validFiles: File[] = []
    const errors: string[] = []

    // Check if adding files would exceed max limit
    if (uploadedFiles.length + fileArray.length > maxFiles) {
      errors.push(`Maximum ${maxFiles} ${maxFiles === 1 ? 'file' : 'files'} allowed`)
      return { validFiles: [], errors }
    }

    fileArray.forEach(file => {
      const validation = isValidFile(file)
      if (validation.valid) {
        validFiles.push(file)
      } else if (validation.error) {
        errors.push(`${file.name}: ${validation.error}`)
      }
    })

    return { validFiles, errors }
  }, [uploadedFiles.length, maxFiles, isValidFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files) {
      const { validFiles, errors } = processFiles(e.dataTransfer.files)
      
      if (errors.length > 0) {
        // Handle errors - you might want to pass this up to parent
        console.error('File validation errors:', errors)
        return
      }

      if (validFiles.length > 0) {
        handleFileSelection(validFiles)
      }
    }
  }, [processFiles])

  const handleFileSelection = useCallback((files: File[]) => {
    const newFiles: UploadedFile[] = files.map(file => ({
      file,
      id: `${Date.now()}-${file.name}`,
      preview: showPreview && file.type.startsWith('image/') 
        ? URL.createObjectURL(file) 
        : undefined
    }))

    setUploadedFiles(prev => [...prev, ...newFiles])
    onFileSelect(files)
  }, [onFileSelect, showPreview])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const { validFiles, errors } = processFiles(e.target.files)
      
      if (errors.length > 0) {
        console.error('File validation errors:', errors)
        return
      }

      if (validFiles.length > 0) {
        handleFileSelection(validFiles)
      }
    }
  }, [processFiles, handleFileSelection])

  const removeFile = useCallback((index: number) => {
    const fileToRemove = uploadedFiles[index]
    
    // Cleanup preview URL if it exists
    if (fileToRemove.preview) {
      URL.revokeObjectURL(fileToRemove.preview)
    }

    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
    onFileRemove?.(index)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [uploadedFiles, onFileRemove])

  const getFileIcon = (file: File) => {
    if (file.type.includes('spreadsheet') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
      return FileSpreadsheet
    }
    if (file.type.startsWith('image/')) {
      return Image
    }
    return FileText
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Upload Area */}
      <Card
        className={cn(
          "relative border-2 border-dashed p-6 text-center transition-colors cursor-pointer",
          dragActive && "border-primary bg-primary/10",
          isLoading && "pointer-events-none opacity-50",
          error && "border-destructive bg-destructive/10"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !isLoading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleFileInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isLoading}
          multiple={allowMultiple && maxFiles > 1}
        />
        
        <div className="space-y-4">
          <Upload className={cn(
            "mx-auto h-12 w-12 transition-colors",
            dragActive ? "text-primary" : "text-gray-400"
          )} />
          
          <div>
            <p className="text-lg font-medium">
              {placeholder || (dragActive ? t('dropFiles') : t('dragAndDrop'))}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {description || t('supportedFormats', { formats: acceptedTypes.join(', ') })}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {t('maxFileSize', { size: formatFileSize(maxFileSize) })} • {t('maxFiles', { count: maxFiles })}
            </p>
          </div>
          
          <Button variant="outline" type="button" disabled={isLoading}>
            {t('browseFiles')}
          </Button>
        </div>
      </Card>

      {/* Upload Progress */}
      {uploadProgress !== undefined && uploadProgress > 0 && (
        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{t('uploading')}</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <Card className="p-4">
          <h4 className="font-medium mb-3">
            {t('uploadedFiles')} ({uploadedFiles.length}/{maxFiles})
          </h4>
          <div className="space-y-3">
            {uploadedFiles.map((uploadedFile, index) => {
              const FileIcon = getFileIcon(uploadedFile.file)
              
              return (
                <div
                  key={uploadedFile.id}
                  className="flex items-center gap-3 p-3 border rounded-lg"
                >
                  {uploadedFile.preview ? (
                    <img
                      src={uploadedFile.preview}
                      alt="Preview"
                      className="w-10 h-10 object-cover rounded"
                    />
                  ) : (
                    <FileIcon className="h-10 w-10 text-blue-500" />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {uploadedFile.file.name}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>{formatFileSize(uploadedFile.file.size)}</span>
                      <Badge variant="outline" className="text-xs">
                        {uploadedFile.file.type || 'Unknown'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFile(index)
                      }}
                      disabled={isLoading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}