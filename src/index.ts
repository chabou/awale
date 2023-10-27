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
const DEPTH = 9
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

async function getBestHole2(board: Board, player: 'PLAYER1' | 'PLAYER2', level: number) {
  DEBUG && console.log('getBestHole')
  DEBUG && console.dir({board, player, level}, {depth: null})
  let holeRef = -1
  let scoreRef = 0
  if (level === DEPTH) {
    DEBUG && console.log(`Leaf, returning lastCaptured ${board.lastCaptured}`)
    return {
      hole: -1,
      score: board.lastCaptured,
    }
  }
  for (let i = 0; i < 6; i++) {
    const hole = i + (player === 'PLAYER2' ? 6 : 0)
    if (!board.holes[hole]) {
      continue
    }
    const nextBoard = play(board, hole)
    const nextPlayer = player === 'PLAYER1' ? 'PLAYER2' : 'PLAYER1'
    const {score} = await getBestHole2(nextBoard, nextPlayer, level + 1)
    if (holeRef === -1 || score > scoreRef) {
      DEBUG && console.log(`Found new best hole ${hole} (${score}) on level ${level + 1}`)
      scoreRef = score
      holeRef = hole
    }
  }
  DEBUG && console.log(`Level ${level} finished. Found best choice: hole ${holeRef} (${scoreRef})`)
  return {hole: holeRef, score: board.lastCaptured - scoreRef}
}

async function getBestHoles1(board: Board) {
  function scoreBoard(board_: Board) {
    type PlayerScore = {
      seeds: number
      targets: number[]
      maxCaptured: number
    }
    const player1: PlayerScore = {
      seeds: 0,
      targets: [],
      maxCaptured: 0,
    }
    const player2: PlayerScore = {
      seeds: 0,
      targets: [],
      maxCaptured: 0,
    }

    for (let i = 0; i < board_.holes.length; i++) {
      const currentPlayerScore = i < 6 ? player1 : player2
      currentPlayerScore.seeds += board_.holes[i]

      const simulatedRound = play(board_, i)
      currentPlayerScore.targets = [...new Set(currentPlayerScore.targets), simulatedRound.lastHole]
      currentPlayerScore.maxCaptured = Math.max(currentPlayerScore.maxCaptured, simulatedRound.lastCaptured)
    }
    function computeScore(playerScore: PlayerScore) {
      return playerScore.seeds + playerScore.targets.length + 2 * playerScore.maxCaptured
    }
    return {
      score1: computeScore(player1),
      score2: computeScore(player2),
    }
  }

  const scores = []
  for (let i = 0; i < board.holes.length; i++) {
    DEBUG && console.log(`Simulating hole ${i}`)
    if (board.holes[i] === 0) {
      DEBUG && console.log('No seed')
      scores.push(-1)
      continue
    }
    const simulatedTurn = play(board, i)
    DEBUG && console.dir({simulatedTurn}, {depth: null})

    //* We can't starve our opponent
    const opponentHoles =
      i < 6
        ? simulatedTurn.holes.slice(simulatedTurn.holes.length / 2)
        : simulatedTurn.holes.slice(0, simulatedTurn.holes.length / 2)
    if (!opponentHoles.some((opponentHole) => opponentHole > 0)) {
      DEBUG && console.log('No starving')
      scores.push(-1)
      continue
    }

    const boardScore = scoreBoard(simulatedTurn)
    const holeScore = (i < 6 ? boardScore.score1 : boardScore.score2) + 10 * simulatedTurn.lastCaptured
    scores.push(holeScore)
  }
  printHoles(scores)

  let bestChoicePlayer1 = 0 //scores.slice(0, scores.length / 2)
  let bestChoicePlayer2 = 6 //scores.slice(scores.length / 2)
  for (let i = 0; i < scores.length; i++) {
    if (i < 6) {
      if (scores[i] && scores[i] > (scores[bestChoicePlayer1] ?? 0)) {
        bestChoicePlayer1 = i
      }
    } else {
      if (scores[i] && scores[i] > (scores[bestChoicePlayer2] ?? 0)) {
        bestChoicePlayer2 = i
      }
    }
  }
  return {
    player1: {
      bestHole: bestChoicePlayer1,
      bestScore: scores[bestChoicePlayer1],
    },
    player2: {
      bestHole: bestChoicePlayer2,
      bestScore: scores[bestChoicePlayer2],
    },
  }
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

    // const {
    //   player1: {bestHole: bestChoicePlayer1},
    //   player2: {bestHole: bestChoicePlayer2},
    // } = await getBestHoles1(board)
    const {hole, score} = await getBestHole2(board, currentPlayer as 'PLAYER1' | 'PLAYER2', 0)
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
