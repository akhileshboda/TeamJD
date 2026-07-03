const DEFAULT_R2_ASSET_BASE_URL = 'https://jake-site-assets.akhileshboda.com'

const r2AssetBaseUrl = (
  import.meta.env.VITE_R2_ASSET_BASE_URL || DEFAULT_R2_ASSET_BASE_URL
).replace(/\/+$/, '')

export const fallbackHeroVideoUrl = `${r2AssetBaseUrl}/hero-output/hero-home-loop-v1.webm`
export const fallbackHeroPosterUrl = `${r2AssetBaseUrl}/hero-output/hero-home-poster-v1.jpg`
