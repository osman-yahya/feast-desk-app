import React, { useState, useEffect, useRef } from 'react'
import { Check, X, Plus, Trash2, Square, Minus, AlignLeft } from 'lucide-react'
import { Button } from '../../../components/ui/Button.jsx'
import { Modal } from '../../../components/ui/Modal.jsx'
import { useTableStore } from '../../../store/useTableStore.js'
import { useToast } from '../../../components/ui/Toast.jsx'

const CELL = 56
const COLS = 20
const ROWS = 14
const WALL_ANGLES = [
  { value: 0,  label: '—' },
  { value: 90, label: '|' }
]

const TOOLS = [
  { id: 'table', icon: Square, label: 'Table' },
  { id: 'wall', icon: Minus, label: 'Wall' },
  { id: 'label', icon: AlignLeft, label: 'Label' }
]

export function FloorEditorPage({ onClose }) {
  const { floors, activeFloorId, tables, floorElements, loadFloor, upsertTable, deleteTable, saveFloorElements } = useTableStore()
  const toast = useToast()

  const [tool, setTool] = useState('table')
  const [elements, setElements] = useState([])
  const [localTables, setLocalTables] = useState([])
  const [showTableModal, setShowTableModal] = useState(false)
  const [showLabelModal, setShowLabelModal] = useState(false)
  const [pendingCell, setPendingCell] = useState(null)
  const [tableName, setTableName] = useState('')
  const [tableW, setTableW] = useState(2)
  const [tableH, setTableH] = useState(2)
  const [wallAngle, setWallAngle] = useState(0)
  const [labelText, setLabelText] = useState('')
  const [selected, setSelected] = useState(null) // { type: 'table'|'element', id }
  const [isDirty, setIsDirty] = useState(false)

  // Wall drag state
  const [wallDragStart, setWallDragStart] = useState(null)
  const [wallPreviewEnd, setWallPreviewEnd] = useState(null)
  const isDraggingWall = useRef(false)
  const dragMoved = useRef(false)

  useEffect(() => {
    setLocalTables([...tables])
    setElements([...floorElements])
  }, [tables, floorElements])

  // Convert mouse event to grid cell
  function eventToCell(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const col = Math.min(Math.max(Math.floor((e.clientX - rect.left) / CELL), 0), COLS - 1)
    const row = Math.min(Math.max(Math.floor((e.clientY - rect.top) / CELL), 0), ROWS - 1)
    return { col, row }
  }

  function handleSvgMouseDown(e) {
    if (tool !== 'wall') return
    const { col, row } = eventToCell(e)
    isDraggingWall.current = true
    dragMoved.current = false
    setWallDragStart({ col, row })
    setWallPreviewEnd({ col, row })
  }

  function handleSvgMouseMove(e) {
    if (!isDraggingWall.current || tool !== 'wall') return
    const { col, row } = eventToCell(e)
    setWallPreviewEnd({ col, row })
    dragMoved.current = true
  }

  function handleSvgMouseUp() {
    if (!isDraggingWall.current || tool !== 'wall') return
    isDraggingWall.current = false
    if (dragMoved.current && wallDragStart && wallPreviewEnd) {
      placeWallFromDrag(wallDragStart, wallPreviewEnd)
    }
    setWallDragStart(null)
    setWallPreviewEnd(null)
  }

  function placeWallFromDrag(start, end) {
    const dCol = end.col - start.col
    const dRow = end.row - start.row
    const width = Math.max(Math.abs(dCol), Math.abs(dRow), 1) + 1
    setElements((prev) => [...prev, {
      id: `new-${Date.now()}`,
      floor_id: activeFloorId,
      type: 'wall',
      grid_col: start.col,
      grid_row: start.row,
      width,
      height: 1,
      angle: wallAngle,
      label_text: null,
      created_at: Date.now()
    }])
    setIsDirty(true)
  }

  function handleSvgClick(e) {
    // Wall is handled by drag events; ignore click for wall
    if (tool === 'wall') return
    const rect = e.currentTarget.getBoundingClientRect()
    const col = Math.floor((e.clientX - rect.left) / CELL)
    const row = Math.floor((e.clientY - rect.top) / CELL)
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return
    handleCellClick(col, row)
  }

  function handleCellClick(col, row) {
    if (tool === 'table') {
      setPendingCell({ col, row })
      setTableName('')
      setTableW(2)
      setTableH(2)
      setShowTableModal(true)
    } else if (tool === 'label') {
      setPendingCell({ col, row })
      setLabelText('')
      setShowLabelModal(true)
    }
  }

  function handlePlaceLabelConfirm() {
    if (!labelText.trim() || !pendingCell) return
    setElements((prev) => [...prev, {
      id: `new-${Date.now()}`,
      floor_id: activeFloorId,
      type: 'label',
      grid_col: pendingCell.col,
      grid_row: pendingCell.row,
      width: 3,
      height: 1,
      angle: 0,
      label_text: labelText.trim(),
      created_at: Date.now()
    }])
    setIsDirty(true)
    setShowLabelModal(false)
    setLabelText('')
  }

  async function handlePlaceTable() {
    if (!tableName.trim() || !pendingCell) return
    const data = {
      floor_id: activeFloorId,
      name: tableName.trim(),
      grid_col: pendingCell.col,
      grid_row: pendingCell.row,
      width: tableW,
      height: tableH
    }
    const tbl = await upsertTable(data)
    setLocalTables((prev) => [...prev, tbl])
    setShowTableModal(false)
    setIsDirty(true)
    toast(`Table "${tableName}" added`, 'success')
  }

  async function handleDeleteSelected() {
    if (!selected) return
    if (selected.type === 'table') {
      await deleteTable(selected.id)
      setLocalTables((prev) => prev.filter((t) => t.id !== selected.id))
      toast('Table removed', 'info')
    } else {
      setElements((prev) => prev.filter((e) => String(e.id) !== String(selected.id)))
    }
    setSelected(null)
    setIsDirty(true)
  }

  async function handleSave() {
    const cleanElements = elements.map(({ id, ...el }) => el)
    await saveFloorElements(activeFloorId, cleanElements)
    setIsDirty(false)
    toast('Layout saved', 'success')
    onClose()
  }

  // Compute wall preview dimensions for rendering
  const wallPreview = isDraggingWall.current && wallDragStart && wallPreviewEnd
    ? (() => {
        const dCol = wallPreviewEnd.col - wallDragStart.col
        const dRow = wallPreviewEnd.row - wallDragStart.row
        const width = (Math.max(Math.abs(dCol), Math.abs(dRow), 1) + 1) * CELL
        return { left: wallDragStart.col * CELL, top: wallDragStart.row * CELL, width }
      })()
    : null

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-xl text-ink">Edit Layout</h1>
          {floors.find((f) => f.id === activeFloorId)?.name && (
            <span className="px-2 py-0.5 bg-brand-pale text-brand rounded-pill text-xs font-semibold">
              {floors.find((f) => f.id === activeFloorId).name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={X} onClick={onClose}>Cancel</Button>
          <Button size="sm" icon={Check} onClick={handleSave} disabled={!isDirty}>Save</Button>
        </div>
      </div>

      {/* Tools row */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tool === t.id ? 'bg-white shadow text-ink' : 'text-ink-muted hover:text-ink'}`}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>

        {tool === 'wall' && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-ink-muted font-medium">Direction:</span>
            {WALL_ANGLES.map((a) => (
              <button key={a.value} onClick={() => setWallAngle(a.value)}
                className={`px-3 py-1 rounded-lg text-base font-bold transition-colors ${wallAngle === a.value ? 'bg-brand text-white' : 'bg-gray-100 text-ink-muted hover:bg-gray-200'}`}>
                {a.label}
              </button>
            ))}
          </div>
        )}

        {tool === 'wall' && (
          <span className="text-xs text-ink-muted italic">Click and drag to draw walls</span>
        )}

        {selected && (
          <Button variant="danger" size="sm" icon={Trash2} onClick={handleDeleteSelected}>Remove Selected</Button>
        )}
      </div>

      {/* Editor grid */}
      <div className="flex-1 overflow-auto bg-gray-50 rounded-2xl border border-border-warm p-4">
        <div
          className="relative"
          style={{
            width: COLS * CELL, height: ROWS * CELL, minWidth: COLS * CELL,
            cursor: tool === 'wall' ? 'crosshair' : 'crosshair'
          }}
        >
          {/* Grid dots — non-interactive */}
          <svg className="absolute inset-0 pointer-events-none" width={COLS * CELL} height={ROWS * CELL}>
            {Array.from({ length: ROWS + 1 }).map((_, r) =>
              Array.from({ length: COLS + 1 }).map((_, c) => (
                <circle key={`${r}-${c}`} cx={c * CELL} cy={r * CELL} r={1.5} fill="#E7E0D8" />
              ))
            )}
          </svg>

          {/* Click/drag-capture SVG */}
          <svg
            className="absolute inset-0"
            width={COLS * CELL}
            height={ROWS * CELL}
            onClick={handleSvgClick}
            onMouseDown={handleSvgMouseDown}
            onMouseMove={handleSvgMouseMove}
            onMouseUp={handleSvgMouseUp}
            onMouseLeave={handleSvgMouseUp}
          >
            <rect width={COLS * CELL} height={ROWS * CELL} fill="transparent" />
          </svg>

          {/* Wall drag preview */}
          {wallPreview && (
            <div
              className="absolute rounded-sm pointer-events-none"
              style={{
                left: wallPreview.left,
                top: wallPreview.top,
                width: wallPreview.width,
                height: 8,
                background: '#FF3131',
                opacity: 0.5,
                transform: wallAngle ? `rotate(${wallAngle}deg)` : undefined,
                transformOrigin: '0 50%'
              }}
            />
          )}

          {/* Elements */}
          {elements.map((el) => {
            const isSelected = selected?.id === String(el.id)
            if (el.type === 'wall') {
              return (
                <div key={el.id}
                  onClick={(e) => { e.stopPropagation(); setSelected({ type: 'element', id: String(el.id) }) }}
                  className={`absolute rounded-sm cursor-pointer transition-all ${isSelected ? 'ring-2 ring-brand' : ''}`}
                  style={{
                    left: el.grid_col * CELL, top: el.grid_row * CELL,
                    width: el.width * CELL, height: 8,
                    background: isSelected ? '#FF3131' : '#374151',
                    transform: el.angle ? `rotate(${el.angle}deg)` : undefined,
                    transformOrigin: '0 50%'
                  }}
                />
              )
            }
            if (el.type === 'label') {
              return (
                <div key={el.id}
                  onClick={(e) => { e.stopPropagation(); setSelected({ type: 'element', id: String(el.id) }) }}
                  className={`absolute flex items-center justify-center text-xs font-bold text-ink-muted cursor-pointer border border-dashed rounded ${isSelected ? 'border-brand text-brand' : 'border-gray-300'}`}
                  style={{ left: el.grid_col * CELL, top: el.grid_row * CELL, width: el.width * CELL, height: el.height * CELL }}
                >
                  {el.label_text}
                </div>
              )
            }
            return null
          })}

          {/* Tables */}
          {localTables.map((tbl) => {
            const isSelected = selected?.id === tbl.id
            return (
              <div key={tbl.id}
                onClick={(e) => { e.stopPropagation(); setSelected({ type: 'table', id: tbl.id }) }}
                className={`absolute flex items-center justify-center font-bold text-sm rounded-xl border-2 cursor-pointer transition-all
                  ${isSelected ? 'border-brand bg-brand-pale text-brand ring-2 ring-brand ring-offset-1' : 'border-gray-400 bg-white text-ink hover:border-brand'}`}
                style={{ left: tbl.grid_col * CELL + 2, top: tbl.grid_row * CELL + 2, width: tbl.width * CELL - 4, height: tbl.height * CELL - 4 }}
              >
                {tbl.name}
              </div>
            )
          })}
        </div>
      </div>

      {/* Add table modal */}
      <Modal open={showTableModal} onClose={() => setShowTableModal(false)} title="Add Table" size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-ink-muted block mb-1">Table Name</label>
            <input
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="e.g. T1, Bar, 01, Z-22"
              className="w-full border border-border-warm rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handlePlaceTable()}
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-semibold text-ink-muted block mb-1">Width (cols)</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setTableW(Math.max(1, tableW - 1))} className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200"><Minus size={12} /></button>
                <span className="font-bold text-sm w-6 text-center">{tableW}</span>
                <button onClick={() => setTableW(Math.min(6, tableW + 1))} className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200"><Plus size={12} /></button>
              </div>
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-ink-muted block mb-1">Height (rows)</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setTableH(Math.max(1, tableH - 1))} className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200"><Minus size={12} /></button>
                <span className="font-bold text-sm w-6 text-center">{tableH}</span>
                <button onClick={() => setTableH(Math.min(6, tableH + 1))} className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200"><Plus size={12} /></button>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-center" style={{ height: Math.max(80, tableH * 28) }}>
            <div className="bg-white border-2 border-brand rounded-lg flex items-center justify-center font-bold text-sm text-brand"
              style={{ width: tableW * 32, height: tableH * 24 }}>
              {tableName || '?'}
            </div>
          </div>
          <Button onClick={handlePlaceTable} disabled={!tableName.trim()} className="w-full">Place Table</Button>
        </div>
      </Modal>

      {/* Add label modal */}
      <Modal open={showLabelModal} onClose={() => setShowLabelModal(false)} title="Add Label" size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-ink-muted block mb-1">Label Text</label>
            <input
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              placeholder="e.g. Bar Area, Exit, Window"
              className="w-full border border-border-warm rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handlePlaceLabelConfirm()}
            />
          </div>
          <Button onClick={handlePlaceLabelConfirm} disabled={!labelText.trim()} className="w-full">Place Label</Button>
        </div>
      </Modal>
    </div>
  )
}
