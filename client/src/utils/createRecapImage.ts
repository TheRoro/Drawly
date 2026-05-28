import type { LeaderboardEntry, ResultEntry } from '@drawly/protocol'

const WIDTH = 1200
const HEIGHT = 630

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
}

function fitText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (context.measureText(text).width <= maxWidth) return text

  let shortened = text
  while (shortened.length > 1 && context.measureText(`${shortened}...`).width > maxWidth) {
    shortened = shortened.slice(0, -1)
  }
  return `${shortened}...`
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('A drawing could not be added to the recap'))
    image.src = source
  })
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const sourceWidth = width / scale
  const sourceHeight = height / scale
  const sourceX = (image.naturalWidth - sourceWidth) / 2
  const sourceY = (image.naturalHeight - sourceHeight) / 2
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height)
}

export async function createRecapImage(
  leaderboard: LeaderboardEntry[],
  results: ResultEntry[],
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot create a recap image')

  const background = context.createLinearGradient(0, 0, WIDTH, HEIGHT)
  background.addColorStop(0, '#f9edd1')
  background.addColorStop(1, '#eee2c7')
  context.fillStyle = background
  context.fillRect(0, 0, WIDTH, HEIGHT)

  context.fillStyle = 'rgba(56, 59, 61, 0.06)'
  for (let x = -HEIGHT; x < WIDTH; x += 42) {
    context.fillRect(x, 0, 2, HEIGHT)
  }

  context.fillStyle = '#383b3d'
  context.font = '700 58px system-ui, sans-serif'
  context.fillText('Drawly Game Night', 56, 76)
  context.fillStyle = '#6b6b6b'
  context.font = '26px system-ui, sans-serif'
  context.fillText('Great drawings. Questionable decisions.', 58, 114)

  roundedRect(context, 54, 144, 350, 418, 24)
  context.fillStyle = 'rgba(255, 255, 255, 0.82)'
  context.fill()
  context.fillStyle = '#383b3d'
  context.font = '700 30px system-ui, sans-serif'
  context.fillText('Final leaderboard', 82, 190)

  leaderboard.slice(0, 5).forEach((player, index) => {
    const y = 232 + index * 61
    context.fillStyle = index === 0 ? '#fff1a8' : '#f3ead5'
    roundedRect(context, 76, y - 31, 306, 48, 14)
    context.fill()

    context.fillStyle = player.color
    context.beginPath()
    context.arc(105, y - 7, 16, 0, Math.PI * 2)
    context.fill()

    context.fillStyle = '#383b3d'
    context.font = '700 21px system-ui, sans-serif'
    context.fillText(`${index + 1}.`, 132, y)
    context.fillText(fitText(context, player.nickname, 145), 166, y)
    context.textAlign = 'right'
    context.fillText(`${player.score} pts`, 360, y)
    context.textAlign = 'left'
  })

  context.fillStyle = '#383b3d'
  context.font = '700 30px system-ui, sans-serif'
  context.fillText('Top drawings', 446, 172)

  const topDrawings = results.slice(0, 3)
  const images = await Promise.all(topDrawings.map(result => loadImage(result.imageData)))
  topDrawings.forEach((result, index) => {
    const cardX = 446 + index * 230
    const cardY = 198
    roundedRect(context, cardX, cardY, 210, 310, 20)
    context.fillStyle = index === 0 ? '#fff1a8' : 'rgba(255, 255, 255, 0.82)'
    context.fill()

    context.save()
    roundedRect(context, cardX + 12, cardY + 12, 186, 172, 12)
    context.clip()
    drawImageCover(context, images[index], cardX + 12, cardY + 12, 186, 172)
    context.restore()

    context.fillStyle = '#383b3d'
    context.font = '700 23px system-ui, sans-serif'
    context.fillText(`#${index + 1} · ${result.votes} votes`, cardX + 14, cardY + 220)
    context.font = '19px system-ui, sans-serif'
    context.fillStyle = '#6b6b6b'
    context.fillText(fitText(context, `"${result.prompt}"`, 182), cardX + 14, cardY + 253)
    context.fillText(fitText(context, `by ${result.playerNickname}`, 182), cardX + 14, cardY + 282)
  })

  context.fillStyle = '#383b3d'
  context.font = '700 25px system-ui, sans-serif'
  context.fillText('Play at drawly.vercel.app', 446, 552)
  context.fillStyle = '#6b6b6b'
  context.font = '18px system-ui, sans-serif'
  context.fillText('Created locally in your browser — no recap upload required.', 446, 582)

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('The recap image could not be generated'))
    }, 'image/png')
  })
}
