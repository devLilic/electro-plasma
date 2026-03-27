import { useEffect, useMemo, useState } from 'react'
import { getAppVersion } from '@application/get-app-version'
import { plasmaAppVersionPort } from '@infrastructure/plasma-app-version-port'
import { plasmaExternalControlApi } from '@infrastructure/plasma-external-control-api'
import { plasmaPlayoutApi } from '@infrastructure/plasma-playout-api'
import { createPlaylistImportRegistry } from '@infrastructure/import/create-playlist-import-registry'
import { ImageSearchService } from '@application/image-search-service'
import { WikimediaImageSearchProvider } from '@infrastructure/search/wikimedia-image-search-provider'
import {
  AppShell as AppShellFrame,
  ConfigRow,
  Divider,
  EmptyState,
  GhostButton,
  InfoCard,
  Input,
  MetricChip,
  Panel,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
  SectionHeader,
  SegmentedControl,
  Select,
  StatusBadge,
  TopBar,
  Toggle,
  Tooltip,
} from '@ui/components'
import { useUiShellStore, type UiShellItem, type UiShellSlot } from '@ui/ui-shell-store'
import type { ImageSearchResultDto } from '@shared/plasma-api'

interface PreviewTransportState {
  itemId: string | null
  status: 'idle' | 'playing' | 'paused'
  mode: 'loop' | 'stop-at-end'
  activePosition: number
  segmentDurationMs: number
  elapsedMs: number
  segmentStartedAtMs: number | null
}

export function AppShell() {
  const [version, setVersion] = useState<string>()
  const [previewTransport, setPreviewTransport] = useState<PreviewTransportState>(createIdlePreviewTransport())
  const [playlistFilter, setPlaylistFilter] = useState('')
  const [importFeedback, setImportFeedback] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [isImportingPlaylist, setIsImportingPlaylist] = useState(false)
  const [imageSearchQuery, setImageSearchQuery] = useState('')
  const [imageSearchResults, setImageSearchResults] = useState<ImageSearchResultDto[]>([])
  const [imageSearchError, setImageSearchError] = useState<string | null>(null)
  const [isSearchingImages, setIsSearchingImages] = useState(false)
  const playlists = useUiShellStore((state) => state.playlists)
  const itemsByPlaylistId = useUiShellStore((state) => state.itemsByPlaylistId)
  const selectedPlaylistId = useUiShellStore((state) => state.selectedPlaylistId)
  const selectedItemId = useUiShellStore((state) => state.selectedItemId)
  const selectedSlotId = useUiShellStore((state) => state.selectedSlotId)
  const openModal = useUiShellStore((state) => state.openModal)
  const playoutStatus = useUiShellStore((state) => state.playoutStatus)
  const externalControlStatus = useUiShellStore((state) => state.externalControlStatus)
  const selectPlaylist = useUiShellStore((state) => state.selectPlaylist)
  const selectItem = useUiShellStore((state) => state.selectItem)
  const removeItem = useUiShellStore((state) => state.removeItem)
  const selectSlot = useUiShellStore((state) => state.selectSlot)
  const openModalDialog = useUiShellStore((state) => state.openModalDialog)
  const closeModal = useUiShellStore((state) => state.closeModal)
  const addSlot = useUiShellStore((state) => state.addSlot)
  const replaceSelectedSlot = useUiShellStore((state) => state.replaceSelectedSlot)
  const removeSelectedSlot = useUiShellStore((state) => state.removeSelectedSlot)
  const moveSelectedSlotLeft = useUiShellStore((state) => state.moveSelectedSlotLeft)
  const moveSelectedSlotRight = useUiShellStore((state) => state.moveSelectedSlotRight)
  const updateSelectedSlot = useUiShellStore((state) => state.updateSelectedSlot)
  const updateSelectedItemAutoPlay = useUiShellStore((state) => state.updateSelectedItemAutoPlay)
  const importParsedPlaylist = useUiShellStore((state) => state.importParsedPlaylist)
  const syncPlayoutStatus = useUiShellStore((state) => state.syncPlayoutStatus)
  const syncExternalControlStatus = useUiShellStore((state) => state.syncExternalControlStatus)
  const playlistImportRegistry = useMemo(() => createPlaylistImportRegistry(), [])
  const imageSearchService = useMemo(
    () => new ImageSearchService(new WikimediaImageSearchProvider()),
    [],
  )

  const selectedItems = useMemo(
    () => itemsByPlaylistId[selectedPlaylistId ?? ''] ?? [],
    [itemsByPlaylistId, selectedPlaylistId],
  )
  const selectedItem = useMemo(
    () => selectedItems.find((item) => item.id === selectedItemId) ?? null,
    [selectedItemId, selectedItems],
  )
  const selectedSlot = useMemo(
    () => selectedItem?.slots.find((slot) => slot.id === selectedSlotId) ?? null,
    [selectedItem, selectedSlotId],
  )
  const playableSlots = useMemo(
    () => getPlayableSlots(selectedItem),
    [selectedItem],
  )
  const previewSlot = useMemo(
    () => playableSlots[previewTransport.activePosition] ?? selectedSlot ?? null,
    [playableSlots, previewTransport.activePosition, selectedSlot],
  )
  const currentPlaylistName = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedPlaylistId)?.name ?? 'No playlist selected',
    [playlists, selectedPlaylistId],
  )
  const selectedItemNumber = useMemo(() => {
    if (!selectedItem) {
      return null
    }

    const selectedIndex = selectedItems.findIndex((item) => item.id === selectedItem.id)
    return selectedIndex >= 0 ? selectedIndex + 1 : null
  }, [selectedItem, selectedItems])
  const filteredPlaylistItems = useMemo(() => {
    const normalizedFilter = playlistFilter.trim().toLowerCase()
    if (!normalizedFilter) {
      return selectedItems
    }

    return selectedItems.filter((item) => {
      return [
        item.title,
        item.slug,
        item.intro,
      ].some((value) => value.toLowerCase().includes(normalizedFilter))
    })
  }, [playlistFilter, selectedItems])
  const progressPercent = previewTransport.segmentDurationMs > 0
    ? Math.min(100, Math.max(0, (previewTransport.elapsedMs / previewTransport.segmentDurationMs) * 100))
    : 0
  const countdownMs = Math.max(0, previewTransport.segmentDurationMs - previewTransport.elapsedMs)
  const currentMode = selectedItem?.autoPlay.loopMode ?? 'stop-at-end'
  const saveStatus = 'saved'

  useEffect(() => {
    let cancelled = false

    void getAppVersion(plasmaAppVersionPort).then((nextVersion) => {
      if (!cancelled) {
        setVersion(nextVersion)
      }
    })
    void plasmaExternalControlApi.getStatus().then((status) => {
      if (!cancelled) {
        syncExternalControlStatus(status)
      }
    })
    void plasmaPlayoutApi.getStatus().then((status) => {
      if (!cancelled) {
        syncPlayoutStatus(status)
      }
    })

    const unsubscribeExternal = plasmaExternalControlApi.subscribe((status) => {
      if (!cancelled) {
        syncExternalControlStatus(status)
      }
    })
    const unsubscribePlayout = plasmaPlayoutApi.subscribe((status) => {
      if (!cancelled) {
        syncPlayoutStatus(status)
      }
    })

    return () => {
      cancelled = true
      unsubscribeExternal()
      unsubscribePlayout()
    }
  }, [syncExternalControlStatus, syncPlayoutStatus])

  useEffect(() => {
    if (!selectedItem) {
      setPreviewTransport(createIdlePreviewTransport())
      return
    }

    setPreviewTransport((current) => {
      if (current.itemId === selectedItem.id) {
        return {
          ...current,
          mode: selectedItem.autoPlay.loopMode,
        }
      }

      const preferredPosition = getPreferredPlayablePosition(selectedItem, selectedSlotId)
      return createPreviewTransportForItem(selectedItem, preferredPosition, 'idle')
    })
  }, [selectedItem, selectedSlotId])

  useEffect(() => {
    setImageSearchQuery(selectedItem?.title ?? '')
    setImageSearchResults([])
    setImageSearchError(null)
  }, [selectedItem?.id, selectedItem?.title])

  useEffect(() => {
    if (previewTransport.status !== 'playing' || !selectedItem || playableSlots.length === 0) {
      return
    }

    const interval = window.setInterval(() => {
      setPreviewTransport((current) => advancePreviewTransport(current, selectedItem, Date.now()))
    }, 200)

    return () => window.clearInterval(interval)
  }, [playableSlots.length, previewTransport.status, selectedItem])

  async function handlePlay() {
    if (!selectedItem || playableSlots.length === 0) {
      return
    }

    const nowMs = Date.now()
    const nextTransport = previewTransport.status === 'paused' && previewTransport.itemId === selectedItem.id
      ? resumePreviewTransport(previewTransport, selectedItem, nowMs)
      : createPreviewTransportForItem(
          selectedItem,
          getPreferredPlayablePosition(selectedItem, selectedSlotId),
          'playing',
          nowMs,
        )

    setPreviewTransport(nextTransport)

    try {
      await plasmaPlayoutApi.activateItem({ itemId: selectedItem.id })
      const status = await plasmaPlayoutApi.play()
      syncPlayoutStatus(status)
    } catch {
      // Keep the local operator preview responsive even if the backend transport is unavailable.
    }
  }

  async function handlePauseResume() {
    if (!selectedItem || playableSlots.length === 0) {
      return
    }

    const nowMs = Date.now()
    if (previewTransport.status === 'playing') {
      setPreviewTransport(pausePreviewTransport(previewTransport, nowMs))

      try {
        const status = await plasmaPlayoutApi.pause()
        syncPlayoutStatus(status)
      } catch {
        // Local preview remains the visible source of truth for the shell transport.
      }

      return
    }

    const resumedTransport = previewTransport.status === 'paused'
      ? resumePreviewTransport(previewTransport, selectedItem, nowMs)
      : createPreviewTransportForItem(selectedItem, getPreferredPlayablePosition(selectedItem, selectedSlotId), 'playing', nowMs)

    setPreviewTransport(resumedTransport)

    try {
      const status = await plasmaPlayoutApi.resume()
      syncPlayoutStatus(status)
    } catch {
      // Local preview remains the visible source of truth for the shell transport.
    }
  }

  async function handleStop() {
    setPreviewTransport(createPreviewTransportForItem(selectedItem, getPreferredPlayablePosition(selectedItem, selectedSlotId), 'idle'))

    try {
      const status = await plasmaPlayoutApi.stop()
      syncPlayoutStatus(status)
    } catch {
      // Local preview remains the visible source of truth for the shell transport.
    }
  }

  async function handleStep(direction: 'next' | 'previous') {
    if (!selectedItem || playableSlots.length === 0) {
      return
    }

    const nowMs = Date.now()
    setPreviewTransport((current) => stepPreviewTransport(current, selectedItem, direction, nowMs))

    try {
      const status = direction === 'next'
        ? await plasmaPlayoutApi.next()
        : await plasmaPlayoutApi.previous()
      syncPlayoutStatus(status)
    } catch {
      // Local preview remains the visible source of truth for the shell transport.
    }
  }

  async function handleImportPlaylistFile(file: File) {
    setIsImportingPlaylist(true)
    setImportError(null)
    setImportFeedback(null)

    try {
      const textContent = await file.text()
      const imported = await playlistImportRegistry.import({
        fileName: file.name,
        mimeType: file.type || 'text/html',
        textContent,
      })

      importParsedPlaylist({
        fileName: file.name,
        imported,
      })
      setImportFeedback(`Imported ${imported.items.length} items from ${file.name}.`)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Playlist import failed.')
    } finally {
      setIsImportingPlaylist(false)
    }
  }

  function handleLocalImageSelection(file: File) {
    if (!selectedSlot) {
      return
    }

    const previewUrl = URL.createObjectURL(file)
    updateSelectedSlot({
      imageLabel: file.name,
      thumbnailUrl: previewUrl,
      sourceType: 'local',
      isActive: true,
      autoPlayEnabled: true,
    })
  }

  async function handleSearchImages() {
    const query = imageSearchQuery.trim()
    if (!query) {
      setImageSearchError('Enter a search term first.')
      return
    }

    setIsSearchingImages(true)
    setImageSearchError(null)

    try {
      const results = await imageSearchService.search({ query, limit: 6 })
      setImageSearchResults(results)
      if (results.length === 0) {
        setImageSearchError('No images found for this query.')
      }
    } catch (error) {
      setImageSearchError(error instanceof Error ? error.message : 'Image search failed.')
      setImageSearchResults([])
    } finally {
      setIsSearchingImages(false)
    }
  }

  function handleSelectSearchResult(result: ImageSearchResultDto) {
    if (!selectedSlot) {
      return
    }

    updateSelectedSlot({
      imageLabel: result.title,
      thumbnailUrl: result.previewUrl,
      sourceType: 'web',
      isActive: true,
      autoPlayEnabled: true,
    })
  }

  return (
    <AppShellFrame className='h-screen overflow-hidden'>
      <div className='flex h-screen flex-col overflow-hidden p-4'>
        <TopBar className='mb-4 h-14 min-h-14 px-4 py-0'>
          <div className='flex h-full items-center justify-between gap-4'>
            <div className='flex min-w-0 items-center gap-4'>
              <div className='flex items-center gap-3'>
                <div className='flex h-8 w-8 items-center justify-center rounded-control border border-plasma-divider bg-plasma-panel text-sm font-bold text-plasma-text'>
                  P
                </div>
                <div>
                  <p className='text-[15px] font-semibold text-[#E2E8F0]'>Plasma</p>
                  <p className='plasma-micro-label text-plasma-textMuted'>broadcast workspace</p>
                </div>
              </div>
              <Divider className='hidden h-8 border-l border-t-0 md:block' />
              <div className='min-w-0'>
                <p className='plasma-micro-label text-plasma-textMuted'>Current Playlist</p>
                <p className='truncate text-[15px] font-semibold text-[#E2E8F0]'>{currentPlaylistName}</p>
              </div>
            </div>
            <div className='flex items-center gap-3'>
              <StatusBadge tone='success'>
                save {saveStatus}
              </StatusBadge>
              <StatusBadge tone={previewTransport.status === 'playing' ? 'success' : previewTransport.status === 'paused' ? 'warning' : 'neutral'}>
                {previewTransport.status === 'playing' ? 'on-air' : previewTransport.status}
              </StatusBadge>
              <StatusBadge
                tone={
                  externalControlStatus.activityState === 'connected'
                    ? 'info'
                    : externalControlStatus.activityState === 'listening'
                      ? 'warning'
                      : 'neutral'
                }
              >
                external {mapExternalIndicatorLabel(externalControlStatus.activityState)}
              </StatusBadge>
              <StatusBadge tone='neutral'>
                mode {currentMode}
              </StatusBadge>
              <GhostButton onClick={() => openModalDialog('import-playlist')}>import playlist</GhostButton>
              <GhostButton onClick={() => openModalDialog('external-control')}>settings</GhostButton>
              <GhostButton onClick={() => openModalDialog('external-control')}>help</GhostButton>
            </div>
          </div>
        </TopBar>

        <div className='mb-4 flex flex-wrap gap-3'>
            <PrimaryButton onClick={() => void plasmaPlayoutApi.play()}>play</PrimaryButton>
            <SecondaryButton onClick={() => void plasmaPlayoutApi.next()}>next</SecondaryButton>
            <SecondaryButton className='border-plasma-red bg-plasma-red text-plasma-text hover:brightness-110' onClick={() => void plasmaPlayoutApi.stop()}>stop</SecondaryButton>
        </div>

        <div className='grid min-h-0 flex-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)_420px]'>
          <Panel className='min-h-0 overflow-hidden p-0 backdrop-blur'>
            <div className='flex h-full min-h-0 flex-col'>
              <div className='px-4 py-4'>
                <div className='flex items-start justify-between gap-3'>
                  <SectionHeader eyebrow='Left Panel' title='PLAYLIST' meta={`${filteredPlaylistItems.length} items`} className='mb-0' />
                  <GhostButton onClick={() => openModalDialog('import-playlist')}>import</GhostButton>
                </div>
                <div className='mt-4 space-y-3'>
                  <label className='block text-sm text-plasma-textSecondary'>
                    <span className='mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-plasma-textMuted'>Rundown</span>
                    <Select value={selectedPlaylistId ?? ''} onChange={(event) => selectPlaylist(event.target.value)}>
                      {playlists.map((playlist) => (
                        <option key={playlist.id} value={playlist.id}>
                          {playlist.name}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className='block text-sm text-plasma-textSecondary'>
                    <span className='mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-plasma-textMuted'>Filter</span>
                    <Input
                      value={playlistFilter}
                      onChange={(event) => setPlaylistFilter(event.target.value)}
                      placeholder='Search title or slug'
                    />
                  </label>
                </div>
              </div>
              <Divider />
              <div className='min-h-0 flex-1 overflow-y-auto px-4 py-4'>
                <div className='space-y-1'>
                  {filteredPlaylistItems.length > 0
                    ? filteredPlaylistItems.map((item, index) => {
                      const isSelected = item.id === selectedItemId
                      const hasVisuals = item.slots.some((slot) => slot.isActive)
                      const isOnAir = previewTransport.itemId === item.id && previewTransport.status !== 'idle'
                      const isPaused = previewTransport.itemId === item.id && previewTransport.status === 'paused'
                      const isExternallyControlled = playoutStatus.itemId === item.id && externalControlStatus.lastCommand !== null
                      const stateDotColor = isOnAir
                        ? '#22C55E'
                        : isPaused
                          ? '#F59E0B'
                          : hasVisuals
                            ? '#38BDF8'
                            : '#64748B'
                      const stateLabel = isOnAir
                        ? 'on-air'
                        : isPaused
                          ? 'paused'
                          : hasVisuals
                            ? 'has visuals'
                            : 'no visuals'

                      return (
                        <button
                          key={item.id}
                          type='button'
                          onClick={() => selectItem(item.id)}
                          className={`w-full rounded-slot border px-3 py-2 text-left transition-colors ${
                            isSelected
                              ? 'border-[#3B82F6] bg-[rgba(59,130,246,0.16)]'
                              : 'border-transparent bg-transparent hover:bg-[rgba(59,130,246,0.08)]'
                          }`}
                        >
                          <div className='flex min-h-8 items-center gap-3'>
                            <div className='w-6 text-right text-[11px] font-semibold tabular-nums text-plasma-textMuted'>
                              {String(index + 1).padStart(2, '0')}
                            </div>
                            <div className='flex shrink-0 items-center gap-2'>
                              <span
                                className='h-2.5 w-2.5 rounded-full'
                                style={{ backgroundColor: stateDotColor }}
                                aria-label={`${stateLabel} indicator`}
                              />
                              {isExternallyControlled && (
                                <span
                                  className='h-2.5 w-2.5 rounded-full border border-[#38BDF8]/40 bg-[rgba(56,189,248,0.18)]'
                                  aria-label='external control indicator'
                                />
                              )}
                            </div>
                            <div className='min-w-0 flex-1'>
                              <div className='flex items-center gap-2'>
                                <p className='truncate text-[14px] font-semibold text-plasma-text'>{item.title}</p>
                                {isSelected && (
                                  <span className='rounded-full border border-[#3B82F6]/40 bg-[rgba(59,130,246,0.12)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#93C5FD]'>
                                    selected
                                  </span>
                                )}
                              </div>
                              <p className='truncate text-[11px] font-medium text-plasma-textMuted'>
                                {item.intro || item.slug}
                              </p>
                            </div>
                            <div className='flex shrink-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]'>
                              <span
                                className={
                                  isOnAir
                                    ? 'text-[#22C55E]'
                                    : isPaused
                                      ? 'text-[#F59E0B]'
                                      : hasVisuals
                                        ? 'text-[#38BDF8]'
                                        : 'text-plasma-textDisabled'
                                }
                              >
                                {stateLabel}
                              </span>
                              <span className={item.autoPlay.enabled ? 'text-plasma-green' : 'text-plasma-textDisabled'}>
                                {item.autoPlay.enabled ? item.autoPlay.loopMode : 'manual'}
                              </span>
                              {isExternallyControlled && (
                                <span className='text-[#38BDF8]'>
                                  ext
                                </span>
                              )}
                              <button
                                type='button'
                                className='rounded-full border border-transparent px-2 py-1 text-[#94A3B8] transition hover:border-[rgba(239,68,68,0.28)] hover:bg-[rgba(239,68,68,0.08)] hover:text-[#FCA5A5]'
                                onClick={(event) => {
                                  event.stopPropagation()
                                  removeItem(item.id)
                                }}
                                aria-label={`Delete ${item.title}`}
                                title={`Delete ${item.title}`}
                              >
                                delete
                              </button>
                            </div>
                          </div>
                        </button>
                      )
                    })
                    : (
                      <EmptyState
                        title='No playlist items'
                        description='Adjust the filter or import a new rundown to populate this panel.'
                      />
                    )}
                </div>
              </div>
            </div>
          </Panel>

          <Panel className='min-h-0 overflow-hidden p-0 backdrop-blur'>
            <div className='flex h-full min-h-0 flex-col'>
              <div className='px-4 py-4'>
                <SectionHeader eyebrow='Center Panel' title='Item Editor + Slots' meta={`${selectedItems.length} items`} className='mb-0' />
              </div>
              <Divider />
              <div className='min-h-0 flex-1 overflow-hidden px-4 py-4'>
                <div className='h-full min-h-0 overflow-y-auto rounded-3xl border border-slate-800 bg-slate-950/35 p-4'>
                <div className='mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between'>
                  <div>
                    <p className='text-[28px] font-bold leading-none text-[#F8FAFC]'>
                      {selectedItem?.title ?? 'No item selected'}
                    </p>
                    <p className='mt-3 text-[16px] font-medium text-[#CBD5E1]'>
                      {selectedItem?.intro ?? 'Select a playlist item to begin editing.'}
                    </p>
                    <div className='mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]'>
                      <span>item {selectedItemNumber ? String(selectedItemNumber).padStart(2, '0') : '--'}</span>
                      <span>source ui-shell</span>
                      <span>{selectedItem?.slots.length ?? 0} images</span>
                    </div>
                  </div>
                  <div className='flex flex-wrap items-center gap-2'>
                    <StatusBadge tone='neutral'>5 slots max</StatusBadge>
                    <GhostButton onClick={addSlot} disabled={!selectedItem || selectedItem.slots.length >= 5}>add slot</GhostButton>
                  </div>
                </div>
                {selectedItem && (
                  <div className='mb-4 rounded-panel border border-[#334155] bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(11,18,32,0.96))] p-4 shadow-panel'>
                    <div className='flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between'>
                      <div>
                        <p className='text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]'>Slideshow Toolbar</p>
                        <p className='mt-2 text-sm text-[#CBD5E1]'>Seteaza comportamentul general al itemului, apoi ajusteaza fin fiecare slot doar cand ai nevoie.</p>
                      </div>
                      <GhostButton onClick={() => selectedSlot && selectSlot(selectedSlot.id)} disabled={!selectedSlot}>
                        slot settings
                      </GhostButton>
                    </div>
                    <div className='mt-4 grid gap-4 lg:grid-cols-4'>
                      <div className='rounded-button border border-[#334155] bg-[rgba(15,23,42,0.88)] p-3'>
                        <p className='mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]'>Autoplay</p>
                        <Toggle
                          checked={selectedItem.autoPlay.enabled}
                          onChange={(checked) => updateSelectedItemAutoPlay({ enabled: checked })}
                          label='auto-play active'
                        />
                      </div>
                      <div className='rounded-button border border-[#334155] bg-[rgba(15,23,42,0.88)] p-3'>
                        <label className='block text-sm text-plasma-textSecondary'>
                          <span className='mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]'>Duration</span>
                          <Select
                            value={String(selectedSlot?.durationMs ?? 4000)}
                            onChange={(event) => updateSelectedSlot({ durationMs: Number(event.target.value) })}
                            disabled={!selectedSlot}
                          >
                            <option value='2000'>2 sec</option>
                            <option value='3000'>3 sec</option>
                            <option value='4000'>4 sec</option>
                            <option value='5000'>5 sec</option>
                            <option value='7000'>7 sec</option>
                          </Select>
                        </label>
                      </div>
                      <div className='rounded-button border border-[#334155] bg-[rgba(15,23,42,0.88)] p-3'>
                        <label className='block text-sm text-plasma-textSecondary'>
                          <span className='mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]'>Transition</span>
                          <Select
                            value={selectedSlot?.transitionType ?? 'fade'}
                            onChange={(event) => updateSelectedSlot({ transitionType: event.target.value as UiShellSlot['transitionType'] })}
                            disabled={!selectedSlot}
                          >
                            <option value='fade'>fade</option>
                            <option value='cut'>cut</option>
                            <option value='slide-left'>slide-left</option>
                            <option value='slide-right'>slide-right</option>
                            <option value='zoom-soft'>zoom-soft</option>
                          </Select>
                        </label>
                      </div>
                      <div className='rounded-button border border-[#334155] bg-[rgba(15,23,42,0.88)] p-3'>
                        <p className='mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]'>Playback Mode</p>
                        <SegmentedControl
                          value={selectedItem.autoPlay.loopMode}
                          onChange={(value) => updateSelectedItemAutoPlay({ loopMode: value })}
                          options={[
                            { value: 'loop', label: 'loop' },
                            { value: 'stop-at-end', label: 'stop-at-end' },
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-5'>
                  {(selectedItem?.slots ?? []).map((slot) => {
                    const isSelected = slot.id === selectedSlotId
                    const hasImage = slot.imageLabel.trim().length > 0
                    const slotBorderClass = slot.isActive
                      ? 'border-[#22C55E]'
                      : isSelected
                        ? 'border-cyan-300/45'
                        : 'border-[#334155] hover:border-[#60A5FA]'

                    return (
                      <button
                        key={slot.id}
                        type='button'
                        onClick={() => selectSlot(slot.id)}
                        className={`group overflow-hidden rounded-slot border bg-[#0F172A] text-left transition-colors ${slotBorderClass} ${
                          isSelected ? 'bg-cyan-300/8 shadow-[0_0_0_1px_rgba(56,189,248,0.16)]' : ''
                        }`}
                      >
                        <div
                          className='relative aspect-[4/5] border-b border-[#334155] bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.98))]'
                          style={slot.thumbnailUrl
                            ? {
                                backgroundImage: `linear-gradient(180deg,rgba(2,6,23,0.18),rgba(2,6,23,0.72)), url("${slot.thumbnailUrl}")`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                              }
                            : undefined}
                        >
                          {hasImage
                            ? (
                              <div className='flex h-full flex-col justify-between p-3'>
                                <div className='flex items-start justify-between gap-2'>
                                  <span className='rounded-full bg-[rgba(2,6,23,0.72)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#E2E8F0]'>
                                    Image {slot.slotIndex + 1}
                                  </span>
                                  {slot.transitionType !== 'cut' && (
                                    <span className='rounded-full border border-[#334155] bg-[rgba(15,23,42,0.88)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#CBD5E1]'>
                                      {slot.transitionType}
                                    </span>
                                  )}
                                </div>
                                <div className='rounded-[10px] border border-dashed border-cyan-300/16 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_42%),linear-gradient(180deg,rgba(36,48,65,0.55),rgba(15,23,42,0.9))] p-3 backdrop-blur-sm'>
                                  <p className='text-sm font-semibold text-[#F8FAFC]'>{slot.imageLabel}</p>
                                  <p className='mt-1 text-xs uppercase tracking-[0.16em] text-[#94A3B8]'>
                                    {slot.durationMs} ms
                                  </p>
                                </div>
                              </div>
                            )
                            : (
                              <div className='flex h-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.12),transparent_28%),repeating-linear-gradient(135deg,rgba(51,65,85,0.18),rgba(51,65,85,0.18)_8px,transparent_8px,transparent_16px)] p-3 text-center'>
                                <div className='flex h-11 w-11 items-center justify-center rounded-full border border-[#334155] bg-[rgba(15,23,42,0.82)] text-xl text-[#94A3B8]'>
                                  +
                                </div>
                                <p className='mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]'>
                                  Image {slot.slotIndex + 1}
                                </p>
                                <p className='mt-1 text-sm font-medium text-[#94A3B8]'>Add image</p>
                              </div>
                            )}
                          {slot.isActive && (
                            <span className='absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-[#22C55E]' aria-label='active slot indicator' />
                          )}
                        </div>
                        <div className='space-y-2 p-3'>
                          <div className='flex items-center justify-between gap-2'>
                            <p className='text-xs font-bold uppercase tracking-[0.18em] text-cyan-200'>{slot.title}</p>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                              slot.isActive
                                ? 'bg-[rgba(34,197,94,0.14)] text-[#BBF7D0]'
                                : 'bg-[rgba(100,116,139,0.2)] text-[#CBD5E1]'
                            }`}>
                              {slot.isActive ? 'active' : 'inactive'}
                            </span>
                          </div>
                          <div className='flex items-center justify-between gap-2 text-[11px] font-medium text-[#94A3B8]'>
                            <span>{slot.transitionType} / {slot.transitionDurationMs} ms</span>
                            <span className={slot.autoPlayEnabled ? 'text-[#38BDF8]' : 'text-[#94A3B8]'}>
                              {slot.autoPlayEnabled ? 'auto-play' : 'hold'}
                            </span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
                <div className='mt-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-4'>
                  <div className='flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between'>
                    <div>
                      <p className='text-xs font-bold uppercase tracking-[0.18em] text-cyan-300'>Selected slot editor</p>
                      <p className='mt-2 text-sm font-semibold text-white'>{selectedSlot?.title ?? 'No selected slot'}</p>
                      <p className='mt-1 text-sm text-slate-400'>{selectedSlot?.imageLabel ?? 'Choose a slot to configure duration, transition and playout behavior.'}</p>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                      <GhostButton onClick={replaceSelectedSlot} disabled={!selectedSlot}>replace</GhostButton>
                      <SecondaryButton className='border-plasma-red bg-plasma-red text-plasma-text hover:brightness-110' onClick={removeSelectedSlot} disabled={!selectedSlot}>remove</SecondaryButton>
                      <GhostButton onClick={moveSelectedSlotLeft} disabled={!selectedSlot || selectedSlot.slotIndex === 0}>move left</GhostButton>
                      <GhostButton
                        onClick={moveSelectedSlotRight}
                        disabled={!selectedSlot || !selectedItem || selectedSlot.slotIndex === selectedItem.slots.length - 1}
                      >
                        move right
                      </GhostButton>
                    </div>
                  </div>
                  {selectedSlot && (
                    <div className='mt-4 space-y-4'>
                      <div className='grid gap-4 xl:grid-cols-2'>
                        <div className='rounded-button border border-[#334155] bg-[rgba(15,23,42,0.78)] p-4'>
                          <p className='text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]'>Local Image</p>
                          <p className='mt-2 text-sm text-[#CBD5E1]'>Alege o imagine din storage local pentru slotul selectat.</p>
                          <label className='mt-3 block text-sm text-slate-300'>
                            <Input
                              type='file'
                              accept='image/png,image/jpeg,image/webp,image/gif'
                              onChange={(event) => {
                                const file = event.target.files?.[0]
                                if (!file) {
                                  return
                                }

                                handleLocalImageSelection(file)
                                event.currentTarget.value = ''
                              }}
                            />
                          </label>
                        </div>
                        <div className='rounded-button border border-[#334155] bg-[rgba(15,23,42,0.78)] p-4'>
                          <p className='text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]'>Web Search</p>
                          <p className='mt-2 text-sm text-[#CBD5E1]'>Cauta rapid imagini pe internet si aplica una direct pe slot.</p>
                          <div className='mt-3 flex gap-2'>
                            <Input
                              value={imageSearchQuery}
                              onChange={(event) => setImageSearchQuery(event.target.value)}
                              placeholder='Search images'
                            />
                            <PrimaryButton onClick={() => void handleSearchImages()} disabled={isSearchingImages}>
                              {isSearchingImages ? 'searching' : 'search'}
                            </PrimaryButton>
                          </div>
                          {imageSearchError && (
                            <p className='mt-3 text-sm text-[#FCA5A5]'>{imageSearchError}</p>
                          )}
                        </div>
                      </div>
                      {imageSearchResults.length > 0 && (
                        <div className='grid gap-3 md:grid-cols-3 xl:grid-cols-6'>
                          {imageSearchResults.map((result) => (
                            <button
                              key={result.id}
                              type='button'
                              onClick={() => handleSelectSearchResult(result)}
                              className='overflow-hidden rounded-slot border border-[#334155] bg-[#0F172A] text-left transition hover:border-[#60A5FA]'
                            >
                              <div
                                className='aspect-square bg-[#020617]'
                                style={{
                                  backgroundImage: `linear-gradient(180deg,rgba(2,6,23,0.12),rgba(2,6,23,0.4)), url("${result.previewUrl}")`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                }}
                              />
                              <div className='p-2'>
                                <p className='truncate text-xs font-semibold text-[#F8FAFC]'>{result.title}</p>
                                <p className='mt-1 text-[11px] text-[#94A3B8]'>{result.provider}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-5'>
                        <label className='text-sm text-slate-300'>
                        <span className='mb-1 block text-xs uppercase tracking-[0.18em] text-slate-500'>Duration (ms)</span>
                        <Input
                          type='number'
                          min={1000}
                          step={500}
                          value={selectedSlot.durationMs}
                          onChange={(event) => updateSelectedSlot({ durationMs: Math.max(1000, Number(event.target.value) || 1000) })}
                        />
                      </label>
                      <label className='text-sm text-slate-300'>
                        <span className='mb-1 block text-xs uppercase tracking-[0.18em] text-slate-500'>Transition</span>
                        <Select
                          value={selectedSlot.transitionType}
                          onChange={(event) => updateSelectedSlot({ transitionType: event.target.value as typeof selectedSlot.transitionType })}
                        >
                          <option value='fade'>fade</option>
                          <option value='cut'>cut</option>
                          <option value='slide-left'>slide-left</option>
                          <option value='slide-right'>slide-right</option>
                          <option value='zoom-soft'>zoom-soft</option>
                        </Select>
                      </label>
                      <label className='text-sm text-slate-300'>
                        <span className='mb-1 block text-xs uppercase tracking-[0.18em] text-slate-500'>Transition ms</span>
                        <Input
                          type='number'
                          min={0}
                          step={50}
                          value={selectedSlot.transitionDurationMs}
                          onChange={(event) => updateSelectedSlot({ transitionDurationMs: Math.max(0, Number(event.target.value) || 0) })}
                        />
                      </label>
                      <Toggle checked={selectedSlot.isActive} onChange={(checked) => updateSelectedSlot({ isActive: checked })} label='slot active' />
                      <Toggle checked={selectedSlot.autoPlayEnabled} onChange={(checked) => updateSelectedSlot({ autoPlayEnabled: checked })} label='auto-play' />
                      </div>
                    </div>
                  )}
                  {!selectedSlot && (
                    <EmptyState
                      title='No selected slot'
                      description='Select a visual slot to edit duration, transition and auto-play behavior.'
                      className='mt-4'
                    />
                  )}
                </div>
              </div>
              </div>
            </div>
          </Panel>

          <Panel className='min-h-0 overflow-hidden p-0 backdrop-blur'>
            <div className='flex h-full min-h-0 flex-col'>
              <div className='px-4 py-4'>
                <SectionHeader eyebrow='Right Panel' title='LIVE PLAYOUT' meta={playoutStatus.state} className='mb-0' />
              </div>
              <Divider />
              <div className='min-h-0 flex-1 overflow-y-auto px-4 py-4'>
                <div className='space-y-4'>
              <div className='rounded-[20px] border border-[#263244] bg-[linear-gradient(180deg,rgba(11,18,32,0.98),rgba(2,6,23,0.98))] p-4 shadow-panel'>
                <div className='aspect-video overflow-hidden rounded-[16px] border border-[#334155] bg-[#020617]'>
                  <div
                    className='flex h-full flex-col justify-between bg-[radial-gradient(circle_at_top_left,rgba(51,65,85,0.22),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.92),rgba(2,6,23,1))] p-4'
                    style={previewSlot?.thumbnailUrl
                      ? {
                          backgroundImage: `linear-gradient(180deg,rgba(2,6,23,0.28),rgba(2,6,23,0.88)), url("${previewSlot.thumbnailUrl}")`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }
                      : undefined}
                  >
                    <div>
                      <div className='flex items-center justify-between gap-3'>
                        <p className='text-xs font-bold uppercase tracking-[0.2em] text-cyan-300'>Program Monitor</p>
                        <StatusBadge
                          tone={
                            previewTransport.status === 'playing'
                              ? 'success'
                              : previewTransport.status === 'paused'
                                ? 'warning'
                                : 'neutral'
                          }
                        >
                          {previewTransport.status === 'playing' ? 'on-air' : previewTransport.status}
                        </StatusBadge>
                      </div>
                      <h3 className='mt-3 text-[22px] font-semibold text-white'>{previewSlot?.imageLabel ?? 'No selected slot'}</h3>
                      <p className='mt-3 max-w-[28rem] text-sm text-slate-400'>
                        {previewSlot
                          ? `${previewSlot.transitionType} transition, ${previewSlot.transitionDurationMs} ms, ${previewSlot.durationMs} ms on air`
                          : 'Preview waits for a selected slot.'}
                      </p>
                    </div>
                    <div className='space-y-4'>
                      <div className='grid gap-3 sm:grid-cols-3'>
                        <MetricChip label='Mode' value={selectedItem?.autoPlay.loopMode ?? 'n/a'} />
                        <MetricChip
                          label='Visual'
                          value={playableSlots.length > 0 ? `${previewTransport.activePosition + 1}/${playableSlots.length}` : '0/0'}
                        />
                        <div className='plasma-card px-3 py-3'>
                          <p className='plasma-micro-label text-plasma-textMuted'>Countdown</p>
                          <p className='mt-2 text-[22px] font-semibold text-[#E2E8F0]'>
                            {`${(countdownMs / 1000).toFixed(1)}s / ${previewTransport.segmentDurationMs > 0 ? `${(previewTransport.segmentDurationMs / 1000).toFixed(previewTransport.segmentDurationMs % 1000 === 0 ? 0 : 1)}s` : '0s'}`}
                          </p>
                          <p className='mt-1 text-xs text-plasma-textMuted'>remaining in current visual</p>
                        </div>
                      </div>
                      <div className='rounded-button border border-[#334155] bg-[rgba(15,23,42,0.82)] px-3 py-3'>
                        <div className='mb-2 flex items-end justify-between gap-3'>
                          <div>
                            <p className='text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]'>Progress</p>
                            <p className='mt-1 text-xs text-plasma-textMuted'>current visual playback</p>
                          </div>
                          <p className='text-sm font-semibold text-[#E2E8F0]'>{Math.round(progressPercent)}%</p>
                        </div>
                        <ProgressBar value={progressPercent} />
                      </div>
                    </div>
                    <div className='grid gap-2 text-sm text-slate-300'>
                      <p>Playlist: {selectedPlaylistId ?? 'n/a'}</p>
                      <p>Item: {selectedItem?.title ?? 'n/a'}</p>
                      <p>Slot: {previewSlot?.title ?? 'n/a'}</p>
                      <p>Loop: {selectedItem?.autoPlay.loopMode ?? 'n/a'}</p>
                      <p>Mode indicator: {previewTransport.status}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className='rounded-3xl border border-slate-800 bg-slate-950/35 p-4'>
                <div className='mb-3 flex items-center justify-between'>
                  <p className='text-sm font-semibold text-white'>Playout transport</p>
                  <StatusBadge
                    tone={
                      previewTransport.status === 'playing'
                        ? 'success'
                        : previewTransport.status === 'paused'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {previewTransport.status}
                  </StatusBadge>
                </div>
                <div className='grid gap-3 sm:grid-cols-5'>
                  <PrimaryButton onClick={() => void handlePlay()} disabled={!selectedItem || playableSlots.length === 0}>play</PrimaryButton>
                  <SecondaryButton onClick={() => void handlePauseResume()} disabled={!selectedItem || playableSlots.length === 0}>
                    {previewTransport.status === 'paused' ? 'resume' : 'pause'}
                  </SecondaryButton>
                  <GhostButton onClick={() => void handleStep('previous')} disabled={!selectedItem || playableSlots.length === 0}>prev</GhostButton>
                  <GhostButton onClick={() => void handleStep('next')} disabled={!selectedItem || playableSlots.length === 0}>next</GhostButton>
                  <SecondaryButton className='border-plasma-red bg-plasma-red text-plasma-text hover:brightness-110' onClick={() => void handleStop()} disabled={!selectedItem || playableSlots.length === 0}>stop</SecondaryButton>
                </div>
              </div>
              <div className='grid gap-3 sm:grid-cols-2'>
                <InfoCard
                  label='Current Item'
                  value={previewTransport.itemId ?? playoutStatus.itemId ?? 'none'}
                  meta={previewTransport.status === 'idle' ? playoutStatus.updatedAt : `transport ${previewTransport.status}`}
                />
                <InfoCard
                  label='Mode Indicator'
                  value={previewTransport.status}
                  meta={externalControlStatus.lastCommand ?? 'no external command'}
                />
              </div>
              <div className='rounded-3xl border border-slate-800 bg-slate-950/35 p-4'>
                <div className='mb-4 flex items-center justify-between'>
                  <div>
                    <p className='text-sm font-semibold text-white'>External control</p>
                    <p className='mt-1 text-xs uppercase tracking-[0.18em] text-slate-400'>status and local config</p>
                  </div>
                  <StatusBadge
                    tone={
                      externalControlStatus.activityState === 'connected'
                        ? 'info'
                        : externalControlStatus.activityState === 'listening'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {mapExternalIndicatorLabel(externalControlStatus.activityState)}
                  </StatusBadge>
                </div>
                <div className='grid gap-3 sm:grid-cols-3'>
                  <MetricChip label='Service' value={mapExternalIndicatorLabel(externalControlStatus.activityState)} />
                  <MetricChip label='Provider' value={externalControlStatus.provider} />
                  <MetricChip label='Last command' value={externalControlStatus.lastCommand ?? 'none'} />
                </div>
                <div className='mt-4 grid gap-3 rounded-3xl border border-slate-800 bg-slate-900/70 p-4 sm:grid-cols-2'>
                  <ConfigRow label='Endpoint' value={externalControlStatus.endpointUrl ?? 'off'} />
                  <ConfigRow label='Port' value={externalControlStatus.port ? String(externalControlStatus.port) : 'off'} />
                  <ConfigRow label='Connection' value={externalControlStatus.connectionState} />
                  <ConfigRow label='Commands' value={externalControlStatus.allowedCommands.join(', ')} />
                </div>
              </div>
              <div className='rounded-3xl border border-slate-800 bg-slate-950/35 p-4'>
                <div className='mb-3 flex items-center justify-between'>
                  <p className='text-sm font-semibold text-white'>Recent external commands</p>
                  <Tooltip content={externalControlStatus.endpointUrl ?? 'offline'}>
                    <p className='text-xs text-slate-400'>{externalControlStatus.endpointUrl ?? 'offline'}</p>
                  </Tooltip>
                </div>
                <Divider className='mb-3' />
                <ul className='space-y-2'>
                  {externalControlStatus.recentCommands.length > 0
                    ? externalControlStatus.recentCommands.map((entry) => (
                      <li key={`${entry.command}:${entry.receivedAt}`} className='flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/75 px-3 py-2 text-sm text-slate-200'>
                        <span className='font-semibold'>{entry.command}</span>
                        <span className='text-xs text-slate-400'>{entry.receivedAt}</span>
                      </li>
                    ))
                    : (
                      <li>
                        <EmptyState
                          title='No external commands yet'
                          description='When local-http control receives play, next or stop, they will appear here for diagnostics.'
                        />
                      </li>
                    )}
                </ul>
              </div>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {openModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/72 p-4 backdrop-blur-sm'>
          <div className='w-full max-w-xl rounded-[28px] border border-cyan-300/20 bg-slate-900 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.45)]'>
            <div className='flex items-start justify-between gap-4'>
              <div>
                <p className='text-xs font-bold uppercase tracking-[0.24em] text-cyan-300'>Modal</p>
                <h2 className='mt-2 text-2xl font-semibold text-white'>
                  {openModal === 'import-playlist' ? 'Import Playlist' : 'External Control Diagnostics'}
                </h2>
              </div>
              <GhostButton onClick={closeModal}>close</GhostButton>
            </div>
            <div className='mt-6 space-y-3 text-sm text-slate-300'>
              {openModal === 'import-playlist'
                ? (
                  <>
                    <p>Selecteaza un fisier ENPS `.HTM` si il parsez direct in shell folosind adaptoarele existente pentru text-only si fallback graphical.</p>
                    <label className='block text-sm text-plasma-textSecondary'>
                      <span className='mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]'>ENPS HTM file</span>
                      <Input
                        type='file'
                        accept='.htm,.html,text/html'
                        disabled={isImportingPlaylist}
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (!file) {
                            return
                          }

                          void handleImportPlaylistFile(file)
                          event.currentTarget.value = ''
                        }}
                      />
                    </label>
                    <div className='rounded-button border border-[#334155] bg-[rgba(15,23,42,0.72)] px-4 py-3'>
                      <p className='text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]'>Supported format</p>
                      <p className='mt-2 text-sm text-[#CBD5E1]'>Text-only ENPS HTM with `StoryIndex`, anchors and story blocks, like `xTELEJURNAL 1300.HTM`.</p>
                    </div>
                    {isImportingPlaylist && (
                      <p className='text-sm text-[#CBD5E1]'>Importing playlist...</p>
                    )}
                    {importFeedback && (
                      <p className='rounded-button border border-[rgba(34,197,94,0.28)] bg-[rgba(34,197,94,0.1)] px-3 py-2 text-sm text-[#BBF7D0]'>
                        {importFeedback}
                      </p>
                    )}
                    {importError && (
                      <p className='rounded-button border border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.1)] px-3 py-2 text-sm text-[#FCA5A5]'>
                        {importError}
                      </p>
                    )}
                  </>
                )
                : (
                  <>
                    <p>Connection state: {externalControlStatus.activityState}</p>
                    <p>Endpoint: {externalControlStatus.endpointUrl ?? 'not available'}</p>
                    <p>Allowed commands: {externalControlStatus.allowedCommands.join(', ')}</p>
                  </>
                )}
            </div>
          </div>
        </div>
      )}
    </AppShellFrame>
  )
}

function createIdlePreviewTransport(): PreviewTransportState {
  return {
    itemId: null,
    status: 'idle',
    mode: 'loop',
    activePosition: 0,
    segmentDurationMs: 0,
    elapsedMs: 0,
    segmentStartedAtMs: null,
  }
}

function getPlayableSlots(item: UiShellItem | null) {
  if (!item) {
    return [] as UiShellSlot[]
  }

  const autoPlaySlots = item.slots.filter((slot) => slot.isActive && slot.autoPlayEnabled)
  if (autoPlaySlots.length > 0) {
    return autoPlaySlots
  }

  return item.slots.filter((slot) => slot.isActive)
}

function getPreferredPlayablePosition(item: UiShellItem | null, selectedSlotId: string | null) {
  const playableSlots = getPlayableSlots(item)
  if (!item || playableSlots.length === 0) {
    return 0
  }

  const preferredIndex = playableSlots.findIndex((slot) => slot.id === selectedSlotId)
  return preferredIndex >= 0 ? preferredIndex : 0
}

function createPreviewTransportForItem(
  item: UiShellItem | null,
  activePosition: number,
  status: PreviewTransportState['status'],
  nowMs = Date.now(),
): PreviewTransportState {
  const playableSlots = getPlayableSlots(item)
  if (!item || playableSlots.length === 0) {
    return createIdlePreviewTransport()
  }

  const nextPosition = Math.max(0, Math.min(activePosition, playableSlots.length - 1))
  const activeSlot = playableSlots[nextPosition]

  return {
    itemId: item.id,
    status,
    mode: item.autoPlay.loopMode,
    activePosition: nextPosition,
    segmentDurationMs: activeSlot.durationMs,
    elapsedMs: 0,
    segmentStartedAtMs: status === 'playing' ? nowMs : null,
  }
}

function pausePreviewTransport(transport: PreviewTransportState, nowMs: number): PreviewTransportState {
  if (transport.status !== 'playing' || transport.segmentStartedAtMs === null) {
    return transport
  }

  return {
    ...transport,
    status: 'paused',
    elapsedMs: Math.min(transport.segmentDurationMs, nowMs - transport.segmentStartedAtMs),
    segmentStartedAtMs: null,
  }
}

function resumePreviewTransport(
  transport: PreviewTransportState,
  item: UiShellItem,
  nowMs: number,
): PreviewTransportState {
  const playableSlots = getPlayableSlots(item)
  const activeSlot = playableSlots[transport.activePosition]

  if (!activeSlot) {
    return createPreviewTransportForItem(item, 0, 'playing', nowMs)
  }

  return {
    ...transport,
    itemId: item.id,
    status: 'playing',
    mode: item.autoPlay.loopMode,
    segmentDurationMs: activeSlot.durationMs,
    segmentStartedAtMs: nowMs - transport.elapsedMs,
  }
}

function stepPreviewTransport(
  transport: PreviewTransportState,
  item: UiShellItem,
  direction: 'next' | 'previous',
  nowMs: number,
): PreviewTransportState {
  const playableSlots = getPlayableSlots(item)
  if (playableSlots.length === 0) {
    return createIdlePreviewTransport()
  }

  const currentPosition = Math.max(0, Math.min(transport.activePosition, playableSlots.length - 1))
  const delta = direction === 'next' ? 1 : -1
  const nextPosition = (currentPosition + delta + playableSlots.length) % playableSlots.length
  const nextStatus = transport.status === 'paused' ? 'paused' : 'playing'
  const nextSlot = playableSlots[nextPosition]

  return {
    itemId: item.id,
    status: nextStatus,
    mode: item.autoPlay.loopMode,
    activePosition: nextPosition,
    segmentDurationMs: nextSlot.durationMs,
    elapsedMs: 0,
    segmentStartedAtMs: nextStatus === 'playing' ? nowMs : null,
  }
}

function advancePreviewTransport(
  transport: PreviewTransportState,
  item: UiShellItem,
  nowMs: number,
): PreviewTransportState {
  if (transport.status !== 'playing' || transport.segmentStartedAtMs === null) {
    return transport
  }

  const playableSlots = getPlayableSlots(item)
  if (playableSlots.length === 0) {
    return createIdlePreviewTransport()
  }

  let elapsedMs = nowMs - transport.segmentStartedAtMs
  let activePosition = Math.max(0, Math.min(transport.activePosition, playableSlots.length - 1))

  while (elapsedMs >= playableSlots[activePosition].durationMs) {
    elapsedMs -= playableSlots[activePosition].durationMs
    const nextPosition = activePosition + 1

    if (nextPosition >= playableSlots.length) {
      if (!item.autoPlay.enabled || item.autoPlay.loopMode === 'stop-at-end') {
        return {
          ...transport,
          status: 'idle',
          mode: item.autoPlay.loopMode,
          activePosition,
          elapsedMs: playableSlots[activePosition].durationMs,
          segmentDurationMs: playableSlots[activePosition].durationMs,
          segmentStartedAtMs: null,
        }
      }

      activePosition = 0
      continue
    }

    activePosition = nextPosition
  }

  return {
    ...transport,
    itemId: item.id,
    mode: item.autoPlay.loopMode,
    activePosition,
    elapsedMs,
    segmentDurationMs: playableSlots[activePosition].durationMs,
    segmentStartedAtMs: nowMs - elapsedMs,
  }
}

function mapExternalIndicatorLabel(activityState: 'disconnected' | 'listening' | 'connected') {
  switch (activityState) {
    case 'connected':
      return 'connected'
    case 'listening':
      return 'listening'
    case 'disconnected':
      return 'off'
  }
}
