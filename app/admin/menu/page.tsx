'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Pencil, Trash2, Upload, X, Eye, EyeOff, Loader2, FileSpreadsheet, Check, AlertCircle, Settings, Search } from 'lucide-react'
import Link from 'next/link'
import type { MenuCategory, AdminMenuItem, VariantGroup } from '@/lib/types'

const CATEGORIES: { value: 'all' | MenuCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'donuts', label: 'Donuts' },
  { value: 'drinks', label: 'Drinks' },
]

interface VariantFormGroup {
  name: string
  options: string // comma-separated
}

interface ItemForm {
  name: string
  description: string
  price: string
  category: MenuCategory
  is_taxable: boolean
  image_url: string
  variants: VariantFormGroup[]
}

const EMPTY_FORM: ItemForm = {
  name: '',
  description: '',
  price: '',
  category: 'donuts',
  is_taxable: true,
  image_url: '',
  variants: [],
}

interface CsvRow {
  name: string
  description: string
  price: number
  category: MenuCategory
  is_taxable: boolean
  image_url: string | null
  _imageFile?: File | null
  _uploading?: boolean
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''))
  const nameIdx = header.findIndex(h => h === 'name')
  const descIdx = header.findIndex(h => h.includes('desc'))
  const priceIdx = header.findIndex(h => h === 'price')
  const catIdx = header.findIndex(h => h.includes('cat'))
  const taxIdx = header.findIndex(h => h.includes('tax'))

  if (nameIdx === -1 || priceIdx === -1) return []

  const validCategories = ['breakfast', 'donuts', 'drinks']

  return lines.slice(1).map(line => {
    // Handle quoted fields with commas
    const fields: string[] = []
    let current = ''
    let inQuotes = false
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue }
      if (char === ',' && !inQuotes) { fields.push(current.trim()); current = ''; continue }
      current += char
    }
    fields.push(current.trim())

    const rawCat = catIdx >= 0 ? fields[catIdx]?.toLowerCase() : ''
    const category = validCategories.includes(rawCat) ? rawCat as MenuCategory : 'donuts'

    const rawTax = taxIdx >= 0 ? fields[taxIdx]?.toLowerCase() : 'yes'
    const is_taxable = !['no', 'false', '0', 'n'].includes(rawTax)

    return {
      name: fields[nameIdx] || '',
      description: descIdx >= 0 ? (fields[descIdx] || '') : '',
      price: parseFloat(fields[priceIdx]) || 0,
      category,
      is_taxable,
      image_url: null,
    }
  }).filter(r => r.name.trim() && r.price > 0)
}

export default function AdminMenuPage() {
  const [items, setItems] = useState<AdminMenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | MenuCategory>('all')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ItemForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Toggling availability
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Bulk import state
  const [importOpen, setImportOpen] = useState(false)
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<{ succeeded: number; failed: number } | null>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/menu')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setItems(data.items ?? [])
    } catch {
      setError('Failed to load menu items')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  function openAddModal() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setImagePreview(null)
    setModalOpen(true)
  }

  function openEditModal(item: AdminMenuItem) {
    setEditingId(item.id)
    setForm({
      name: item.name,
      description: item.description,
      price: item.price.toFixed(2),
      category: item.category,
      is_taxable: item.is_taxable,
      image_url: item.image_url || '',
      variants: (item.variants ?? []).map((v: VariantGroup) => ({
        name: v.name,
        options: v.options.join(', '),
      })),
    })
    setImagePreview(item.image_url)
    setModalOpen(true)
  }

  async function uploadImage(file: File): Promise<string | null> {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/admin/menu/upload', { method: 'POST', body: formData })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Upload failed')
    }
    return data.url
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const url = await uploadImage(file)
      setForm(prev => ({ ...prev, image_url: url || '' }))
      setImagePreview(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function formVariantsToApi(formVariants: VariantFormGroup[]): VariantGroup[] | null {
    const parsed = formVariants
      .filter(v => v.name.trim() && v.options.trim())
      .map(v => ({
        name: v.name.trim(),
        options: v.options.split(',').map(o => o.trim()).filter(Boolean),
      }))
      .filter(v => v.options.length > 0)
    return parsed.length > 0 ? parsed : null
  }

  async function handleSave() {
    if (!form.name.trim() || !form.price) return
    setSaving(true)
    setError(null)

    const variants = formVariantsToApi(form.variants)

    try {
      if (editingId) {
        const res = await fetch(`/api/admin/menu/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description.trim(),
            price: parseFloat(form.price),
            category: form.category,
            is_taxable: form.is_taxable,
            image_url: form.image_url || null,
            variants,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to update item')
        }
      } else {
        const res = await fetch('/api/admin/menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description.trim(),
            price: parseFloat(form.price),
            category: form.category,
            is_taxable: form.is_taxable,
            image_url: form.image_url || null,
            variants,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to create item')
        }
      }
      setModalOpen(false)
      await fetchItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save item')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/menu/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setDeleteId(null)
      await fetchItems()
    } catch {
      setError('Failed to delete item')
    } finally {
      setDeleting(false)
    }
  }

  async function toggleAvailability(item: AdminMenuItem) {
    setTogglingId(item.id)
    try {
      const res = await fetch(`/api/admin/menu/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: !item.is_available }),
      })
      if (!res.ok) throw new Error('Failed to toggle')
      await fetchItems()
    } catch {
      setError('Failed to update availability')
    } finally {
      setTogglingId(null)
    }
  }

  // CSV import handlers
  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseCsv(text)
      if (rows.length === 0) {
        setError('No valid items found in CSV. Ensure columns: name, price (required), description, category, taxable (optional)')
        return
      }
      setCsvRows(rows)
      setImportResults(null)
    }
    reader.readAsText(file)
    if (csvInputRef.current) csvInputRef.current.value = ''
  }

  function removeCsvRow(index: number) {
    setCsvRows(prev => prev.filter((_, i) => i !== index))
  }

  async function handleCsvRowImage(index: number, file: File) {
    setCsvRows(prev => prev.map((r, i) => i === index ? { ...r, _uploading: true } : r))
    try {
      const url = await uploadImage(file)
      setCsvRows(prev => prev.map((r, i) => i === index ? { ...r, image_url: url, _uploading: false } : r))
    } catch {
      setCsvRows(prev => prev.map((r, i) => i === index ? { ...r, _uploading: false } : r))
      setError(`Failed to upload image for "${csvRows[index]?.name}"`)
    }
  }

  async function handleBulkImport() {
    if (!csvRows.length) return
    setImporting(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/menu/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: csvRows.map(r => ({
            name: r.name,
            description: r.description,
            price: r.price,
            category: r.category,
            is_taxable: r.is_taxable,
            image_url: r.image_url,
          })),
        }),
      })
      if (!res.ok) throw new Error('Import failed')
      const data = await res.json()
      setImportResults({ succeeded: data.succeeded, failed: data.failed })
      if (data.succeeded > 0) {
        setCsvRows([])
        await fetchItems()
      }
    } catch {
      setError('Bulk import failed')
    } finally {
      setImporting(false)
    }
  }

  const filteredItems = items.filter(item => {
    const matchesTab = activeTab === 'all' || item.category === activeTab
    const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesTab && matchesSearch
  })

  if (loading) {
    return (
      <div className="p-6">
        <div className="bg-gray-100 rounded-xl h-64 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Menu Management</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setImportOpen(true); setCsvRows([]); setImportResults(null) }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <FileSpreadsheet size={16} />
            Bulk Import
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            Add Item
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search items by name..."
          className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setActiveTab(cat.value)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === cat.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Items list */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">No items found</p>
          {items.length === 0 && (
            <Link
              href="/admin/menu/debug"
              className="inline-flex items-center gap-1.5 mt-3 text-sm text-primary hover:text-primary/80 font-medium"
            >
              <Settings size={14} />
              Check Square connection
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map(item => (
            <div
              key={item.id}
              className={`flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg ${
                !item.is_available ? 'opacity-50' : ''
              }`}
            >
              {/* Image */}
              <div className="w-14 h-14 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                    No img
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 truncate">{item.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">
                    {item.category}
                  </span>
                  {item.variants && item.variants.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
                      Variants
                    </span>
                  )}
                  {item.is_taxable && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                      Tax
                    </span>
                  )}
                  {!item.is_available && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                      Hidden
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-sm text-gray-500 truncate mt-0.5">{item.description}</p>
                )}
              </div>

              {/* Price */}
              <span className="font-semibold text-gray-900 tabular-nums">
                ${item.price.toFixed(2)}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleAvailability(item)}
                  disabled={togglingId === item.id}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  title={item.is_available ? 'Hide from menu' : 'Show on menu'}
                >
                  {togglingId === item.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : item.is_available ? (
                    <Eye size={16} />
                  ) : (
                    <EyeOff size={16} />
                  )}
                </button>
                <button
                  onClick={() => openEditModal(item)}
                  className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                  title="Edit"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => setDeleteId(item.id)}
                  className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Edit Item' : 'Add New Item'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  placeholder="Item name"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                  rows={3}
                  placeholder="Optional description"
                />
              </div>

              {/* Price + Category */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(prev => ({ ...prev, category: e.target.value as MenuCategory }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="donuts">Donuts</option>
                    <option value="drinks">Drinks</option>
                  </select>
                </div>
              </div>

              {/* Taxable toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Taxable</label>
                  <p className="text-xs text-gray-400">Apply sales tax to this item</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, is_taxable: !prev.is_taxable }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.is_taxable ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.is_taxable ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Variants */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Variants</label>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({
                      ...prev,
                      variants: [...prev.variants, { name: '', options: '' }],
                    }))}
                    className="text-xs text-primary hover:text-primary/80 font-medium"
                  >
                    + Add variant group
                  </button>
                </div>
                {form.variants.length === 0 && (
                  <p className="text-xs text-gray-400">No variants (e.g. Size: Small, Medium, Large)</p>
                )}
                <div className="space-y-2">
                  {form.variants.map((v, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <input
                        type="text"
                        placeholder="Group name (e.g. Size)"
                        value={v.name}
                        onChange={e => setForm(prev => ({
                          ...prev,
                          variants: prev.variants.map((vv, i) =>
                            i === idx ? { ...vv, name: e.target.value } : vv
                          ),
                        }))}
                        className="w-1/3 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Options (comma-separated)"
                        value={v.options}
                        onChange={e => setForm(prev => ({
                          ...prev,
                          variants: prev.variants.map((vv, i) =>
                            i === idx ? { ...vv, options: e.target.value } : vv
                          ),
                        }))}
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({
                          ...prev,
                          variants: prev.variants.filter((_, i) => i !== idx),
                        }))}
                        className="p-1.5 text-gray-400 hover:text-red-500"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Image upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
                {imagePreview ? (
                  <div className="relative w-full h-40 rounded-lg overflow-hidden bg-gray-100 mb-2">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => {
                        setImagePreview(null)
                        setForm(prev => ({ ...prev, image_url: '' }))
                      }}
                      className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : null}
                <label className={`flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 cursor-pointer hover:border-primary hover:text-primary transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                  {uploading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  {uploading ? 'Uploading...' : 'Upload image'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.price}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {importOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Bulk Import Items</h2>
              <button onClick={() => setImportOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto">
              {/* Import results banner */}
              {importResults && (
                <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
                  importResults.failed === 0
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-yellow-50 border border-yellow-200 text-yellow-700'
                }`}>
                  {importResults.failed === 0 ? <Check size={16} /> : <AlertCircle size={16} />}
                  {importResults.succeeded} imported successfully
                  {importResults.failed > 0 && `, ${importResults.failed} failed`}
                </div>
              )}

              {csvRows.length === 0 ? (
                <div className="space-y-4">
                  {/* CSV upload area */}
                  <label className="flex flex-col items-center justify-center gap-3 w-full p-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary hover:text-primary transition-colors text-gray-500">
                    <FileSpreadsheet size={32} />
                    <div className="text-center">
                      <p className="text-sm font-medium">Upload CSV file</p>
                      <p className="text-xs mt-1">Required columns: name, price</p>
                      <p className="text-xs">Optional: description, category, taxable</p>
                    </div>
                    <input
                      ref={csvInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleCsvFile}
                      className="hidden"
                    />
                  </label>

                  {/* CSV format example */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs font-medium text-gray-600 mb-2">Example CSV format:</p>
                    <pre className="text-xs text-gray-500 font-mono overflow-x-auto">
{`name,description,price,category,taxable
Glazed Donut,Classic glazed,1.99,donuts,yes
Iced Coffee,Cold brewed,3.49,drinks,yes
Breakfast Wrap,Eggs and cheese,5.99,breakfast,yes`}
                    </pre>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    {csvRows.length} item{csvRows.length !== 1 ? 's' : ''} ready to import. Upload images below (optional).
                  </p>

                  {/* Preview table */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Name</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Price</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Category</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Tax</th>
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Image</th>
                          <th className="w-10 px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {csvRows.map((row, idx) => (
                          <tr key={idx} className="border-b border-gray-100 last:border-0">
                            <td className="px-3 py-2">
                              <div className="font-medium text-gray-900">{row.name}</div>
                              {row.description && (
                                <div className="text-xs text-gray-400 truncate max-w-[200px]">{row.description}</div>
                              )}
                            </td>
                            <td className="px-3 py-2 tabular-nums">${row.price.toFixed(2)}</td>
                            <td className="px-3 py-2 capitalize">{row.category}</td>
                            <td className="px-3 py-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                row.is_taxable ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {row.is_taxable ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {row.image_url ? (
                                <div className="flex items-center gap-1">
                                  <img src={row.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                                  <button
                                    onClick={() => setCsvRows(prev => prev.map((r, i) => i === idx ? { ...r, image_url: null } : r))}
                                    className="text-gray-400 hover:text-red-500"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ) : row._uploading ? (
                                <Loader2 size={14} className="animate-spin text-gray-400" />
                              ) : (
                                <label className="text-xs text-primary hover:text-primary/80 cursor-pointer font-medium">
                                  Upload
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    onChange={e => {
                                      const f = e.target.files?.[0]
                                      if (f) handleCsvRowImage(idx, f)
                                      e.target.value = ''
                                    }}
                                    className="hidden"
                                  />
                                </label>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                onClick={() => removeCsvRow(idx)}
                                className="text-gray-400 hover:text-red-500"
                              >
                                <X size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-5 border-t border-gray-200">
              <div>
                {csvRows.length > 0 && (
                  <button
                    onClick={() => setCsvRows([])}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Clear & upload new CSV
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setImportOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                {csvRows.length > 0 && (
                  <button
                    onClick={handleBulkImport}
                    disabled={importing || csvRows.some(r => r._uploading)}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {importing ? (
                      <span className="flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        Importing...
                      </span>
                    ) : (
                      `Import ${csvRows.length} Item${csvRows.length !== 1 ? 's' : ''}`
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Item</h3>
            <p className="text-sm text-gray-500 mb-6">
              This will permanently remove this item from the Square catalog. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
