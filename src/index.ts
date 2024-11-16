import {input, select} from '@inquirer/prompts'

type Board = {
  holes: number[]
  captured1: number
  captured2: number

  lastCaptured: number
  lastHole: number
}

const INITIAL_SEED_COUNT = 4
const HOLE_COUNT = 12
const DEPTH = 5
const DEBUG = false

function printHoles(holes: number[]) {
  const player1 = holes.slice(0, holes.length / 2)
  const player2 = holes.slice(holes.length / 2)
  console.log()
  console.log('| 5| 4| 3| 2| 1| 0|')
  console.log('_'.repeat(19))
  console.log(
    `|${player1
      .reverse()
      .map((hole) => (hole <= 0 ? '  ' : hole.toString().padStart(2, ' ')))
      .join('|')}|`,
  )
  console.log('—'.repeat(19))
  console.log(`|${player2.map((hole) => (hole <= 0 ? '  ' : hole.toString().padStart(2, ' '))).join('|')}|`)
  console.log('¯'.repeat(19))
  console.log('| 6| 7| 8| 9|10|11|')
  console.log()
}

function printBoard(board: Board) {
  console.log(`Player 1: ${board.captured1} captured`)
  console.log()
  printHoles(board.holes)
  console.log()
  console.log(`Player 2: ${board.captured2} captured`)
}

function play(board: Board, hole: number) {
  const holes = [...board.holes]
  const result = {...board, holes}

  //* deal
  let index = hole
  let seedToDeal = holes[index]
  holes[index] = 0

  while (seedToDeal > 0) {
    index++
    //* Special case, we dealt in each hole and we must leave our hole empty. It is skipped.
    if (index === hole) {
      continue
    }
    if (index >= holes.length) {
      index = 0
    }
    holes[index] += 1
    seedToDeal--
  }
  result.lastHole = index

  const undoResult = {
    ...result,
    holes: [...holes],
  }

  //* capture
  const validCaptureHoles = hole < 6 ? [6, 7, 8, 9, 10, 11] : [0, 1, 2, 3, 4, 5]
  result.lastCaptured = 0
  while (validCaptureHoles.includes(index) && [2, 3].includes(holes[index])) {
    result.lastCaptured = result.lastCaptured + holes[index]
    holes[index] = 0
    index--
  }

  // We can't starve our opponent. If played, no seed is captured at all.
  if (!validCaptureHoles.some((captureHole) => holes[captureHole] > 0)) {
    return undoResult
  }

  if (hole < 6) {
    result.captured1 += result.lastCaptured
  } else {
    result.captured2 += result.lastCaptured
  }

  return result
}

async function getBestHole(board: Board, player: 'PLAYER1' | 'PLAYER2', level: number) {
  DEBUG && console.log('getBestHole')
  DEBUG && console.dir({board, player, level}, {depth: null})

  if (level === DEPTH) {
    DEBUG && console.log(`Leaf, returning lastCaptured ${board.lastCaptured}`)
    return {
      hole: -1,
      score: board.lastCaptured,
      childScores: null,
    }
  }

  const playerOffset = player === 'PLAYER2' ? 6 : 0
  const scores: number[] = []
  for (let i = 0; i < 6; i++) {
    const hole = i + playerOffset
    if (board.holes[hole] < 1) {
      scores.push(null)
      continue
    }
    const nextBoard = play(board, hole)
    const nextPlayer = player === 'PLAYER1' ? 'PLAYER2' : 'PLAYER1'
    const {score} = await getBestHole(nextBoard, nextPlayer, level + 1)
    scores.push(score)
  }

  let holeRef = -1
  let scoreRef = 0
  for (let hole = 0; hole < scores.length; hole++) {
    const score = scores[hole]
    if (score !== null && (holeRef === -1 || score > scoreRef)) {
      DEBUG && console.log(`Found new best hole ${hole} (${score}) on level ${level + 1}`)
      scoreRef = score
      holeRef = hole
    }
  }

  DEBUG && console.log(`Level ${level} finished. Found best choice: hole ${holeRef} (${scoreRef})`)
  return {hole: holeRef + playerOffset, score: board.lastCaptured - scoreRef, childScores: scores}
}

async function main() {
  //* board init
  let board: Board = {
    holes: Array(HOLE_COUNT).fill(INITIAL_SEED_COUNT) as number[],
    captured1: 0,
    captured2: 0,
    lastCaptured: 0,
    lastHole: -1,
  }

  //* Fastforwarding
  // const playedHoles = [0, 9, 0, 6] as const
  // playedHoles.forEach((hole) => {
  //   board = play(board, hole)
  //   printBoard(board)
  // })

  let currentPlayer = await select({
    message: 'Who begins?',
    choices: [
      {
        value: 'PLAYER1',
      },
      {value: 'PLAYER2'},
    ],
  })

  //* Let's play
  for (;;) {
    printBoard(board)
    if (board.captured1 > 24 || board.captured2 > 24) {
      break
    }

    const {hole, score, childScores} = await getBestHole(board, currentPlayer as 'PLAYER1' | 'PLAYER2', 0)
    console.log(childScores.join(','))
    console.log(`Best choice for ${currentPlayer}: ${hole} (${score})`)

    if (hole === -1) {
      //* A player is starved
      console.log('Maybe Finished')
      //break
    }
    const chosenHole = await input({
      message: 'Which hole to play?',
    })

    board = play(board, Number(chosenHole))
    currentPlayer = currentPlayer === 'PLAYER1' ? 'PLAYER2' : 'PLAYER1'
  }

  //* analyze the winner
  if (board.captured1 > board.captured2) {
    console.log('Player1 wins')
    return
  }
  if (board.captured2 > board.captured1) {
    console.log('Player2 wins')
    return
  }
  console.log("It's a draw")
  return
}
main().catch(console.error)
