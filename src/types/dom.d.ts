// Extended DOM types for file system access

declare global {
  interface HTMLInputElement {
    webkitdirectory?: boolean
    webkitEntries?: FileSystemEntry[]
  }

  interface FileSystemEntry {
    readonly isFile: boolean
    readonly isDirectory: boolean
    readonly name: string
    readonly fullPath: string
  }

  interface FileSystemFileEntry extends FileSystemEntry {
    file(callback: (file: File) => void): void
  }

  interface FileSystemDirectoryEntry extends FileSystemEntry {
    createReader(): FileSystemDirectoryReader
  }

  interface FileSystemDirectoryReader {
    readEntries(callback: (entries: FileSystemEntry[]) => void): void
  }

  interface DataTransferItem {
    webkitGetAsEntry(): FileSystemEntry | null
  }
}

export {}