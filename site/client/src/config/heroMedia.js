const DEFAULT_R2_ASSET_BASE_URL = 'https://jake-site-assets.akhileshboda.com'

const r2AssetBaseUrl = (
  import.meta.env.VITE_R2_ASSET_BASE_URL || DEFAULT_R2_ASSET_BASE_URL
).replace(/\/+$/, '')

export const heroVideoUrl = `${r2AssetBaseUrl}/hero-output/hero-home-loop-v1.webm`
export const heroPosterUrl = `${r2AssetBaseUrl}/hero-output/hero-home-poster-v1.jpg`
