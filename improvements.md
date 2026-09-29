# Improvements

Things worth doing next, most valuable first. Items already done have been removed.

## Bugs

- **Old effects replay.** Refreshing mid-game replays the last solve's confetti and chime,
  because `lastSolvedAt` in `RoomScreen` starts out `null`. The game-over jingle also plays
  again on every state frame after the game ends, so any disconnect or reconnect on the end
  screen retriggers it. Seed the refs from the first frame instead of reacting to it.
- **The turn blip plays on every turn change.** The README says it plays when the turn comes
  to *you*.
- **Sounds probably don't play on iPhones.** `useSounds` only creates and resumes the
  `AudioContext` from socket callbacks, never from a tap, and iOS needs a tap. Unlock it on the
  first tap anywhere.
- **The metrics port can crash the game server.** `startMetricsServer` has no `'error'`
  handler, so `EADDRINUSE` on 9464 crashes the whole process.
- **Reconnecting has no timeout.** The `room:resume` call in `RoomScreen` has no timeout, so
  the page can sit on "Opening room…" forever if the server never answers.
- **A stray socket runs on the server.** `RoomScreen` calls `getSocket()` in a `useState`
  initialiser, which also runs during server rendering. That opens a socket.io client inside
  the Next.js process that retries `undefined//undefined` forever.
- **`room:pass` checks the turn differently.** It checks `order[turnIndex]` instead of
  `getTurnId`, unlike `submitGuess`.
- **The host can redeal mid-game.** Nothing stops a direct `room:start` emit while a game is
  running.
- **Disconnected players never leave.** A player who disconnects in the lobby stays there, so
  a room whose players have all gone stays "in use" for up to 6 hours.
- **The room preview can be wrong.** `normalizeRoomName` slices after stripping trailing
  hyphens, so the live preview can end in `-` while the real code doesn't.

## Metrics

- **Only the first game in a room is counted.** `guess_game_duration_seconds` and
  `guess_rooms_ended_total` ignore every game after the first: `firstGuessAt` and
  `countedAsEnded` are keyed by the room object, and `startGame` doesn't reset them.
- **Handler errors are mislabelled.** A handler that throws is counted as
  `result="rejected"`, but the README documents `result="error"`.
- **Some game endings aren't counted.** Games that end because players leave or are kicked
  never reach `guess_rooms_ended_total`.

## Tests

- **Unit tests for `src/lib/game.ts`.** It's pure logic, so these would run in milliseconds
  with no server: turn order, `removePlayer`, `migrateHostIfAway` (the host handoff isn't
  covered anywhere right now, because it takes 30 seconds), and `toRoomView` secrecy.
- **Make `npm test` start its own server** on a spare port instead of needing one already
  running.
- **A Playwright UI test.** Screenshots at desktop and phone width, with console and page
  errors asserted empty.
- **CI.** A GitHub Actions workflow running typecheck, lint and tests on every push.

## Game experience

- **Show the asker's number big for everyone else.** For example: "Paco is asking about
  **35**". That's the number the rest of the table is answering questions about.
- **Make inviting easy.** A large "Copy invite link" button in the lobby, plus a QR code.
- **Confirm the destructive host actions.** Confirm before "End the game" and before kicking,
  and move both into a small host menu.
- **Let the host pick the number range.** `Room` already has `min`/`max`, but nothing lets
  you change them.
- **Remove the duplicate lobby list.** The turn-order sidebar and the lobby chips show the same
  players.

## Polish

- **SVG icons** instead of emoji for mute, copy and kick, so they look the same everywhere.
- **Respect `prefers-reduced-motion`.** Turn off the card tilt, turn pulse, shake, stamp and
  confetti.
- **Allow pinch-zoom.** `maximumScale: 1` in `layout.tsx` blocks it.
- **Announce turn changes to screen readers**, with a live region.

## If it goes public

- **Rate-limit joins,** since room passwords can be brute-forced.
- **Deployment.** A Dockerfile and Fly config, and compile the server instead of running it
  with `tsx` in production.
- **Persistence.** Redis or Postgres behind `RoomStore`. First, make every handler `save`
  what it changes (`room:resume` and `room:create` don't), replace the synchronous
  `countSync`, stop keying metrics state on room object identity, and add locking around
  read-modify-write.
