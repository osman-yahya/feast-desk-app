import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Edit3 } from 'lucide-react'
import { Button } from '../../components/ui/Button.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { useTableStore } from '../../store/useTableStore.js'
import { FloorGrid } from './FloorGrid.jsx'
import { TableOrderDrawer } from './TableOrderDrawer.jsx'
import { FloorEditorPage } from './FloorEditor/FloorEditorPage.jsx'
import { PasswordGate } from '../../components/ui/PasswordGate.jsx'
import { useToast } from '../../components/ui/Toast.jsx'

export function TablesPage({ editorMode: editorModeProp = false }) {
  const {
    floors, activeFloorId, tables, floorElements,
    loadFloors, loadFloor, createFloor
  } = useTableStore()
  const toast = useToast()
  const { t } = useTranslation()

  const [selectedTableId, setSelectedTableId] = useState(null)
  const [showAddFloor, setShowAddFloor] = useState(false)
  const [newFloorName, setNewFloorName] = useState('')
  const [localEditorMode, setLocalEditorMode] = useState(editorModeProp)

  useEffect(() => {
    loadFloors()
  }, [])

  // Refresh table statuses when waiter/kitchen activity changes order state
  useEffect(() => {
    if (!activeFloorId) return
    const unlisten = window.feastAPI.on('server:message', (msg) => {
      if (msg.type === 'order:updated' || msg.type === 'order:paid') {
        loadFloor(activeFloorId)
      }
    })
    return () => unlisten?.()
  }, [activeFloorId])

  async function handleAddFloor() {
    if (!newFloorName.trim()) return
    await createFloor(newFloorName.trim())
    setNewFloorName('')
    setShowAddFloor(false)
    toast(t('tables.floorAdded'), 'success')
  }

  function handleTableSelect(table) {
    if (localEditorMode) return
    setSelectedTableId(table.id)
  }

  if (localEditorMode) {
    return (
      <PasswordGate feature="Layout Editor">
        <FloorEditorPage onClose={() => setLocalEditorMode(false)} />
      </PasswordGate>
    )
  }

  return (
    <div className="flex flex-1 gap-6 min-h-0">
      {/* Main floor area */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <h1 className="font-bold text-xl text-ink">{t('tables.tables')}</h1>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={Edit3} onClick={() => setLocalEditorMode(true)}>
              {t('tables.editLayout')}
            </Button>
            <Button size="sm" icon={Plus} onClick={() => setShowAddFloor(true)}>
              {t('tables.addFloor')}
            </Button>
          </div>
        </div>

        {/* Floor tabs */}
        {floors.length > 0 && (
          <div className="flex gap-2 overflow-x-auto flex-shrink-0">
            {floors.map((floor) => (
              <button
                key={floor.id}
                onClick={() => loadFloor(floor.id)}
                className={`px-4 py-2 rounded-pill text-sm font-semibold transition-all flex-shrink-0 ${
                  activeFloorId === floor.id
                    ? 'bg-brand text-white'
                    : 'bg-white border border-border-warm text-ink-muted hover:text-ink'
                }`}
              >
                {floor.name}
              </button>
            ))}
          </div>
        )}

        {/* Floor grid */}
        <div className="flex-1 overflow-auto">
          {floors.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
                <Plus size={28} className="text-gray-400" />
              </div>
              <div>
                <p className="font-semibold text-ink">{t('tables.noFloors')}</p>
                <p className="text-sm text-ink-muted mt-1">{t('tables.noFloorsHint')}</p>
              </div>
              <Button icon={Plus} onClick={() => setShowAddFloor(true)}>{t('tables.addFirstFloor')}</Button>
            </div>
          ) : (
            <FloorGrid
              tables={tables}
              elements={floorElements}
              onTableClick={handleTableSelect}
              selectedTableId={selectedTableId}
            />
          )}
        </div>
      </div>

      {/* Table order drawer */}
      {selectedTableId && (
        <TableOrderDrawer
          tableId={selectedTableId}
          table={tables.find((t) => t.id === selectedTableId)}
          onClose={() => setSelectedTableId(null)}
        />
      )}

      {/* Add floor modal */}
      <Modal open={showAddFloor} onClose={() => setShowAddFloor(false)} title={t('tables.addFloor')} size="sm">
        <div className="space-y-4">
          <input
            value={newFloorName}
            onChange={(e) => setNewFloorName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddFloor()}
            placeholder={t('tables.floorPlaceholder')}
            className="w-full border border-border-warm rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand"
            autoFocus
          />
          <Button onClick={handleAddFloor} disabled={!newFloorName.trim()} className="w-full">
            {t('tables.addFloor')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
