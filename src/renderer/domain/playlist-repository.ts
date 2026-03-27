import type {
  ImageAsset,
  Playlist,
  PlaylistDetails,
  PlaylistItem,
  SlotSlideshowSettings,
  SlotTransitionSettings,
} from '@domain/media-library'

export interface CreatePlaylistInput {
  id: string
  name: string
}

export interface CreatePlaylistItemInput {
  id: string
  playlistId: string
  title: string
  orderIndex: number
}

export interface AttachImageToItemInput {
  itemId: string
  image: ImageAsset
}

export interface UpdateItemVisualSlotInput {
  itemId: string
  imageId: string
  isActive: boolean
  slideshow: SlotSlideshowSettings
  transition: SlotTransitionSettings
}

export interface PlaylistRepository {
  createPlaylist(input: CreatePlaylistInput): Promise<Playlist>
  createPlaylistItem(input: CreatePlaylistItemInput): Promise<PlaylistItem>
  attachImageToItem(input: AttachImageToItemInput): Promise<PlaylistItem>
  reorderItemImages(itemId: string, orderedImageIds: string[]): Promise<PlaylistItem>
  updateItemVisualSlot(input: UpdateItemVisualSlotInput): Promise<PlaylistItem>
  getPlaylist(playlistId: string): Promise<PlaylistDetails | null>
}
