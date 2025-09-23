'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  FileSpreadsheet,
  FileText,
  Upload,
  ArrowRight,
  HelpCircle,
  Info
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from '@/lib/utils'

type FileType = 'spreadsheet' | 'pdf' | null

interface FileTypeSelectorProps {
  onFileTypeSelect: (fileType: FileType) => void
  selectedType?: FileType
}

interface FileTypeOption {
  id: FileType
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  formats: string[]
  features: string[]
  recommended?: boolean
}

export function FileTypeSelector({ onFileTypeSelect, selectedType }: FileTypeSelectorProps) {
  const t = useTranslations('import')
  const [hoveredType, setHoveredType] = useState<FileType>(null)

  const fileTypeOptions: FileTypeOption[] = [
    {
      id: 'spreadsheet',
      title: 'Spreadsheet Import',
      description: 'Upload CSV or Excel files for bulk invoice import',
      icon: FileSpreadsheet,
      formats: ['CSV', 'XLS', 'XLSX'],
      features: [
        'Bulk import multiple invoices',
        'Field mapping and validation',
        'Preview before import',
        'Error reporting and correction'
      ],
      recommended: true
    },
    {
      id: 'pdf',
      title: 'PDF Upload',
      description: 'Upload individual PDF invoices with AI-powered data extraction',
      icon: FileText,
      formats: ['PDF'],
      features: [
        'AI-powered data extraction',
        'Single invoice processing',
        'Review and edit extracted data',
        'High accuracy recognition'
      ]
    }
  ]

  const handleTypeSelect = (type: FileType) => {
    onFileTypeSelect(type)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
          <Upload className="h-6 w-6 text-primary" />
          Choose Upload Method
        </h2>
        <p className="text-muted-foreground">
          Select how you'd like to upload your invoices to get started
        </p>
      </div>

      {/* File Type Options */}
      <div className="grid md:grid-cols-2 gap-6">
        {fileTypeOptions.map((option) => {
          const Icon = option.icon
          const isSelected = selectedType === option.id
          const isHovered = hoveredType === option.id

          return (
            <Card
              key={option.id}
              className={cn(
                "relative cursor-pointer transition-all duration-200 hover:shadow-lg",
                isSelected && "ring-2 ring-primary border-primary",
                isHovered && "shadow-md scale-[1.02]"
              )}
              onMouseEnter={() => setHoveredType(option.id)}
              onMouseLeave={() => setHoveredType(null)}
              onClick={() => handleTypeSelect(option.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{option.title}</CardTitle>
                      {option.recommended && (
                        <Badge variant="secondary" className="mt-1">
                          Recommended
                        </Badge>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="text-primary">
                      <ArrowRight className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <CardDescription className="mt-2">
                  {option.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Supported Formats */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Supported Formats
                  </h4>
                  <div className="flex gap-2 flex-wrap">
                    {option.formats.map((format) => (
                      <Badge key={format} variant="outline" className="text-xs">
                        {format}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Key Features */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Key Features
                  </h4>
                  <ul className="space-y-1 text-sm">
                    {option.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <div className="w-1 h-1 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Button */}
                <Button
                  variant={isSelected ? "default" : "outline"}
                  className="w-full mt-4"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTypeSelect(option.id)
                  }}
                >
                  {isSelected ? 'Selected' : 'Select This Method'}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Help Information */}
      <Alert>
        <HelpCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Need help choosing?</strong> For multiple invoices, use Spreadsheet Import.
          For single PDF invoices, use PDF Upload for automatic data extraction.
        </AlertDescription>
      </Alert>

      {/* Continue Button */}
      {selectedType && (
        <div className="flex justify-center pt-4">
          <Button
            size="lg"
            className="gap-2"
            onClick={() => onFileTypeSelect(selectedType)}
          >
            Continue with {selectedType === 'spreadsheet' ? 'Spreadsheet Import' : 'PDF Upload'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}