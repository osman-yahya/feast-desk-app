import React, { useState, useEffect, useRef } from 'react'
import { Check, X, Plus, Trash2, Square, Minus, AlignLeft, Pencil, Eraser } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/ui/Button.jsx'
import { Modal } from '../../../components/ui/Modal.jsx'
import { useTableStore } from '../../../store/useTableStore.js'
import { useToast } from '../../../components/ui/Toast.jsx'

const CELL = 56
const DEFAULT_COLS = 30
const DEFAULT_ROWS = 20
const WALL_COLOR = '#94A3B8'   // slate-400 — lighter than the old #374151
const TOOLS = [
  { id: 'table',  icon: Square,    label: 'Table'  },
  { id: 'wall',   icon: Minus,     label: 'Wall'   },
  { id: 'brush',  icon: Pencil,    label: 'Brush'  },
  { id: 'eraser', icon: Eraser,    label: 'Eraser' },
  { id: 'label',  icon: AlignLeft, label: 'Label'  },
]

function getLabelFontSize(text) {
  const len = (text || '').length
  if (len <= 4)  return 11
  if (len <= 8)  return 9
  if (len <= 14) return 7
  return 6
}

export function FloorEditorPage({ onClose }) {
  const { floors, activeFloorId, tables, floorElements, upsertTable, deleteTable, saveFloorElements } = useTableStore()
  const toast = useToast()
  const { t } = useTranslation()

  const [gridCols, setGridCols] = useState(DEFAULT_COLS)
  const [gridRows, setGridRows] = useState(DEFAULT_ROWS)
  const colsRef = useRef(DEFAULT_COLS)
  const rowsRef = useRef(DEFAULT_ROWS)

  const [tool, setTool]         = useState('table')
  const [elements, setElements] = useState([])
  const [localTables, setLocalTables] = useState([])
  const [isDirty, setIsDirty]   = useState(false)
  const [selected, setSelected] = useState(null) // { type: 'table'|'element', id: string }

  // Modals
  const [showTableModal, setShowTableModal] = useState(false)
  const [showLabelModal, setShowLabelModal] = useState(false)
  const [pendingCell, setPendingCell] = useState(null)
  const [tableName, setTableName] = useState('')
  const [tableW, setTableW]     = useState(2)
  const [tableH, setTableH]     = useState(2)
  const [labelText, setLabelText] = useState('')

  // Drag system:
  //   dragRef  – mutable object updated synchronously during pointer events (no re-render)
  //   dragRender – state snapshot used only for rendering the drag preview
  const containerRef = useRef(null)
  const dragRef      = useRef(null)   // { type, ...currentData }
  const [dragRender, setDragRender] = useState(null)

  // Mirror for reading latest localTables inside commitMove without stale closure
  const localTablesRef = useRef([])
  useEffect(() => { localTablesRef.current = localTables }, [localTables])

  // ── Init: load floor data + grid settings once on mount ──────────
  useEffect(() => {
    setLocalTables([...tables])
    setElements([...floorElements])
    window.feastAPI.settings.getAll().then(s => {
      const c = Math.max(10, Math.min(60, parseInt(s.grid_cols) || DEFAULT_COLS))
      const r = Math.max(8, Math.min(40, parseInt(s.grid_rows) || DEFAULT_ROWS))
      setGridCols(c)
      setGridRows(r)
      colsRef.current = c
      rowsRef.current = r
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty: prevents elements from resetting when tables state changes

  // ── Grid coordinate helper ─────────────────────────────────────────
  function getCellFromEvent(e) {
    const container = containerRef.current
    if (!container) return { col: 0, row: 0 }
    const rect = container.getBoundingClientRect()
    const col = Math.min(Math.max(Math.floor((e.clientX - rect.left) / CELL), 0), colsRef.current - 1)
    const row = Math.min(Math.max(Math.floor((e.clientY - rect.top)  / CELL), 0), rowsRef.current - 1)
    return { col, row }
  }

  // ── Container mouse handlers ────────────────────────────────────────
  function handleContainerMouseDown(e) {
    if (dragRef.current) return
    const { col, row } = getCellFromEvent(e)

    if (tool === 'wall') {
      dragRef.current = { type: 'wall', startCol: col, startRow: row, endCol: col, endRow: row }
      setDragRender({ type: 'wall', startCol: col, startRow: row, endCol: col, endRow: row })
      return
    }

    if (tool === 'brush') {
      const key = `${col},${row}`
      dragRef.current = { type: 'brush', visited: new Set([key]), cells: [{ col, row }] }
      setDragRender({ type: 'brush' })
      return
    }

    if (tool === 'eraser') {
      dragRef.current = { type: 'eraser', visited: new Set([`${col},${row}`]) }
      eraseAtCell(col, row)
      return
    }

    // Empty cell click – open placement modal
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
    setSelected(null)
  }

  function handleContainerMouseMove(e) {
    const dr = dragRef.current
    if (!dr) return
    const { col, row } = getCellFromEvent(e)

    if (dr.type === 'wall') {
      dr.endCol = col
      dr.endRow = row
      setDragRender({ ...dr })
      return
    }
    if (dr.type === 'brush') {
      const key = `${col},${row}`
      if (!dr.visited.has(key)) {
        dr.visited.add(key)
        dr.cells.push({ col, row })
        setDragRender({ type: 'brush', count: dr.cells.length })
      }
      return
    }
    if (dr.type === 'eraser') {
      const key = `${col},${row}`
      if (!dr.visited.has(key)) {
        dr.visited.add(key)
        eraseAtCell(col, row)
      }
      return
    }
    if (dr.type === 'move') {
      const newCol = Math.min(Math.max(col - dr.offsetCol, 0), colsRef.current - 1)
      const newRow = Math.min(Math.max(row - dr.offsetRow, 0), rowsRef.current - 1)
      dr.col = newCol
      dr.row = newRow
      setDragRender({ ...dr })
      return
    }
    if (dr.type === 'resize') {
      const dCol = col - dr.startCol
      const dRow = row - dr.startRow
      dr.currentW = Math.min(Math.max(dr.origW + dCol, 1), 10)
      dr.currentH = Math.min(Math.max(dr.origH + dRow, 1), 10)
      setDragRender({ ...dr })
      return
    }
  }

  function handleContainerMouseUp() {
    const dr = dragRef.current
    if (!dr) return
    dragRef.current = null
    setDragRender(null)

    if (dr.type === 'wall') {
      const moved = dr.endCol !== dr.startCol || dr.endRow !== dr.startRow
      if (moved) placeWallFromDrag(dr)
      return
    }
    if (dr.type === 'brush') {
      if (dr.cells.length > 0) {
        const now = Date.now()
        const newWalls = dr.cells.map((c, i) => ({
          id: `new-${now}-${i}`,
          floor_id: activeFloorId,
          type: 'wall',
          grid_col: c.col,
          grid_row: c.row,
          width: 1,
          height: 1,
          angle: 0,
          label_text: null,
          created_at: now
        }))
        setElements(prev => [...prev, ...newWalls])
        setIsDirty(true)
      }
      return
    }
    if (dr.type === 'eraser') {
      return
    }
    if (dr.type === 'move') {
      if (dr.col !== dr.origCol || dr.row !== dr.origRow) {
        commitMove(dr.id, dr.itemType, dr.col, dr.row)
      }
      return
    }
    if (dr.type === 'resize') {
      commitResize(dr.id, dr.currentW, dr.currentH)
      return
    }
  }

  // ── Element-level mouse handlers (stopPropagation keeps container clean) ──
  function handleElementMouseDown(e, itemType, id, origCol, origRow) {
    e.stopPropagation()
    if (e.button !== 0) return
    if (dragRef.current)  return
    const { col, row } = getCellFromEvent(e)
    const offsetCol = col - origCol
    const offsetRow = row - origRow
    dragRef.current = { type: 'move', id: String(id), itemType, origCol, origRow, offsetCol, offsetRow, col: origCol, row: origRow }
    setDragRender({ ...dragRef.current })
    setSelected({ type: itemType, id: String(id) })
  }

  function handleResizeMouseDown(e, tblId, origW, origH) {
    e.stopPropagation()
    if (e.button !== 0) return
    if (dragRef.current)  return
    const { col, row } = getCellFromEvent(e)
    dragRef.current = { type: 'resize', id: tblId, origW, origH, currentW: origW, currentH: origH, startCol: col, startRow: row }
    setDragRender({ ...dragRef.current })
    setSelected({ type: 'table', id: String(tblId) })
  }

  // ── Erase walls that overlap a grid cell ──────────────────────────
  function eraseAtCell(col, row) {
    setElements(prev => prev.filter(el => {
      if (el.type !== 'wall') return true
      if (!el.angle) {
        // Horizontal: row must match, col must be within [gridCol, gridCol+width)
        return !(el.grid_row === row && col >= el.grid_col && col < el.grid_col + (el.width || 1))
      } else {
        // Vertical (90°): col must match, row must be within [gridRow, gridRow+width)
        return !(el.grid_col === col && row >= el.grid_row && row < el.grid_row + (el.width || 1))
      }
    }))
    setIsDirty(true)
  }

  // ── Commit helpers ─────────────────────────────────────────────────
  function placeWallFromDrag(dr) {
    const dCol = dr.endCol - dr.startCol
    const dRow = dr.endRow - dr.startRow
    // Auto-detect direction from drag: more vertical movement → vertical wall
    const isVertical = Math.abs(dRow) > Math.abs(dCol)
    const angle  = isVertical ? 90 : 0
    const width  = isVertical ? Math.abs(dRow) + 1 : Math.abs(dCol) + 1
    const gridCol = Math.min(dr.startCol, dr.endCol)
    const gridRow = Math.min(dr.startRow, dr.endRow)
    setElements(prev => [...prev, {
      id: `new-${Date.now()}`,
      floor_id: activeFloorId,
      type: 'wall',
      grid_col: gridCol,
      grid_row: gridRow,
      width,
      height: 1,
      angle,
      label_text: null,
      created_at: Date.now()
    }])
    setIsDirty(true)
  }

  function commitMove(id, itemType, col, row) {
    if (itemType === 'table') {
      const tbl = localTablesRef.current.find(t => String(t.id) === id)
      if (!tbl) return
      const updated = { ...tbl, grid_col: col, grid_row: row }
      upsertTable(updated) // fire-and-forget; store update doesn't reset localTables (empty-dep effect)
      setLocalTables(prev => prev.map(t => String(t.id) === id ? updated : t))
      setIsDirty(true)
    } else {
      setElements(prev => prev.map(el => String(el.id) === id ? { ...el, grid_col: col, grid_row: row } : el))
      setIsDirty(true)
    }
  }

  function commitResize(id, w, h) {
    const tbl = localTablesRef.current.find(t => t.id === id)
    if (!tbl) return
    const updated = { ...tbl, width: w, height: h }
    upsertTable(updated)
    setLocalTables(prev => prev.map(t => t.id === id ? updated : t))
    setIsDirty(true)
  }

  // ── Placement helpers ──────────────────────────────────────────────
  function handlePlaceLabelConfirm() {
    if (!labelText.trim() || !pendingCell) return
    setElements(prev => [...prev, {
      id: `new-${Date.now()}`,
      floor_id: activeFloorId,
      type: 'label',
      grid_col: pendingCell.col,
      grid_row: pendingCell.row,
      width: 1,
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
    // Add to local state directly; the empty-dep useEffect won't re-init so no flicker
    setLocalTables(prev => {
      const exists = prev.find(t => t.id === tbl.id)
      return exists ? prev : [...prev, tbl]
    })
    setShowTableModal(false)
    setIsDirty(true)
    toast(t('floorEditor.tableAdded', { name: tableName }), 'success')
  }

  async function handleDeleteSelected() {
    if (!selected) return
    if (selected.type === 'table') {
      await deleteTable(parseInt(selected.id))
      setLocalTables(prev => prev.filter(t => String(t.id) !== selected.id))
      toast(t('floorEditor.tableRemoved'), 'info')
    } else {
      setElements(prev => prev.filter(el => String(el.id) !== selected.id))
    }
    setSelected(null)
    setIsDirty(true)
  }

  async function handleSave() {
    const cleanElements = elements.map(({ id, ...el }) => el)
    await saveFloorElements(activeFloorId, cleanElements)
    setIsDirty(false)
    toast(t('floorEditor.layoutSaved'), 'success')
    onClose()
  }

  // ── Render helpers ─────────────────────────────────────────────────
  function getElementDisplayPos(id, origCol, origRow) {
    if (dragRender?.type === 'move' && dragRender.id === String(id)) {
      return { col: dragRender.col, row: dragRender.row }
    }
    return { col: origCol, row: origRow }
  }

  function getTableDisplaySize(id, origW, origH) {
    if (dragRender?.type === 'resize' && dragRender.id === id) {
      return { w: dragRender.currentW, h: dragRender.currentH }
    }
    return { w: origW, h: origH }
  }

  const wallPreview = dragRender?.type === 'wall' ? (() => {
    const { startCol, startRow, endCol, endRow } = dragRender
    const dC = endCol - startCol
    const dR = endRow - startRow
    const isVert  = Math.abs(dR) > Math.abs(dC)
    const width   = ((isVert ? Math.abs(dR) : Math.abs(dC)) + 1) * CELL
    const left    = Math.min(startCol, endCol) * CELL
    const top     = Math.min(startRow, endRow) * CELL
    const angle   = isVert ? 90 : 0
    return { left, top, width, angle }
  })() : null

  const isGrabbing = !!dragRender && (dragRender.type === 'move' || dragRender.type === 'resize')
  const floorName = floors.find(f => f.id === activeFloorId)?.name

  return (
    <div className="flex flex-col h-full gap-4">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-xl text-ink">{t('floorEditor.editLayout')}</h1>
          {floorName && (
            <span className="px-2.5 py-1 bg-brand-pale text-brand rounded-pill text-xs font-semibold">{floorName}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={X} onClick={onClose}>{t('common.cancel')}</Button>
          <Button size="sm" icon={Check} onClick={handleSave} disabled={!isDirty}>{t('common.save')}</Button>
        </div>
      </div>

      {/* ── Tools row ── */}
      <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1.5">
          {TOOLS.map(toolItem => (
            <button key={toolItem.id} onClick={() => setTool(toolItem.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all
                ${tool === toolItem.id ? 'bg-white shadow text-ink' : 'text-ink-muted hover:text-ink'}`}>
              <toolItem.icon size={15} />{t('floorEditor.' + toolItem.id)}
            </button>
          ))}
        </div>

        {tool === 'wall'   && <span className="text-xs text-ink-muted italic">{t('floorEditor.wallHint')}</span>}
        {tool === 'brush'  && <span className="text-xs text-ink-muted italic">{t('floorEditor.brushHint')}</span>}
        {tool === 'eraser' && <span className="text-xs text-ink-muted italic">{t('floorEditor.eraserHint')}</span>}
        {(tool === 'table' || tool === 'label') && (
          <span className="text-xs text-ink-muted italic">{t('floorEditor.placeHint')}</span>
        )}

        {selected && (
          <Button variant="danger" size="sm" icon={Trash2} onClick={handleDeleteSelected}>{t('floorEditor.removeSelected')}</Button>
        )}
      </div>

      {/* ── Grid ── */}
      <div className="flex-1 overflow-auto bg-gray-50 rounded-2xl border border-border-warm p-4">
        <div
          ref={containerRef}
          className="relative select-none"
          style={{
            width: gridCols * CELL,
            height: gridRows * CELL,
            minWidth: gridCols * CELL,
            cursor: (tool === 'wall' || tool === 'brush') ? 'crosshair'
                  : tool === 'eraser' ? 'cell'
                  : isGrabbing ? 'grabbing' : 'default'
          }}
          onMouseDown={handleContainerMouseDown}
          onMouseMove={handleContainerMouseMove}
          onMouseUp={handleContainerMouseUp}
          onMouseLeave={handleContainerMouseUp}
        >
          {/* Dot grid (non-interactive) */}
          <svg className="absolute inset-0 pointer-events-none" width={gridCols * CELL} height={gridRows * CELL}>
            {Array.from({ length: gridRows + 1 }).map((_, r) =>
              Array.from({ length: gridCols + 1 }).map((_, c) => (
                <circle key={`${r}-${c}`} cx={c * CELL} cy={r * CELL} r={1.5} fill="#E7E0D8" />
              ))
            )}
          </svg>

          {/* Wall drag preview (direction auto-detected from drag) */}
          {wallPreview && (
            <div className="absolute rounded-sm pointer-events-none"
              style={{
                left: wallPreview.left, top: wallPreview.top,
                width: wallPreview.width, height: CELL,
                background: '#FF3131', opacity: 0.5,
                transform: wallPreview.angle ? `rotate(${wallPreview.angle}deg)` : undefined,
                transformOrigin: '0 0'
              }}
            />
          )}

          {/* ── Floor elements (walls & labels) ── */}
          {elements.map(el => {
            const elId = String(el.id)
            const isSelected = selected?.id === elId
            const pos = getElementDisplayPos(el.id, el.grid_col, el.grid_row)

            if (el.type === 'wall') {
              return (
                <div key={el.id}
                  onMouseDown={e => handleElementMouseDown(e, 'element', el.id, el.grid_col, el.grid_row)}
                  className={`absolute rounded-sm cursor-grab active:cursor-grabbing ${isSelected ? 'ring-2 ring-brand' : ''}`}
                  style={{
                    left: pos.col * CELL, top: pos.row * CELL,
                    width: el.width * CELL, height: CELL,
                    background: isSelected ? '#FF3131' : WALL_COLOR,
                    transform: el.angle ? `rotate(${el.angle}deg)` : undefined,
                    transformOrigin: '0 0',
                    zIndex: isSelected ? 10 : 2
                  }}
                />
              )
            }
            if (el.type === 'label') {
              const fs = getLabelFontSize(el.label_text)
              return (
                <div key={el.id}
                  onMouseDown={e => handleElementMouseDown(e, 'element', el.id, el.grid_col, el.grid_row)}
                  className={`absolute flex items-center justify-center cursor-grab active:cursor-grabbing
                    border border-dashed rounded-lg leading-tight text-center overflow-hidden
                    ${isSelected ? 'border-brand text-brand bg-brand-pale' : 'border-gray-400 text-ink-muted bg-white/80'}`}
                  style={{
                    left: pos.col * CELL + 2, top: pos.row * CELL + 2,
                    width: CELL - 4, height: CELL - 4,
                    fontSize: fs, fontWeight: 700,
                    wordBreak: 'break-word', padding: 2,
                    zIndex: isSelected ? 10 : 3
                  }}
                >
                  {el.label_text}
                </div>
              )
            }
            return null
          })}

          {/* ── Tables ── */}
          {localTables.map(tbl => {
            const tblId = String(tbl.id)
            const isSelected = selected?.id === tblId
            const pos  = getElementDisplayPos(tbl.id, tbl.grid_col, tbl.grid_row)
            const size = getTableDisplaySize(tbl.id, tbl.width, tbl.height)

            return (
              <div key={tbl.id}
                onMouseDown={e => handleElementMouseDown(e, 'table', tbl.id, tbl.grid_col, tbl.grid_row)}
                className={`absolute flex items-center justify-center font-bold text-sm rounded-xl border-2
                  cursor-grab active:cursor-grabbing transition-shadow select-none
                  ${isSelected
                    ? 'border-brand bg-brand-pale text-brand ring-2 ring-brand ring-offset-1'
                    : 'border-gray-400 bg-white text-ink hover:border-brand'}`}
                style={{
                  left: pos.col * CELL + 2, top: pos.row * CELL + 2,
                  width: size.w * CELL - 4, height: size.h * CELL - 4,
                  zIndex: isSelected ? 10 : 5
                }}
              >
                <span className="truncate px-1">{tbl.name}</span>

                {/* Resize handle (bottom-right corner) */}
                <div
                  onMouseDown={e => handleResizeMouseDown(e, tbl.id, tbl.width, tbl.height)}
                  title="Drag to resize"
                  className={`absolute bottom-1 right-1 w-5 h-5 flex items-center justify-center
                    rounded cursor-se-resize opacity-40 hover:opacity-100 transition-opacity
                    ${isSelected ? 'bg-brand text-white' : 'bg-gray-500 text-white'}`}
                >
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <path d="M1 8L8 1M4 8L8 4M7 8L8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Add table modal ── */}
      <Modal open={showTableModal} onClose={() => setShowTableModal(false)} title={t('floorEditor.addTable')} size="sm">
        <div className="space-y-5">
          <div>
            <label className="text-sm font-semibold text-ink-muted block mb-2">{t('floorEditor.tableName')}</label>
            <input value={tableName} onChange={e => setTableName(e.target.value)}
              placeholder={t('floorEditor.tableNamePlaceholder')} autoFocus
              className="w-full border border-border-warm rounded-xl px-4 py-3 text-base focus:outline-none focus:border-brand"
              onKeyDown={e => e.key === 'Enter' && handlePlaceTable()}
            />
          </div>
          <div className="flex gap-4">
            {[[t('floorEditor.widthCols'), tableW, setTableW], [t('floorEditor.heightRows'), tableH, setTableH]].map(([lbl, val, set]) => (
              <div key={lbl} className="flex-1">
                <label className="text-sm font-semibold text-ink-muted block mb-2">{lbl}</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => set(v => Math.max(1, v - 1))}
                    className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 text-lg">−</button>
                  <span className="font-bold text-base w-6 text-center">{val}</span>
                  <button onClick={() => set(v => Math.min(10, v + 1))}
                    className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 text-lg">+</button>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-center" style={{ height: Math.max(80, tableH * 28) }}>
            <div className="bg-white border-2 border-brand rounded-lg flex items-center justify-center font-bold text-sm text-brand"
              style={{ width: tableW * 32, height: tableH * 24 }}>
              {tableName || '?'}
            </div>
          </div>
          <Button onClick={handlePlaceTable} disabled={!tableName.trim()} className="w-full" size="lg">{t('floorEditor.placeTable')}</Button>
        </div>
      </Modal>

      {/* ── Add label modal ── */}
      <Modal open={showLabelModal} onClose={() => setShowLabelModal(false)} title={t('floorEditor.addLabel')} size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-ink-muted block mb-2">{t('floorEditor.labelText')}</label>
            <input value={labelText} onChange={e => setLabelText(e.target.value)}
              placeholder={t('floorEditor.labelPlaceholder')} autoFocus
              className="w-full border border-border-warm rounded-xl px-4 py-3 text-base focus:outline-none focus:border-brand"
              onKeyDown={e => e.key === 'Enter' && handlePlaceLabelConfirm()}
            />
            <p className="text-xs text-ink-muted mt-1.5">{t('floorEditor.labelHint')}</p>
          </div>
          <Button onClick={handlePlaceLabelConfirm} disabled={!labelText.trim()} className="w-full" size="lg">{t('floorEditor.placeLabel')}</Button>
        </div>
      </Modal>
    </div>
  )
}
