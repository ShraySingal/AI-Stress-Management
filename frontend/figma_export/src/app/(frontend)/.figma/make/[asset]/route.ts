import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ asset: string }> },
) {
  const { asset } = await params

  try {
    let contents: Buffer
    switch (asset) {
      case 'favicon.png':
        contents = await readFile(
          path.join(process.cwd(), '.figma', 'make', 'favicon.png'),
        )
        break
      case 'social-image.png':
        contents = await readFile(
          path.join(process.cwd(), '.figma', 'make', 'social-image.png'),
        )
        break
      default:
        return new Response('Not found', { status: 404 })
    }
    return new Response(new Uint8Array(contents), {
      headers: {
        'Cache-Control': 'public, max-age=300',
        'Content-Type': 'image/png',
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
