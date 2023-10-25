import {input} from '@inquirer/prompts'

type Board = {
  holes: number[]
  captured1: number
  captured2: number

  lastCaptured: number
  lastHole: number
}

const INITIAL_SEED_COUNT = 4
const HOLE_COUNT = 12
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
  const boardScore = scoreBoard(board)
  console.log(`Player 1: ${board.captured1} captured. (Potential: ${boardScore.score1})`)
  console.log()
  printHoles(board.holes)
  console.log()
  console.log(`Player 2: ${board.captured2} captured. (Potential: ${boardScore.score2})`)
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

  //* capture
  const validCaptureHoles = hole < 6 ? [6, 7, 8, 9, 10, 11] : [0, 1, 2, 3, 4, 5]
  result.lastCaptured = 0
  while (validCaptureHoles.includes(index) && [2, 3].includes(holes[index])) {
    result.lastCaptured = result.lastCaptured + holes[index]
    holes[index] = 0
    index--
  }

  if (hole < 6) {
    result.captured1 += result.lastCaptured
  } else {
    result.captured2 += result.lastCaptured
  }

  return result
}

function scoreBoard(board: Board) {
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

  for (let i = 0; i < board.holes.length; i++) {
    const currentPlayerScore = i < 6 ? player1 : player2
    currentPlayerScore.seeds += board.holes[i]

    const simulatedRound = play(board, i)
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

  //* Let's play
  for (;;) {
    printBoard(board)
    if (board.captured1 > 24 || board.captured2 > 24) {
      break
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
    console.log(`Best choice for player1: ${bestChoicePlayer1}`)
    console.log(`Best choice for player2: ${bestChoicePlayer2}`)

    if ([bestChoicePlayer1, bestChoicePlayer2].includes(-1)) {
      //* A player is starved
      break
    }
    const chosenHole = await input({
      message: 'Which hole to play?',
    })

    board = play(board, Number(chosenHole))
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
