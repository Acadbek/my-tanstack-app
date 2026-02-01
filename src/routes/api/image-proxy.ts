import { createServerFn } from '@tanstack/react-start'

interface ProxyImageInput {
  url: string
}

export const proxyImageFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => data as ProxyImageInput)
  .handler(async ({ data }: { data: ProxyImageInput }) => {
    const { url: imageUrl } = data

    if (!imageUrl || typeof imageUrl !== 'string') {
      throw new Error('Invalid image URL')
    }

    try {
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const contentType = response.headers.get('content-type') || 'image/jpeg'

      return {
        data: buffer.toString('base64'),
        contentType,
      }
    } catch (error) {
      console.error('[Image Proxy] Error:', error)
      throw error
    }
  })
