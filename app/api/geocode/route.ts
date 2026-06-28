import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (lat && lng) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        {
          headers: {
            'User-Agent': 'CivicPulse/1.0 (hackathon project)',
            'Accept-Language': 'en'
          }
        }
      )
      const data = await res.json()
      return NextResponse.json(data)
    } catch (error) {
      console.error('Reverse geocode proxy error:', error)
      return NextResponse.json({ error: 'Failed to reverse geocode' }, { status: 500 })
    }
  }

  if (!q) return NextResponse.json([])
  
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'CivicPulse/1.0 (hackathon project)',
          'Accept-Language': 'en'
        }
      }
    )
    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Geocode proxy error:', error)
    return NextResponse.json([])
  }
}
