export interface SocialPlatform {
  id: string
  name: string
  loginUrl: string
}

export const SOCIAL_PLATFORMS: SocialPlatform[]
export const PLATFORMS_BY_ID: Record<string, SocialPlatform>
export const PLATFORM_IDS: string[]
