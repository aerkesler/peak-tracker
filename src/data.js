// ── PROGRAM START (fixed) ─────────────────────────────────────────
// May 23 2026 = Program Day 1 = Cycle 1, Day 1
export const PROGRAM_START = '2026-05-23'
export const CYCLE_LENGTH = 27

// ── PHASES ────────────────────────────────────────────────────────
export const PHASES = {
  menstrual:  { label: 'Menstrual',  emoji: '🌑', days: [1,2,3],                               color: '#B85C38', bg: '#FDF0EB', light: '#F5DDD3', textLight: '#E8956D' },
  follicular: { label: 'Follicular', emoji: '🌿', days: [4,5,6,7,8,9,10,11,12],                color: '#3A7D5A', bg: '#EBF5EF', light: '#C8E6D4', textLight: '#5BAA7A' },
  ovulation:  { label: 'Ovulation',  emoji: '☀️', days: [13,14,15],                            color: '#C08A20', bg: '#FDF7E8', light: '#F5E8C0', textLight: '#D4A030' },
  luteal:     { label: 'Luteal',     emoji: '🌙', days: [16,17,18,19,20,21,22,23,24,25,26,27], color: '#6A5AAA', bg: '#F0EEF8', light: '#DDD9F0', textLight: '#8A7ACC' },
}

export const getPhase = (cycleDay) => {
  for (const [key, p] of Object.entries(PHASES)) {
    if (p.days.includes(cycleDay)) return { key, ...p }
  }
  return { key: 'luteal', ...PHASES.luteal }
}

export const isLateLuteal = (cycleDay) => cycleDay >= 21

// ── DATE UTILITIES ────────────────────────────────────────────────
// Returns 'YYYY-MM-DD' for any Date object
export const toDateStr = (d) => d.toISOString().split('T')[0]

// Days between two date strings (b - a)
export const daysBetween = (aStr, bStr) => {
  const a = new Date(aStr + 'T12:00:00')
  const b = new Date(bStr + 'T12:00:00')
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

// Given a sorted array of cycle start dates and a target date string,
// return { cycleNum, cycleDay, cycleStart }
export const resolveCyclePosition = (cycleStarts, dateStr) => {
  // cycleStarts: ['2026-05-23', '2026-06-19', ...] sorted ascending
  // Find which cycle this date belongs to
  let cycleNum = 1
  let cycleStart = cycleStarts[0]
  for (let i = 0; i < cycleStarts.length; i++) {
    if (cycleStarts[i] <= dateStr) {
      cycleNum = i + 1
      cycleStart = cycleStarts[i]
    } else {
      break
    }
  }
  const cycleDay = daysBetween(cycleStart, dateStr) + 1
  return { cycleNum, cycleDay: Math.max(1, cycleDay), cycleStart }
}

// Total program days elapsed
export const programDay = (dateStr) => daysBetween(PROGRAM_START, dateStr) + 1

// ── DAY SLOTS (Sun=0) ─────────────────────────────────────────────
export const DAY_SLOTS = {
  0: { name: 'Rest / Pilates',     icon: '🧘' },
  1: { name: 'Strength',           icon: '🏋️' },
  2: { name: 'Sprint + Cardio',    icon: '⚡' },
  3: { name: 'Boxing',             icon: '🥊' },
  4: { name: 'Pull · Push · Core', icon: '💪' },
  5: { name: 'Run + Plyometrics',  icon: '🏃' },
  6: { name: 'Ruck Walk',          icon: '🎒' },
}

// DOW from a date string (Sun=0)
export const dowFromDate = (dateStr) => new Date(dateStr + 'T12:00:00').getDay()

// ── SETS SCHEME BY MONTH ──────────────────────────────────────────
export const getSetsScheme = (monthNum) => {
  if (monthNum <= 3)  return { follicular: 3,     ovulation: '3–4', earlyLuteal: 3,     lateLuteal: 2 }
  if (monthNum <= 6)  return { follicular: 4,     ovulation: '4–5', earlyLuteal: '3–4', lateLuteal: '2–3' }
  if (monthNum <= 9)  return { follicular: '4–5', ovulation: 5,     earlyLuteal: 4,     lateLuteal: 3 }
  return                     { follicular: 5,     ovulation: '5–6', earlyLuteal: 4,     lateLuteal: 3 }
}

// Month number from program start
export const getMonthNum = (dateStr) => {
  const days = daysBetween(PROGRAM_START, dateStr)
  return Math.max(1, Math.min(12, Math.floor(days / 30.44) + 1))
}

// ── WORKOUTS ──────────────────────────────────────────────────────
export const WORKOUTS = {
  0: { // Sunday — Rest/Pilates
    menstrual:  { title: 'Full Rest',               intensity: 'Rest',     note: 'Hormones at their lowest. Walk only if you feel like it.',
                  exercises: ['Full rest — no structured workout', 'Optional: 20-min gentle walk', 'Hydrate well · prioritise sleep'] },
    follicular: { title: 'Active Recovery Pilates', intensity: 'Low',      note: "Let your body consolidate the week's training.",
                  exercises: ['Pilates roll-down × 8', 'Spine stretch forward × 8', 'Mermaid stretch 60s/side', 'Cat-cow × 10', "Child's pose 2 min", 'Optional: 3.4km easy walk'] },
    ovulation:  { title: 'Active Recovery Pilates', intensity: 'Low',      note: 'Even at peak phase, Sunday is recovery.',
                  exercises: ['Pilates roll-down × 8', 'Spine stretch × 8', 'Hip flexor stretch 90s/side', 'Thread-the-needle × 8/side', 'Box breathing 5 min'] },
    luteal_e:   { title: 'Rest or Gentle Pilates',  intensity: 'Rest',     note: 'Check Apple Watch HRV. Low → full rest. Recovered → Pilates.',
                  exercises: ['HRV check first', 'If recovered: Dead bug × 10', 'Bird-dog × 10/side', 'Clam shells × 15', 'If low HRV: full rest only'] },
    luteal_l:   { title: 'Full Rest',               intensity: 'Rest',     note: 'Body preparing to reset. Full rest is the work.',
                  exercises: ['Full rest', 'Hydrate · 2.5L water', 'Sleep 8+ hours tonight', 'Prepare for new cycle'] },
  },
  1: { // Monday — Strength
    menstrual:  { title: 'Walk Only',               intensity: 'Walk',     note: 'No loading during period. Movement good, intensity counterproductive.',
                  exercises: ['3.4km loop walk at easy pace', 'Focus on belly breathing', 'Hip circles and gentle arm swings', 'Aim for 7,000+ steps'] },
    follicular: { title: 'KB Strength — Build',     intensity: 'High',     note: 'Rising oestrogen = best strength adaptation. Push the weight.',
                  exercises: ['Warm-up: 1.7km brisk walk + joint CARs 5min', 'KB Deadlift — [sets] × 10 reps', 'KB Goblet Squat — [sets] × 12 reps', 'KB Single-Arm Row — [sets] × 10/side', 'KB Swing — [sets] × 15 reps', 'Box Jump (or Squat Jump) — [sets] × 8 reps', 'Hollow Body Hold — [sets] × 30s', 'Cool-down: hip flexor + hamstring stretch'] },
    ovulation:  { title: 'KB Strength — Peak',      intensity: 'Peak',     note: 'Your strongest week. Go heavier than follicular. Test new weights.',
                  exercises: ['Warm-up: 1.7km walk + activation drills', 'KB Deadlift — [sets] × 8 reps (heaviest)', 'KB Goblet Squat — [sets] × 10 reps (heavy)', 'KB Clean + Press — [sets] × 8/side', 'KB Swing — [sets] × 20 reps', 'Broad Jump — [sets] × 6 reps', 'L-sit or Hollow Rock — [sets] × 30s', 'Record top weights in notes ↓'] },
    luteal_e:   { title: 'KB Strength — Maintain',  intensity: 'Moderate', note: 'Early luteal: maintain follicular gains, slightly dialled back.',
                  exercises: ['Warm-up: 1.7km walk + mobility', 'KB Deadlift — [sets] × 10 reps (moderate)', 'KB Goblet Squat — [sets] × 12 reps', 'KB Row — [sets] × 10/side', 'KB Swing — [sets] × 15 reps', 'Squat Jump — [sets] × 8 reps', 'Plank — [sets] × 45s', 'Cool-down stretch'] },
    luteal_l:   { title: 'Strength + Pilates',      intensity: 'Low',      note: 'Late luteal: reduce load, quality over quantity.',
                  exercises: ['Warm-up: 1.7km easy walk', 'KB Deadlift — [sets] × 10 reps (light)', 'KB Goblet Squat — [sets] × 12 reps', 'Push-up — [sets] × 10 reps', 'Glute Bridge — [sets] × 15 reps', 'Pilates core flow 15min', 'Full-body stretch cool-down'] },
  },
  2: { // Tuesday — Sprint
    menstrual:  { title: 'Walk Only',               intensity: 'Walk',     note: 'No sprinting during menstrual phase.',
                  exercises: ['3.4km loop walk', 'Focus on posture: tall spine, engaged glutes', 'Breathe through nose', 'Aim for 7,000+ steps'] },
    follicular: { title: 'Sprints — 100m Focus',    intensity: 'High',     note: 'Builds your 100m and 400m standards. 1× per week only.',
                  exercises: ['Warm-up: 1.7km walk + dynamic drills', 'High knees 2×20m', 'A-skips 2×20m', 'Leg swings 10/side', '3 × strides at 70%', '6 × 100m @ 85–90% effort', 'Full walk-back recovery between each', '90s rest after each sprint', 'Cool-down: 1.7km walk + calf/quad stretch', 'Month 3+: add 2×200m at end'] },
    ovulation:  { title: 'Sprints — Max Effort',    intensity: 'Peak',     note: 'Peak week: go for personal best. Record your 100m time.',
                  exercises: ['Warm-up: 1.7km walk + full activation', 'High knees, A-skips, B-skips, leg swings', '4 × strides building to 90%', '6 × 100m @ 95% — TIME YOURSELF', 'Rest 2 min between sprints', '2 × 200m @ 85% if energy allows', 'Cool-down: 1.7km easy walk', 'Record times in notes ↓'] },
    luteal_e:   { title: 'Sprints — Reduced',       intensity: 'Moderate', note: 'Early luteal: reduce volume, no max effort.',
                  exercises: ['Warm-up: 1.7km walk + activation', 'High knees + leg swings', '4 × 100m @ 80% effort', 'Full recovery between each', '1 × 200m at 75% effort', 'Cool-down walk 1.7km'] },
    luteal_l:   { title: 'Run Intervals — Easy',    intensity: 'Low',      note: 'Late luteal: no sprinting. Easy run/walk intervals only.',
                  exercises: ['Warm-up: 1.7km walk', '2min run, 1min walk × 6 rounds', 'Conversational pace only', 'Cool-down: 1.7km walk', 'Stretch: calves, quads, hip flexors'] },
  },
  3: { // Wednesday — Boxing
    menstrual:  { title: 'Walk + Shadow Boxing',    intensity: 'Walk',     note: 'Very light only. Optional gentle shadow boxing at 30%.',
                  exercises: ['3.4km loop walk', 'Optional: gentle shadow boxing (jab-cross only)', 'No rounds, no intensity', 'Breathe and recover'] },
    follicular: { title: 'Boxing — Conditioning',   intensity: 'High',     note: '5-round structure. Builds endurance for the 5-round standard.',
                  exercises: ['Warm-up: 1.7km walk + shoulder rolls', 'Rd 1 (3min): Jab-cross-hook combos, footwork', '60s rest', 'Rd 2 (3min): Burpee to uppercut ×10 + mountain climbers ×20', '60s rest', 'Rd 3 (3min): Speed combos, shadow', '60s rest', 'Rd 4 (3min): Defensive footwork + counters', '60s rest', 'Rd 5 (3min): Max effort — all combos', 'Cool-down: shoulder, neck, forearm stretch'] },
    ovulation:  { title: 'Boxing — Full Power',     intensity: 'Peak',     note: 'Push every round. Note which round you gas out (if any).',
                  exercises: ['Warm-up: 1.7km walk + full upper body warm-up', 'Rd 1 (3min): Power combos — jab-cross-hook-cross', '60s rest', 'Rd 2 (3min): Body shots + uppercuts + squat-hook', '60s rest', 'Rd 3 (3min): Speed — 20 punches in 10s intervals', '60s rest', 'Rd 4 (3min): Defensive work + slipping + counters', '60s rest', 'Rd 5 (3min): Everything — max effort', 'Note: did you complete all 5 rounds without gassing?'] },
    luteal_e:   { title: 'Boxing — Technique+',     intensity: 'Moderate', note: 'Full session, dial back the max-effort rounds.',
                  exercises: ['Warm-up: walk + mobility', 'Rd 1–3: Technique focus — clean combos, footwork', '60s rest between rounds', 'Rd 4: Moderate intensity', 'Rd 5: 70% effort — finish strong', 'Cool-down stretch'] },
    luteal_l:   { title: 'Boxing — Technique Only', intensity: 'Low',      note: 'Pure technique. No conditioning pressure.',
                  exercises: ['Warm-up: gentle shadow boxing 5min', '20min: footwork patterns only', '20min: combo drilling (slow + precise)', 'No rounds, no timer pressure', 'Focus: head movement, guard, weight transfer', 'Cool-down: full upper body stretch'] },
  },
  4: { // Thursday — Pull/Push/Core
    menstrual:  { title: 'Gentle Core + Walk',      intensity: 'Walk',     note: 'Light core work only. No pull-ups or push-ups during period.',
                  exercises: ['3.4km walk', 'Dead bug — [sets] × 8 (slow)', 'Bird-dog — [sets] × 8/side (slow)', 'Glute bridge hold — [sets] × 30s', 'Cat-cow 10 reps', 'No hanging or pushing work'] },
    follicular: { title: 'Pull · Push · Core — Build', intensity: 'High', note: 'Builds military standards: pull-ups, push-ups, sit-ups.',
                  exercises: ['Warm-up: 1.7km walk + arm circles, scapular rolls', 'Pull progression — [sets] × 8: dead hang → negatives → band → full pull-ups', 'Push-up progression — [sets] × 10: incline → standard → archer', 'Sit-up progression — [sets] × 12: hollow rock → weighted', 'Hanging knee raise — [sets] × 10', 'Plank — [sets] × 45s', 'Pilates cool-down: roll-down, spine stretch'] },
    ovulation:  { title: 'Pull · Push · Core — TEST', intensity: 'Peak',  note: 'Test day. Record all reps against military standards.',
                  exercises: ['Warm-up: 1.7km walk + full upper body prep', 'MAX pull-ups — record number (target: 3 min → 10+ comp)', 'Rest 3 min', 'MAX push-ups in 2 min — record (target: 19 → 40+)', 'Rest 3 min', 'MAX sit-ups in 2 min — record (target: 38 → 65+)', 'Rest 2 min', 'Leg tucks × max — record (target: 5 → 15+)', 'Plank max hold — record time', 'Write ALL scores in notes ↓'] },
    luteal_e:   { title: 'Pull · Push · Core — Hold', intensity: 'Moderate', note: 'Keep the patterns, reduce volume slightly.',
                  exercises: ['Warm-up: walk + scapular activation', 'Pull progression — [sets] × 8', 'Push-up — [sets] × 10', 'Sit-up — [sets] × 12', 'Plank — [sets] × 40s', 'Glute bridge — [sets] × 15', 'Cool-down stretch'] },
    luteal_l:   { title: 'Core + Pilates Focus',    intensity: 'Low',      note: 'Late luteal: quality Pilates core work.',
                  exercises: ['Warm-up: 1.7km easy walk', 'Pilates hundred — [sets] × 10 breaths', 'Dead bug — [sets] × 10 (slow)', 'Bird-dog — [sets] × 10/side', 'Glute bridge — [sets] × 15', 'Side-lying leg lift — [sets] × 12/side', 'Full Pilates stretch sequence'] },
  },
  5: { // Friday — Run + Plyometrics
    menstrual:  { title: 'Walk Only',               intensity: 'Walk',     note: 'No running or plyos during period.',
                  exercises: ['3.4km loop × 1–2 depending on energy', 'Easy comfortable pace', "Notice breathing, don't push", 'Aim for 8,000+ steps total day'] },
    follicular: { title: 'Run + Plyometrics',       intensity: 'High',     note: 'Progress your running week by week. Plyo block after run.',
                  exercises: ['Warm-up: 1.7km walk + leg swings, high knees', 'Months 1–2: Walk/run — 2min on, 1min off × 8', 'Months 3–4: 20–25min continuous run', 'Months 5+: 5K prep — 30–40min continuous', 'Plyo block: Jump squats — [sets] × 12', 'Lateral bounds — [sets] × 10', 'Single-leg hops — [sets] × 8/side', 'Broad jumps — [sets] × 6', 'Cool-down: hamstring, quad, calf stretch'] },
    ovulation:  { title: 'Run — Best Effort',       intensity: 'Peak',     note: 'Peak week: attempt best 5K time or longest continuous run.',
                  exercises: ['Warm-up: 1.7km walk + full activation', 'Attempt 5K — TIME YOURSELF', 'Or: longest continuous run attempt', 'Record distance + time in notes ↓', 'Jump squats — [sets] × 10', 'Box jumps — [sets] × 6', 'Cool-down walk + full leg stretch'] },
    luteal_e:   { title: 'Run + Light Plyos',       intensity: 'Moderate', note: 'Maintain run base. Reduce plyo volume.',
                  exercises: ['Warm-up: 1.7km walk', '20–30min continuous easy run', 'Jump squats — [sets] × 10', 'Lateral bounds — [sets] × 8', 'Cool-down: full leg stretch'] },
    luteal_l:   { title: 'Easy Run or Walk-Run',    intensity: 'Low',      note: 'Late luteal: no plyos. Easy run or extended walk.',
                  exercises: ['Warm-up: 1.7km easy walk', '20min easy run or 2min run/2min walk intervals', 'No plyometrics', 'Cool-down: 1.7km walk + full stretch'] },
  },
  6: { // Saturday — Ruck Walk
    menstrual:  { title: 'Gentle Walk',             intensity: 'Walk',     note: 'No pack during period. Light distance only.',
                  exercises: ['3.4km easy loop × 1', 'No pack', 'Comfortable pace', 'Enjoy the movement'] },
    follicular: { title: 'Ruck Walk — Build',       intensity: 'Moderate', note: 'Core ruck training. Progressive load each month.',
                  exercises: ['2 × 3.4km loops = 6.8km total', 'Months 1–2: 5kg pack', 'Months 3–4: 8kg pack', 'Months 5–6: 10kg pack', 'Month 7+: 12–15kg pack', 'Brisk pace — not leisurely, not running', 'This builds your 12-mile ruck standard'] },
    ovulation:  { title: 'Ruck — Longest of Cycle', intensity: 'High',     note: 'Peak week: furthest and heaviest of the month.',
                  exercises: ['3–4 × 3.4km loops (10–14km)', 'Heaviest pack of the month', 'Maintain brisk pace throughout', 'Record total distance + pack weight in notes ↓', 'Hydrate every 20 min'] },
    luteal_e:   { title: 'Ruck Walk — Maintain',    intensity: 'Moderate', note: 'Same load as follicular this cycle.',
                  exercises: ['2 × 3.4km loops', 'Same pack weight as follicular this cycle', 'Brisk but sustainable pace', 'Posture: chest up, pack weight on hips'] },
    luteal_l:   { title: 'Easy Ruck or Walk',       intensity: 'Low',      note: 'Late luteal: half pack weight or pack-free.',
                  exercises: ['2 × 3.4km loops or 1 loop if fatigued', 'Half pack weight or no pack', 'Easy conversational pace', 'Prioritise completing steps over intensity'] },
  },
}

export const getPhaseKey = (phaseKey, cycleDay) => {
  if (phaseKey === 'luteal') return isLateLuteal(cycleDay) ? 'luteal_l' : 'luteal_e'
  return phaseKey
}

export const getWorkoutForDate = (dateStr, cycleDay) => {
  const dow = dowFromDate(dateStr)
  const { key: phaseKey } = getPhase(cycleDay)
  const pk = getPhaseKey(phaseKey, cycleDay)
  const w = WORKOUTS[dow]?.[pk]
  return w ? { ...w, dow, slot: DAY_SLOTS[dow] } : null
}

export const INTENSITY_COLORS = {
  'Rest':     { bg: '#E8E8E8', text: '#6B6560' },
  'Walk':     { bg: '#C8E0EC', text: '#2A5A72' },
  'Low':      { bg: '#C8E6D4', text: '#2A6A40' },
  'Moderate': { bg: '#FAE8C0', text: '#7A5010' },
  'High':     { bg: '#FAD4B8', text: '#8A3010' },
  'Peak':     { bg: '#FAC8C0', text: '#8A1010' },
}

export const DOW_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export const ENERGY_OPTS = [
  { v: 1, e: '😴', l: 'Very Low' },
  { v: 2, e: '😑', l: 'Low' },
  { v: 3, e: '🙂', l: 'Moderate' },
  { v: 4, e: '💪', l: 'High' },
  { v: 5, e: '🔥', l: 'Peak' },
]
export const MOOD_OPTS = ['😔','😐','🙂','😄','🤩']

export const MILESTONES = [
  'Complete first full sprint session',
  'Run 5K without stopping',
  '5 pull-ups unassisted',
  'Complete 5 boxing rounds without gassing',
  'Saturday ruck with 10kg pack',
  '5K sub-30 minutes',
  '19 push-ups in 2 min (military standard)',
  '38 sit-ups in 2 min (military standard)',
  '3 pull-ups (military minimum)',
  '10 pull-ups (military competitive)',
  '400m sprint completed',
  '12-mile ruck completed',
]

export const PERIODIZATION = [
  { cycles: [1,2,3],    block: 'FOUNDATION',  sub: 'Habit & base',         color: '#3A7D5A' },
  { cycles: [4,5,6],    block: 'BUILD I',      sub: 'Strength + speed',     color: '#C08A20' },
  { cycles: [7,8,9],    block: 'BUILD II',     sub: 'Capacity & endurance', color: '#B85C38' },
  { cycles: [10,11,12], block: 'PERFORMANCE',  sub: 'Hit every standard',   color: '#6A5AAA' },
]

export const getPeriodizationBlock = (cycleNum) => {
  for (const p of PERIODIZATION) {
    if (p.cycles.includes(cycleNum)) return p
  }
  return PERIODIZATION[3]
}
