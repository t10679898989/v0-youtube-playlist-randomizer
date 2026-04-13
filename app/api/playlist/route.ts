import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const playlistId = searchParams.get("id")

  if (!playlistId) {
    return NextResponse.json({ error: "Playlist ID is required" }, { status: 400 })
  }

  const apiKey = process.env.YOUTUBE_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: "YouTube API key is not configured" }, { status: 500 })
  }

  try {
    // Extract playlist ID from URL if full URL is provided
    let cleanPlaylistId = playlistId
    if (playlistId.includes("list=")) {
      const match = playlistId.match(/list=([^&]+)/)
      if (match) {
        cleanPlaylistId = match[1]
      }
    }

    console.log("[v0] Fetching playlist ID:", cleanPlaylistId)

    let allVideos: any[] = []
    let nextPageToken = ""

    do {
      const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${cleanPlaylistId}&key=${apiKey}${nextPageToken ? `&pageToken=${nextPageToken}` : ""}`

      const response = await fetch(url)

      console.log("[v0] YouTube API response status:", response.status)

      if (!response.ok) {
        const errorData = await response.json()
        console.error("[v0] YouTube API error details:", errorData)
        throw new Error(`Failed to fetch playlist: ${errorData.error?.message || response.statusText}`)
      }

      const data = await response.json()

      const videos = data.items
        .filter((item: any) => item.snippet.title !== "Deleted video" && item.snippet.title !== "Private video")
        .map((item: any) => ({
          videoId: item.snippet.resourceId.videoId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails.medium.url,
          channelTitle: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt,
        }))

      allVideos = [...allVideos, ...videos]
      nextPageToken = data.nextPageToken || ""
    } while (nextPageToken)

    console.log("[v0] Total videos fetched:", allVideos.length)

    return NextResponse.json({ videos: allVideos })
  } catch (error) {
    console.error("[v0] Error fetching playlist:", error)
    return NextResponse.json({ error: "Failed to fetch playlist" }, { status: 500 })
  }
}
