# AI Coding Agent Instructions for "J'avant nous"

## Project Overview
This is a React-based countdown app for couples, built with Vite, featuring real-time shared state via Firebase Firestore. The app allows two users to collaboratively manage a reunion countdown, shared todo lists, movie watchlists, and daily romantic challenges.

## Architecture
- **Main Component**: `src/App.jsx` - Single large component handling all UI and logic
- **State Management**: Real-time Firestore document sync in `rooms/gauthier-lea-2026-coeur`
- **Data Structure**: Defined in `src/sync.js` with default state including movies, todos, etc.
- **Firebase Integration**: Configured in `src/firebase.js` for Firestore only (messaging commented out)

## Key Patterns & Conventions

### Shared State Synchronization
- Use `patchShared(patch)` to update shared state - merges changes and syncs to Firestore
- State updates trigger real-time propagation via Firestore `onSnapshot`
- Handle sync errors gracefully with `syncError` state
- Suppress duplicate writes with `suppressNextWrite` ref during initial loads

### Date & Time Calculations
- `msToParts(ms)`: Converts milliseconds to {days, hours, minutes, seconds}
- `todayKeyLocal()`: Formats date as "YYYY-MM-DD" for daily content keys
- `msUntilMidnightLocal()`: Calculates time until next midnight
- Countdown uses `Math.ceil((target - now) / (1000*60*60*24))` for inclusive day count

### Daily Content Generation
- `pickDeterministic(list, seedStr)`: Uses FNV-1a hash for consistent daily selections
- Daily challenges and love notes rotate based on current date
- Seed string typically uses `todayKey` for deterministic picks

### UI Structure
- Tab-based navigation: home, meet, playlist, todo, movies
- Responsive design with Tailwind CSS classes
- French language throughout the interface
- Confetti celebrations for milestones (via `canvas-confetti`)

### Firebase Operations
- Read-only `onSnapshot` for real-time updates
- `updateDoc` for state changes, with fallback `setDoc` if document missing
- No authentication - relies on fixed room ID for access control

## Development Workflow
- `npm run dev`: Start development server with hot reload
- `npm run build`: Production build to `dist/`
- `npm run lint`: ESLint checking (ignores `dist/`)
- No tests currently implemented

## File Organization
- `src/App.jsx`: ~1183 lines - entire app logic
- `src/sync.js`: Default room state and data structures
- `src/firebase.js`: Firebase initialization
- `public/firebase-messaging-sw.js`: Service worker (currently unused)
- Styling: Tailwind CSS with custom classes in `src/App.css`

## Common Tasks
- Adding new shared features: Extend `defaultRoomState()` in `sync.js` and handle in `App.jsx`
- UI changes: Modify JSX in `App.jsx` with Tailwind classes
- New calculations: Add utility functions near top of `App.jsx`
- Firebase queries: Use Firestore imports from `src/firebase.js`

## Integration Points
- Firebase Firestore for cross-device sync
- Google Maps links for meet locations
- Snapchat sharing for daily challenges
- Canvas confetti for celebrations

## Notes
- App is designed for two specific users (Gauthier and Lea) with fixed room ID
- All text is in French - maintain language consistency
- Real-time sync enables collaborative editing without conflicts
- Commented notification code exists but is disabled</content>
<parameter name="filePath">/Users/leafaure/j-avant-nous/.github/copilot-instructions.md