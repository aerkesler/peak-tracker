// ─────────────────────────────────────────────────────────────────
// PEAK — data.js
// Anchor: May 23 2026 = C1-D1 (Saturday)
// Cycle length: 27 days
// ─────────────────────────────────────────────────────────────────

export const PROGRAM_START  = '2026-05-23'   // C1-D1
export const CYCLE_LENGTH   = 27
export const TOTAL_CYCLES   = 13            // ~12 months

// ── DATE HELPERS ─────────────────────────────────────────────────
export const toDateStr = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth()+1).padStart(2,'0')
  const day = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}

export const addDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

export const daysBetween = (a, b) => {
  const da = new Date(a + 'T12:00:00')
  const db = new Date(b + 'T12:00:00')
  return Math.round((db - da) / 86400000)
}

// Given a date string, return cycleNum (1-based) and cycleDay (1-based)
// using cycle starts array (sorted ascending)
export const resolveCyclePosition = (cycleStarts, dateStr) => {
  let cycleNum = 1
  let cycleStart = cycleStarts[0]
  for (let i = 0; i < cycleStarts.length; i++) {
    if (cycleStarts[i] <= dateStr) {
      cycleNum = i + 1
      cycleStart = cycleStarts[i]
    } else break
  }
  const cycleDay = Math.max(1, daysBetween(cycleStart, dateStr) + 1)
  return { cycleNum, cycleDay, cycleStart }
}

// Program day (1 = May 23 2026)
export const programDay = (dateStr) => daysBetween(PROGRAM_START, dateStr) + 1

// Month number (1–12) from program start
export const getMonthNum = (dateStr) => {
  const d = Math.max(0, daysBetween(PROGRAM_START, dateStr))
  return Math.max(1, Math.min(12, Math.floor(d / 30.44) + 1))
}

// Day of week from date string (0=Sun … 6=Sat)
export const dowFromDate = (dateStr) => new Date(dateStr + 'T12:00:00').getDay()

export const DOW_NAMES  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
export const DOW_SHORT  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// ── PHASES ───────────────────────────────────────────────────────
export const PHASES = {
  menstrual:  { label:'Menstrual',  emoji:'🌑', days:[1,2,3],
                color:'#B85C38', bg:'#FDF0EB', light:'#F5DDD3', textLight:'#E8956D' },
  follicular: { label:'Follicular', emoji:'🌿', days:[4,5,6,7,8,9,10,11,12],
                color:'#3A7D5A', bg:'#EBF5EF', light:'#C8E6D4', textLight:'#5BAA7A' },
  ovulation:  { label:'Ovulation',  emoji:'☀️', days:[13,14,15],
                color:'#C08A20', bg:'#FDF7E8', light:'#F5E8C0', textLight:'#D4A030' },
  luteal:     { label:'Luteal',     emoji:'🌙', days:[16,17,18,19,20,21,22,23,24,25,26,27],
                color:'#6A5AAA', bg:'#F0EEF8', light:'#DDD9F0', textLight:'#8A7ACC' },
}

export const getPhase = (cycleDay) => {
  for (const [key, p] of Object.entries(PHASES)) {
    if (p.days.includes(cycleDay)) return { key, ...p }
  }
  return { key:'luteal', ...PHASES.luteal }
}

export const isLateLuteal = (d) => d >= 21

export const getPhaseKey = (phaseKey, cycleDay) =>
  phaseKey === 'luteal' ? (isLateLuteal(cycleDay) ? 'luteal_l' : 'luteal_e') : phaseKey

// ── SETS SCHEME (by cycle number, not month) ──────────────────────
// This is what changes cycle-to-cycle in the progression
export const getSetsForCycle = (cycleNum) => {
  if (cycleNum <= 3)  return { follicular:3,     ovulation:'3–4', earlyLuteal:3,     lateLuteal:2,   label:'Foundation' }
  if (cycleNum <= 6)  return { follicular:4,     ovulation:'4–5', earlyLuteal:'3–4', lateLuteal:'2–3', label:'Build I' }
  if (cycleNum <= 9)  return { follicular:'4–5', ovulation:5,     earlyLuteal:4,     lateLuteal:3,   label:'Build II' }
  return               { follicular:5,     ovulation:'5–6', earlyLuteal:4,     lateLuteal:3,   label:'Performance' }
}

export const getSetsLabel = (cycleNum, phaseKey, cycleDay) => {
  const s = getSetsForCycle(cycleNum)
  if (phaseKey === 'menstrual') return null
  if (phaseKey === 'ovulation') return s.ovulation
  if (phaseKey === 'luteal') return isLateLuteal(cycleDay) ? s.lateLuteal : s.earlyLuteal
  return s.follicular
}

// ── PROGRESSION NOTES BY CYCLE ────────────────────────────────────
export const getCycleProgression = (cycleNum) => {
  const progs = {
    1:  { sprint:'6×100m @ 85%',         ruck:'5kg · 6.8km',   run:'Walk/run intervals',    boxing:'3 rounds target' },
    2:  { sprint:'6×100m + 2×200m',       ruck:'5kg · 6.8km',   run:'20min continuous',      boxing:'4 rounds target' },
    3:  { sprint:'4×200m + 2×400m',       ruck:'8kg · 6.8km',   run:'25min continuous',      boxing:'5 rounds target' },
    4:  { sprint:'6×100m PB test',         ruck:'8kg · 10km',    run:'30min continuous',      boxing:'5 rounds ✓' },
    5:  { sprint:'400m sub-90s attempt',   ruck:'10kg · 6.8km',  run:'5K attempt',            boxing:'5 rounds strong' },
    6:  { sprint:'400m standard ✓',        ruck:'10kg · 10km',   run:'5K sub-35min',          boxing:'5 rounds dominant' },
    7:  { sprint:'Sprint maintenance',     ruck:'10kg · 12km',   run:'5K sub-32min',          boxing:'Power focus' },
    8:  { sprint:'Sprint + 5K combo',      ruck:'12kg · 12km',   run:'5K sub-30min',          boxing:'Endurance rounds' },
    9:  { sprint:'Sprint PB attempt',      ruck:'12kg · 15km',   run:'5K sub-29min',          boxing:'5 rounds max output' },
    10: { sprint:'Sprint tapering',        ruck:'15kg · 15km',   run:'5K sub-28min',          boxing:'Technical mastery' },
    11: { sprint:'Full standards test',    ruck:'15kg · 18km',   run:'5K sub-27min',          boxing:'5 rounds elite' },
    12: { sprint:'Race day prep',          ruck:'15kg · 20km',   run:'5K race pace',          boxing:'Peak conditioning' },
    13: { sprint:'Repeat cycle 1 targets', ruck:'Maintain 15kg', run:'Maintain sub-27min',    boxing:'Maintain standards' },
  }
  return progs[cycleNum] || progs[13]
}

// ── DAY SLOTS (Sun=0 system) ──────────────────────────────────────
export const DAY_SLOTS = {
  0: { name:'Rest / Pilates',     icon:'🧘' },
  1: { name:'Strength',           icon:'🏋️' },
  2: { name:'Sprint + Cardio',    icon:'⚡' },
  3: { name:'Boxing',             icon:'🥊' },
  4: { name:'Pull · Push · Core', icon:'💪' },
  5: { name:'Run + Plyometrics',  icon:'🏃' },
  6: { name:'Ruck Walk',          icon:'🎒' },
}

// ── WORKOUTS ─────────────────────────────────────────────────────
const W = {
  0: { // Sunday
    menstrual:  { title:'Full Rest',               intensity:'Rest',     note:'Hormones lowest. Walk only if you want.',
                  exercises:['Full rest — no structured workout','Optional: 20-min gentle walk','Hydrate · prioritise sleep tonight'] },
    follicular: { title:'Active Recovery Pilates', intensity:'Low',      note:"Consolidate the week's training.",
                  exercises:['Pilates roll-down × 8','Spine stretch forward × 8','Mermaid stretch 60s/side','Cat-cow × 10','Child\'s pose 2 min','Optional: 3.4km easy walk'] },
    ovulation:  { title:'Active Recovery Pilates', intensity:'Low',      note:'Even at peak phase, Sunday is recovery.',
                  exercises:['Pilates roll-down × 8','Hip flexor stretch 90s/side','Thread-the-needle × 8/side','Box breathing 5 min'] },
    luteal_e:   { title:'Rest or Gentle Pilates',  intensity:'Rest',     note:'Check HRV. Low → full rest. Recovered → Pilates.',
                  exercises:['HRV check first','If recovered: Dead bug × 10','Bird-dog × 10/side','Clam shells × 15','If low HRV: full rest only'] },
    luteal_l:   { title:'Full Rest',               intensity:'Rest',     note:'Body preparing to reset.',
                  exercises:['Full rest','Hydrate · 2.5L water','Sleep 8+ hours','Prepare for new cycle'] },
  },
  1: { // Monday — Strength
    menstrual:  { title:'Walk Only',               intensity:'Walk',     note:'No loading. Prostaglandins high — movement good, intensity counterproductive.',
                  exercises:['3.4km loop walk at easy pace','Belly breathing focus','Hip circles while walking','Aim 7,000+ steps'] },
    follicular: { title:'KB Strength — Build',     intensity:'High',     note:'Best strength adaptation window. Push the weight.',
                  exercises:['Warm-up: 1.7km brisk walk + joint CARs','KB Deadlift — [sets] × 10','KB Goblet Squat — [sets] × 12','KB Single-Arm Row — [sets] × 10/side','KB Swing — [sets] × 15','Box Jump — [sets] × 8','Hollow Body Hold — [sets] × 30s','Cool-down: hip flexor + hamstring'] },
    ovulation:  { title:'KB Strength — Peak',      intensity:'Peak',     note:'Strongest week. Go heavier than follicular. Test new weights.',
                  exercises:['Warm-up: 1.7km walk + activation','KB Deadlift — [sets] × 8 (heaviest)','KB Goblet Squat — [sets] × 10 (heavy)','KB Clean + Press — [sets] × 8/side','KB Swing — [sets] × 20','Broad Jump — [sets] × 6','L-sit / Hollow Rock — [sets] × 30s','Record weights in notes ↓'] },
    luteal_e:   { title:'KB Strength — Maintain',  intensity:'Moderate', note:'Maintain gains. Slightly dialled back.',
                  exercises:['Warm-up: 1.7km walk + mobility','KB Deadlift — [sets] × 10 (moderate)','KB Goblet Squat — [sets] × 12','KB Row — [sets] × 10/side','KB Swing — [sets] × 15','Squat Jump — [sets] × 8','Plank — [sets] × 45s','Cool-down stretch'] },
    luteal_l:   { title:'Strength + Pilates',      intensity:'Low',      note:'Reduce load. Quality over quantity.',
                  exercises:['Warm-up: 1.7km easy walk','KB Deadlift — [sets] × 10 (light)','KB Goblet Squat — [sets] × 12','Push-up — [sets] × 10','Glute Bridge — [sets] × 15','Pilates core flow 15min','Full-body stretch'] },
  },
  2: { // Tuesday — Sprint
    menstrual:  { title:'Walk Only',               intensity:'Walk',     note:'No sprinting during period.',
                  exercises:['3.4km loop walk','Tall posture, engaged glutes','Nasal breathing','Aim 7,000+ steps'] },
    follicular: { title:'Sprints — 100m Focus',    intensity:'High',     note:'Builds 100m and 400m standards. 1× per week.',
                  exercises:['Warm-up: 1.7km walk + dynamic drills','High knees 2×20m · A-skips 2×20m','Leg swings 10/side','3 × strides @ 70%','6 × 100m @ 85–90% effort','Full walk-back recovery between','90s rest after each','Cool-down: 1.7km walk + calf/quad stretch'] },
    ovulation:  { title:'Sprints — Max Effort',    intensity:'Peak',     note:'Go for personal best. TIME yourself.',
                  exercises:['Warm-up: 1.7km walk + full activation','High knees · A-skips · B-skips · leg swings','4 × strides to 90%','6 × 100m @ 95% — TIME EACH ONE','2 min rest between','2 × 200m @ 85% if energy allows','Cool-down: 1.7km easy walk','Record all times in notes ↓'] },
    luteal_e:   { title:'Sprints — Reduced',       intensity:'Moderate', note:'Reduced volume. No max effort.',
                  exercises:['Warm-up: 1.7km walk + activation','High knees + leg swings','4 × 100m @ 80%','Full recovery between','1 × 200m @ 75%','Cool-down walk 1.7km'] },
    luteal_l:   { title:'Run Intervals — Easy',    intensity:'Low',      note:'No sprinting. Easy intervals only.',
                  exercises:['Warm-up: 1.7km walk','2min run · 1min walk × 6','Conversational pace','Cool-down: 1.7km walk','Stretch: calves, quads, hip flexors'] },
  },
  3: { // Wednesday — Boxing
    menstrual:  { title:'Walk + Shadow Boxing',    intensity:'Walk',     note:'Very light. Optional shadow boxing at 30%.',
                  exercises:['3.4km loop walk','Optional: gentle shadow (jab-cross only)','No rounds, no intensity','Breathe and recover'] },
    follicular: { title:'Boxing — Conditioning',   intensity:'High',     note:'5-round structure. Builds endurance standard.',
                  exercises:['Warm-up: 1.7km walk + shoulder rolls','Rd 1 (3min): Jab-cross-hook combos + footwork','60s rest','Rd 2 (3min): Burpee-to-uppercut ×10 + mtn climbers ×20','60s rest','Rd 3 (3min): Speed combos + shadow','60s rest','Rd 4 (3min): Defensive footwork + counters','60s rest','Rd 5 (3min): Max effort — all combos','Cool-down: shoulder, neck, forearm stretch'] },
    ovulation:  { title:'Boxing — Full Power',     intensity:'Peak',     note:'Push every round. Note which round you gas out.',
                  exercises:['Warm-up: 1.7km walk + full upper body','Rd 1 (3min): Power combos','60s rest','Rd 2 (3min): Body shots + uppercuts + squat-hook','60s rest','Rd 3 (3min): Speed — 20 punches in 10s bursts','60s rest','Rd 4 (3min): Defensive + slipping + counters','60s rest','Rd 5 (3min): Everything — max effort','Note: gas-out round (if any) in notes ↓'] },
    luteal_e:   { title:'Boxing — Technique+',     intensity:'Moderate', note:'Full session. Dial back max-effort rounds.',
                  exercises:['Warm-up: walk + mobility','Rd 1–3: Technique — clean combos, footwork','60s rest between','Rd 4: Moderate sustained effort','Rd 5: 70% — finish strong','Cool-down stretch'] },
    luteal_l:   { title:'Boxing — Technique Only', intensity:'Low',      note:'Pure technique. No conditioning pressure.',
                  exercises:['Gentle shadow boxing warm-up 5min','20min: footwork patterns only','20min: combo drilling (slow + precise)','No rounds, no timer','Focus: head movement · guard · weight transfer','Full upper body stretch'] },
  },
  4: { // Thursday — Pull/Push/Core
    menstrual:  { title:'Gentle Core + Walk',          intensity:'Walk',     note:'Light core only. No pull-ups or push-ups.',
                  exercises:['3.4km walk','Dead bug — [sets] × 8 (slow)','Bird-dog — [sets] × 8/side','Glute bridge hold — [sets] × 30s','Cat-cow × 10','No hanging or pushing'] },
    follicular: { title:'Pull · Push · Core — Build',  intensity:'High',     note:'Builds military standards: pull-ups, push-ups, sit-ups.',
                  exercises:['Warm-up: 1.7km walk + arm circles, scapular rolls','Pull progression — [sets] × 8 (dead hang → negatives → band → full)','Push-up progression — [sets] × 10 (incline → standard → archer)','Sit-up progression — [sets] × 12 (hollow rock → weighted)','Hanging knee raise — [sets] × 10','Plank — [sets] × 45s','Pilates cool-down'] },
    ovulation:  { title:'Pull · Push · Core — TEST',   intensity:'Peak',     note:'Test day. Record everything.',
                  exercises:['Warm-up: 1.7km walk + upper body prep','MAX pull-ups — record (target: 3 → 10+)','Rest 3 min','MAX push-ups in 2 min — record (target: 19 → 40+)','Rest 3 min','MAX sit-ups in 2 min — record (target: 38 → 65+)','Rest 2 min','Leg tucks max — record (target: 5 → 15+)','Plank max hold — record','ALL scores in notes ↓'] },
    luteal_e:   { title:'Pull · Push · Core — Hold',   intensity:'Moderate', note:'Maintain patterns, reduce volume.',
                  exercises:['Warm-up: walk + scapular activation','Pull progression — [sets] × 8','Push-up — [sets] × 10','Sit-up — [sets] × 12','Plank — [sets] × 40s','Glute bridge — [sets] × 15','Cool-down stretch'] },
    luteal_l:   { title:'Core + Pilates Focus',         intensity:'Low',      note:'Quality Pilates core work.',
                  exercises:['Warm-up: 1.7km easy walk','Pilates hundred — [sets] × 10 breaths','Dead bug — [sets] × 10 (slow)','Bird-dog — [sets] × 10/side','Glute bridge — [sets] × 15','Side-lying leg lift — [sets] × 12/side','Full Pilates stretch'] },
  },
  5: { // Friday — Run + Plyometrics
    menstrual:  { title:'Walk Only',               intensity:'Walk',     note:'No running or plyos during period.',
                  exercises:['3.4km loop × 1–2 depending on energy','Easy comfortable pace','Aim 8,000+ steps total'] },
    follicular: { title:'Run + Plyometrics',       intensity:'High',     note:'Progress run each week. Plyo block after.',
                  exercises:['Warm-up: 1.7km walk + leg swings, high knees','C1–2: Walk/run — 2min on, 1min off × 8','C3–4: 20–25min continuous','C5+: 5K prep — 30–40min continuous','Jump squats — [sets] × 12','Lateral bounds — [sets] × 10','Single-leg hops — [sets] × 8/side','Broad jumps — [sets] × 6','Cool-down: hamstring, quad, calf'] },
    ovulation:  { title:'Run — Best Effort',       intensity:'Peak',     note:'Attempt best 5K time. Record it.',
                  exercises:['Warm-up: 1.7km walk + full activation','5K attempt — TIME YOURSELF','Or: longest continuous run','Record distance + time in notes ↓','Jump squats — [sets] × 10','Box jumps — [sets] × 6','Cool-down + full leg stretch'] },
    luteal_e:   { title:'Run + Light Plyos',       intensity:'Moderate', note:'Maintain base. Reduce plyo volume.',
                  exercises:['Warm-up: 1.7km walk','20–30min easy continuous run','Jump squats — [sets] × 10','Lateral bounds — [sets] × 8','Cool-down: full leg stretch'] },
    luteal_l:   { title:'Easy Run or Walk-Run',    intensity:'Low',      note:'No plyos. Easy run or extended walk.',
                  exercises:['Warm-up: 1.7km easy walk','20min easy run or 2min run/2min walk intervals','No plyometrics','Cool-down: 1.7km walk + full stretch'] },
  },
  6: { // Saturday — Ruck Walk
    menstrual:  { title:'Gentle Walk',             intensity:'Walk',     note:'No pack during period.',
                  exercises:['3.4km easy loop × 1','No pack','Comfortable pace','Enjoy the movement'] },
    follicular: { title:'Ruck Walk — Build',       intensity:'Moderate', note:'Progressive load each cycle.',
                  exercises:['2 × 3.4km loops = 6.8km','C1–2: 5kg pack','C3–4: 8kg pack','C5–6: 10kg pack','C7+: 12–15kg pack','Brisk pace — not leisurely, not running','Building to 12-mile ruck standard'] },
    ovulation:  { title:'Ruck — Longest of Cycle', intensity:'High',     note:'Furthest + heaviest of the month.',
                  exercises:['3–4 × 3.4km loops (10–14km)','Heaviest pack this cycle','Brisk pace throughout','Record distance + pack weight in notes ↓','Hydrate every 20 min'] },
    luteal_e:   { title:'Ruck Walk — Maintain',    intensity:'Moderate', note:'Same load as follicular this cycle.',
                  exercises:['2 × 3.4km loops','Same pack as follicular this cycle','Brisk sustainable pace','Chest up · pack weight on hips'] },
    luteal_l:   { title:'Easy Ruck or Walk',       intensity:'Low',      note:'Half pack weight or pack-free.',
                  exercises:['2 × 3.4km loops or 1 loop if fatigued','Half pack or no pack','Easy conversational pace','Steps over intensity'] },
  },
}

export const WORKOUTS = W

export const getWorkoutForDate = (dateStr, cycleDay) => {
  const dow = dowFromDate(dateStr)
  const { key: phaseKey } = getPhase(cycleDay)
  const pk = getPhaseKey(phaseKey, cycleDay)
  const w = W[dow]?.[pk]
  return w ? { ...w, dow, slot: DAY_SLOTS[dow] } : null
}

// Inject sets number into exercise strings
export const injectSets = (exercises, setsLabel) =>
  exercises.map(ex => ex.replace('[sets]', `${setsLabel} sets`))

// ── INTENSITY COLOURS ─────────────────────────────────────────────
export const INTENSITY_COLORS = {
  'Rest':     { bg:'#2A2A2A', text:'#8A8A8A' },
  'Walk':     { bg:'#1A3040', text:'#6AAAC8' },
  'Low':      { bg:'#1A3025', text:'#6AAA80' },
  'Moderate': { bg:'#3A2E10', text:'#C8A040' },
  'High':     { bg:'#3A1E10', text:'#C87040' },
  'Peak':     { bg:'#3A1018', text:'#C84060' },
}

// ── CHECK-IN ─────────────────────────────────────────────────────
export const ENERGY_OPTS = [
  { v:1, e:'😴', l:'Very Low' },
  { v:2, e:'😑', l:'Low' },
  { v:3, e:'🙂', l:'Moderate' },
  { v:4, e:'💪', l:'High' },
  { v:5, e:'🔥', l:'Peak' },
]
export const MOOD_OPTS = ['😔','😐','🙂','😄','🤩']

// ── MILESTONES ────────────────────────────────────────────────────
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

// ── PERIODIZATION ─────────────────────────────────────────────────
export const PERIODIZATION = [
  { cycles:[1,2,3],    block:'FOUNDATION',  sub:'Habit & base',         color:'#3A7D5A' },
  { cycles:[4,5,6],    block:'BUILD I',     sub:'Strength + speed',     color:'#C08A20' },
  { cycles:[7,8,9],    block:'BUILD II',    sub:'Capacity & endurance', color:'#B85C38' },
  { cycles:[10,11,12], block:'PERFORMANCE', sub:'Hit every standard',   color:'#6A5AAA' },
  { cycles:[13],       block:'PEAK',        sub:'Sustain & master',     color:'#C08A20' },
]

export const getPeriodizationBlock = (cycleNum) => {
  for (const p of PERIODIZATION) {
    if (p.cycles.includes(cycleNum)) return p
  }
  return PERIODIZATION[4]
}
