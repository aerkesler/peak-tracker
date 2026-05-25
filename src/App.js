import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import {
  PHASES, CYCLE_LENGTH, DAY_SLOTS, DOW_NAMES,
  ENERGY_OPTS, MOOD_OPTS, MILESTONES, INTENSITY_COLORS,
  PROGRAM_START, PERIODIZATION,
  getPhase, getPhaseKey, isLateLuteal, getSetsScheme,
  getMonthNum, getWorkoutForDate, getPeriodizationBlock,
  resolveCyclePosition, programDay, daysBetween, toDateStr, dowFromDate,
} from './data'

// ── HELPERS ───────────────────────────────────────────────────────
const todayStr = () => toDateStr(new Date())

// Inject sets count into exercise strings
const injectSets = (exercises, setsLabel) =>
  exercises.map(ex => ex.replace('[sets]', `${setsLabel} sets`))

// ── STYLES ────────────────────────────────────────────────────────
const S = {
  app:      { fontFamily: "'DM Sans','Arial',sans-serif", background: '#0F1A15', minHeight: '100vh', color: '#F0EBE3' },
  nav:      { background: '#0A1A10', borderBottom: '1px solid #1E3028', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, position: 'sticky', top: 0, zIndex: 100 },
  tabs:     { background: '#0A1A10', borderBottom: '1px solid #1E3028', display: 'flex', padding: '0 20px', overflowX: 'auto' },
  content:  { padding: '20px', maxWidth: 660, margin: '0 auto' },
  card:     { background: '#141F18', border: '1px solid #1E3028', borderRadius: 14, padding: 18, marginBottom: 16 },
  label:    { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4A6A55', marginBottom: 6, display: 'block' },
  input:    { width: '100%', padding: '8px 10px', border: '1px solid #1E3028', borderRadius: 8, fontSize: 13, background: '#0F1A15', color: '#F0EBE3', outline: 'none', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: 10, border: '1px solid #1E3028', borderRadius: 8, fontSize: 13, background: '#0F1A15', color: '#F0EBE3', outline: 'none', minHeight: 80, resize: 'vertical', boxSizing: 'border-box' },
  h1:       { fontFamily: "'Georgia',serif", fontSize: 24, color: '#F0EBE3', marginBottom: 4 },
  h2:       { fontFamily: "'Georgia',serif", fontSize: 18, color: '#F0EBE3', marginBottom: 10 },
  sub:      { fontSize: 12, color: '#4A6A55', marginBottom: 16 },
  btn:      (bg='#2D4A3E', color='#F0EBE3') => ({ background: bg, color, border: 'none', borderRadius: 10, padding: '12px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', width: '100%', letterSpacing: '0.05em' }),
  row:      { display: 'flex', alignItems: 'center', gap: 10 },
}

// ── SYNC BADGE ────────────────────────────────────────────────────
function SyncBadge({ status }) {
  const map = { syncing: ['#C08A20', 'Saving…'], saved: ['#3A7D5A', '✓ Saved'], error: ['#B85C38', 'Error'] }
  const [color, label] = map[status] || ['', '']
  if (!label) return null
  return <span style={{ fontSize: 11, color, marginLeft: 8 }}>{label}</span>
}

// ── NEW CYCLE MODAL ───────────────────────────────────────────────
function NewCycleModal({ onConfirm, onCancel, suggestedDate }) {
  const [date, setDate] = useState(suggestedDate || todayStr())
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#141F18', border: '1px solid #1E3028', borderRadius: 16, padding: 28, maxWidth: 380, width: '100%' }}>
        <div style={S.h1}>🌑 New Cycle Started</div>
        <p style={{ fontSize: 13, color: '#6A8A72', lineHeight: 1.6, marginBottom: 20 }}>
          Mark the date your period began. This resets your cycle day count and updates all future workouts. You can set it to today or a past date if it started earlier.
        </p>
        <label style={S.label}>Period start date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ ...S.input, marginBottom: 20 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ ...S.btn('#1E3028', '#6A8A72'), flex: 1 }}>Cancel</button>
          <button onClick={() => onConfirm(date)} style={{ ...S.btn('#B85C38'), flex: 2 }}>Start New Cycle</button>
        </div>
      </div>
    </div>
  )
}

// ── MAIN APP ──────────────────────────────────────────────────────
export default function App() {
  const today = todayStr()

  // ── STATE ──────────────────────────────────────────────────────
  const [tab, setTab]               = useState('today')
  const [viewDate, setViewDate]     = useState(today)       // which date the user is viewing
  const [logs, setLogs]             = useState({})           // keyed by date string
  const [milestones, setMilestones] = useState({})
  const [cycleStarts, setCycleStarts] = useState([PROGRAM_START]) // sorted array of cycle start dates
  const [syncStatus, setSyncStatus] = useState('idle')
  const [loading, setLoading]       = useState(true)
  const [showNewCycle, setShowNewCycle] = useState(false)
  const [expandedLog, setExpandedLog]  = useState(null)

  // ── DERIVED FROM viewDate ──────────────────────────────────────
  const { cycleNum, cycleDay } = resolveCyclePosition(cycleStarts, viewDate)
  const progDay   = programDay(viewDate)
  const phase     = getPhase(cycleDay)
  const monthNum  = getMonthNum(viewDate)
  const sets      = getSetsScheme(monthNum)
  const progBlock = getPeriodizationBlock(cycleNum)
  const workout   = getWorkoutForDate(viewDate, cycleDay)
  const isToday   = viewDate === today

  // Sets label for this date's phase
  const setsLabel = () => {
    const pk = phase.key === 'luteal'
      ? (isLateLuteal(cycleDay) ? 'lateLuteal' : 'earlyLuteal')
      : phase.key
    return sets[pk] || 3
  }

  // Entry for the currently viewed date (always from logs keyed by date)
  const blankEntry = { checks: {}, energy: 3, mood: 2, steps: '', water: '', weight: '', notes: '' }
  const currentEntry = logs[viewDate] || blankEntry

  const setCurrentEntry = (updater) => {
    setLogs(prev => {
      const existing = prev[viewDate] || blankEntry
      const updated = typeof updater === 'function' ? updater(existing) : updater
      return { ...prev, [viewDate]: updated }
    })
  }

  // ── LOAD FROM SUPABASE ─────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [{ data: logData }, { data: mData }, { data: csData }] = await Promise.all([
          supabase.from('peak_logs').select('*').order('date', { ascending: false }),
          supabase.from('peak_milestones').select('*'),
          supabase.from('peak_cycle_starts').select('start_date').order('start_date', { ascending: true }),
        ])
        if (logData) {
          const mapped = {}
          logData.forEach(l => {
            mapped[l.date] = {
              checks: l.checks || {},
              energy: l.energy || 3,
              mood:   l.mood   ?? 2,
              steps:  l.steps  || '',
              water:  l.water  || '',
              weight: l.weight || '',
              notes:  l.notes  || '',
            }
          })
          setLogs(mapped)
        }
        if (mData) {
          const mm = {}
          mData.forEach(m => { mm[m.id] = m.achieved })
          setMilestones(mm)
        }
        if (csData && csData.length > 0) {
          setCycleStarts(csData.map(r => r.start_date))
        }
      } catch (e) { console.error('Load error:', e) }
      setLoading(false)
    }
    load()
  }, [])

  // ── SAVE LOG FOR viewDate ──────────────────────────────────────
  const saveLog = useCallback(async () => {
    setSyncStatus('syncing')
    const entry = currentEntry
    const { error } = await supabase.from('peak_logs').upsert({
      date:      viewDate,
      cycle_num: cycleNum,
      cycle_day: cycleDay,
      prog_day:  progDay,
      phase:     phase.key,
      dow:       dowFromDate(viewDate),
      checks:    entry.checks,
      energy:    entry.energy,
      mood:      entry.mood,
      steps:     entry.steps,
      water:     entry.water,
      weight:    entry.weight,
      notes:     entry.notes,
    }, { onConflict: 'date' })
    if (error) { setSyncStatus('error'); setTimeout(() => setSyncStatus('idle'), 3000) }
    else { setSyncStatus('saved'); setTimeout(() => setSyncStatus('idle'), 2500) }
  }, [currentEntry, viewDate, cycleNum, cycleDay, progDay, phase.key])

  // ── NEW CYCLE ──────────────────────────────────────────────────
  const confirmNewCycle = async (dateStr) => {
    const newStarts = [...cycleStarts.filter(d => d !== dateStr), dateStr].sort()
    setCycleStarts(newStarts)
    setShowNewCycle(false)
    // Persist to Supabase
    await supabase.from('peak_cycle_starts').upsert({ start_date: dateStr }, { onConflict: 'start_date' })
  }

  // ── MILESTONE ──────────────────────────────────────────────────
  const toggleMilestone = async (idx) => {
    const newVal = !milestones[idx]
    setMilestones(prev => ({ ...prev, [idx]: newVal }))
    await supabase.from('peak_milestones').upsert(
      { id: idx, achieved: newVal, achieved_at: newVal ? new Date().toISOString() : null },
      { onConflict: 'id' }
    )
  }

  // ── ENTRY HELPERS ──────────────────────────────────────────────
  const toggleCheck = (i) => setCurrentEntry(p => ({ ...p, checks: { ...p.checks, [i]: !p.checks[i] } }))
  const doneCount = workout ? workout.exercises.filter((_, i) => currentEntry.checks?.[i]).length : 0

  // ── PHASE SHIFT ────────────────────────────────────────────────
  const nextShift = (() => {
    const curKey = phase.key
    for (let d = cycleDay + 1; d <= CYCLE_LENGTH; d++) {
      const p = getPhase(d)
      if (p.key !== curKey) {
        const daysAway = d - cycleDay
        const shiftDate = new Date(viewDate + 'T12:00:00')
        shiftDate.setDate(shiftDate.getDate() + daysAway)
        return { day: d, phase: p, daysAway, dow: shiftDate.getDay(), dateStr: toDateStr(shiftDate) }
      }
    }
    const daysAway = CYCLE_LENGTH - cycleDay + 1
    const shiftDate = new Date(viewDate + 'T12:00:00')
    shiftDate.setDate(shiftDate.getDate() + daysAway)
    return { day: 1, phase: { key: 'menstrual', ...PHASES.menstrual }, daysAway, dow: shiftDate.getDay(), dateStr: toDateStr(shiftDate), nextCycle: true }
  })()

  const lutealSplit = (phase.key === 'luteal' && cycleDay < 21) ? (() => {
    const daysAway = 21 - cycleDay
    const d = new Date(viewDate + 'T12:00:00')
    d.setDate(d.getDate() + daysAway)
    return { daysAway, dow: d.getDay() }
  })() : null

  // ── STATS ──────────────────────────────────────────────────────
  const logDates = Object.keys(logs).sort().reverse()
  const totalSessions = Object.values(logs).filter(l => l.checks && Object.values(l.checks).some(Boolean)).length
  const avgEnergy = logDates.length
    ? (Object.values(logs).reduce((s, l) => s + (l.energy || 0), 0) / logDates.length).toFixed(1)
    : '—'

  // Days into program
  const daysInProgram = daysBetween(PROGRAM_START, today) + 1

  if (loading) return (
    <div style={{ ...S.app, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontFamily: "'Georgia',serif", fontSize: 28, color: '#F0EBE3', letterSpacing: '0.3em' }}>PEAK</div>
      <div style={{ fontSize: 13, color: '#4A6A55' }}>Loading your data…</div>
    </div>
  )

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:#2A3D33;border-radius:3px}
        input,textarea,select{font-family:'DM Sans','Arial',sans-serif}
        .ex-row:hover{background:rgba(255,255,255,0.03)!important;border-radius:6px}
        .tab-btn:hover{color:#F0EBE3!important}
        .log-row:hover{background:#1A2A20!important}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .fade{animation:fadeUp 0.25s ease both}
        @keyframes pop{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
        .pop{animation:pop 0.3s ease}
        input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(0.5)}
      `}</style>

      {showNewCycle && (
        <NewCycleModal
          suggestedDate={today}
          onConfirm={confirmNewCycle}
          onCancel={() => setShowNewCycle(false)}
        />
      )}

      {/* ── NAV ── */}
      <div style={S.nav}>
        <div>
          <div style={{ fontFamily: "'Georgia',serif", fontSize: 20, fontWeight: 300, letterSpacing: '0.3em', color: '#F0EBE3' }}>
            PEAK <span style={{ fontStyle: 'italic', color: phase.textLight }}>Tracker</span>
          </div>
          <div style={{ fontSize: 11, color: '#4A6A55', marginTop: 2 }}>
            Program Day {daysInProgram} · C{cycleNum}-D{cycleDay} · {phase.emoji} {phase.label}
            <SyncBadge status={syncStatus} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ background: phase.color + '22', border: `1px solid ${phase.color}44`, color: phase.textLight, borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 500 }}>
            {progBlock.block} · Mo {monthNum}
          </div>
          <button onClick={() => setShowNewCycle(true)}
            style={{ background: '#B85C3822', border: '1px solid #B85C3866', color: '#E8956D', borderRadius: 20, padding: '4px 12px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
            🌑 New Cycle
          </button>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={S.tabs}>
        {[['today', 'Today'], ['week', 'This Week'], ['history', 'History'], ['stats', 'Stats']].map(([id, label]) => (
          <button key={id} className="tab-btn" onClick={() => setTab(id)} style={{
            padding: '11px 14px', background: 'none', border: 'none',
            borderBottom: tab === id ? `2px solid ${phase.color}` : '2px solid transparent',
            color: tab === id ? phase.textLight : '#4A6A55',
            fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>{label}</button>
        ))}
      </div>

      <div style={S.content}>

        {/* ════ TODAY ════ */}
        {tab === 'today' && (
          <div className="fade">

            {/* Date selector */}
            <div style={{ ...S.card, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#4A6A55', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Viewing</div>
                <div style={{ fontSize: 15, color: '#F0EBE3', fontWeight: 500 }}>
                  {new Date(viewDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
                <div style={{ fontSize: 12, color: phase.textLight, marginTop: 2 }}>
                  C{cycleNum}-D{cycleDay} · Program Day {progDay} · {phase.emoji} {phase.label}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                <input type="date" value={viewDate} onChange={e => setViewDate(e.target.value)}
                  style={{ ...S.input, width: 'auto', fontSize: 12, padding: '6px 8px' }} />
                {!isToday && (
                  <button onClick={() => setViewDate(today)}
                    style={{ background: 'none', border: '1px solid #1E3028', color: '#6A8A72', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>
                    ← Back to today
                  </button>
                )}
              </div>
            </div>

            {/* Phase shift banner */}
            {(() => {
              const sp = nextShift.phase
              const urgColor = nextShift.daysAway <= 1 ? '#C08A20' : sp.color
              const label = nextShift.daysAway === 0 ? 'Today' : nextShift.daysAway === 1 ? 'Tomorrow' : `in ${nextShift.daysAway} days`
              return (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ background: '#141F18', border: `1px solid ${urgColor}44`, borderLeft: `3px solid ${urgColor}`, borderRadius: 10, padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#4A6A55', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Next phase shift</div>
                      <div style={{ fontSize: 13, color: '#C8D8CC' }}>
                        <span style={{ color: urgColor, fontWeight: 600 }}>{sp.emoji} {sp.label}</span>
                        {' begins '}<span style={{ color: '#8AAA90' }}>{label}</span>
                        {' · '}<span style={{ color: '#6A8A72' }}>{DOW_NAMES[nextShift.dow]}{nextShift.nextCycle ? ' (new cycle)' : ''}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#4A6A55', marginTop: 2 }}>
                        {sp.key === 'follicular' && 'Training ramps up — strength + sprints begin'}
                        {sp.key === 'ovulation' && 'Peak performance window — hardest sessions here'}
                        {sp.key === 'luteal' && 'Sustain intensity early, taper toward end'}
                        {sp.key === 'menstrual' && 'Rest days begin — walks + Pilates only'}
                      </div>
                    </div>
                    <div style={{ background: urgColor + '22', border: `1px solid ${urgColor}44`, color: urgColor, borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                      {nextShift.daysAway === 0 ? 'Now' : `${nextShift.daysAway}d`}
                    </div>
                  </div>
                  {lutealSplit && (
                    <div style={{ background: '#141F18', border: '1px solid #6A5AAA44', borderLeft: '3px solid #6A5AAA66', borderRadius: 10, padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#4A6A55', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Luteal intensity drop</div>
                        <div style={{ fontSize: 13, color: '#C8D8CC' }}>
                          <span style={{ color: '#8A7ACC' }}>🌙 Late luteal</span>
                          {' begins in '}<span style={{ color: '#8AAA90' }}>{lutealSplit.daysAway} day{lutealSplit.daysAway !== 1 ? 's' : ''}</span>
                          {' · '}<span style={{ color: '#6A8A72' }}>{DOW_NAMES[lutealSplit.dow]}, Day 21</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#4A6A55', marginTop: 2 }}>Sessions dial down — Pilates, technique, easy runs</div>
                      </div>
                      <div style={{ background: '#6A5AAA22', border: '1px solid #6A5AAA44', color: '#8A7ACC', borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{lutealSplit.daysAway}d</div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Sets reminder */}
            {phase.key !== 'menstrual' && (
              <div style={{ background: phase.color + '18', border: `1px solid ${phase.color}33`, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ color: phase.textLight, fontWeight: 600, fontSize: 13 }}>Sets today: {setsLabel()}</span>
                  <span style={{ color: '#6A8A72', fontSize: 12 }}> · {phase.label} phase · Month {monthNum}</span>
                </div>
                <div style={{ fontSize: 11, background: (INTENSITY_COLORS[workout?.intensity || 'Rest'] || {}).bg, color: (INTENSITY_COLORS[workout?.intensity || 'Rest'] || {}).text, padding: '3px 8px', borderRadius: 8, fontWeight: 600 }}>
                  {workout?.intensity}
                </div>
              </div>
            )}

            {/* Workout card */}
            {workout && (
              <div style={{ background: '#141F18', border: '1px solid #1E3028', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ background: phase.color + '18', borderBottom: '1px solid #1E3028', padding: '14px 18px' }}>
                  <div style={{ fontSize: 11, color: '#4A6A55', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>
                    {workout.slot.icon} {workout.slot.name} · {DOW_NAMES[workout.dow]}
                  </div>
                  <div style={{ fontFamily: "'Georgia',serif", fontSize: 22, color: '#F0EBE3', lineHeight: 1.1, marginBottom: 4 }}>{workout.title}</div>
                  {workout.note && <div style={{ fontSize: 12, color: '#6A8A72', lineHeight: 1.6 }}>{workout.note}</div>}
                  <div style={{ fontSize: 12, color: '#4A6A55', marginTop: 6 }}>{doneCount}/{workout.exercises.length} completed</div>
                </div>
                <div style={{ height: 3, background: '#1E3028' }}>
                  <div style={{ height: '100%', width: `${workout.exercises.length ? (doneCount / workout.exercises.length) * 100 : 0}%`, background: phase.color, transition: 'width 0.4s ease' }} />
                </div>
                {injectSets(workout.exercises, setsLabel()).map((ex, i) => (
                  <div key={i} className="ex-row" onClick={() => toggleCheck(i)} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 18px',
                    borderBottom: i < workout.exercises.length - 1 ? '1px solid #1A2A20' : 'none', cursor: 'pointer',
                  }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
                      background: currentEntry.checks?.[i] ? phase.color : 'transparent',
                      border: `2px solid ${currentEntry.checks?.[i] ? phase.color : '#2A4035'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                    }}>
                      {currentEntry.checks?.[i] && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
                    </div>
                    <div style={{ fontSize: 13, color: currentEntry.checks?.[i] ? '#4A6A55' : '#C8D8CC', textDecoration: currentEntry.checks?.[i] ? 'line-through' : 'none', lineHeight: 1.5 }}>{ex}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Check-in */}
            <div style={S.card}>
              <div style={S.h2}>Daily Check-in</div>

              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Energy</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {ENERGY_OPTS.map(e => (
                    <button key={e.v} onClick={() => setCurrentEntry(p => ({ ...p, energy: e.v }))} style={{
                      flex: 1, padding: '9px 2px', borderRadius: 8, fontSize: 20, cursor: 'pointer',
                      border: `1px solid ${currentEntry.energy === e.v ? phase.color : '#1E3028'}`,
                      background: currentEntry.energy === e.v ? phase.color + '28' : '#0F1A15',
                      transform: currentEntry.energy === e.v ? 'scale(1.1)' : 'scale(1)', transition: 'all 0.15s',
                    }}>{e.e}</button>
                  ))}
                </div>
                <div style={{ textAlign: 'center', fontSize: 11, color: phase.textLight, marginTop: 5 }}>
                  {ENERGY_OPTS.find(e => e.v === currentEntry.energy)?.l}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Mood</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['😔', '😐', '🙂', '😄', '🤩'].map((m, i) => (
                    <button key={i} onClick={() => setCurrentEntry(p => ({ ...p, mood: i }))} style={{
                      flex: 1, padding: '9px 2px', borderRadius: 8, fontSize: 20, cursor: 'pointer',
                      border: `1px solid ${currentEntry.mood === i ? phase.color : '#1E3028'}`,
                      background: currentEntry.mood === i ? phase.color + '28' : '#0F1A15',
                      transform: currentEntry.mood === i ? 'scale(1.1)' : 'scale(1)', transition: 'all 0.15s',
                    }}>{m}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                {[['steps', '👣 Steps', 'e.g. 10,432'], ['water', '💧 Water (L)', 'e.g. 2.5'], ['weight', '⚖️ Weight (lbs)', 'e.g. 112']].map(([k, l, ph]) => (
                  <div key={k}>
                    <label style={S.label}>{l}</label>
                    <input value={currentEntry[k] || ''} onChange={e => setCurrentEntry(p => ({ ...p, [k]: e.target.value }))} placeholder={ph} style={S.input} />
                  </div>
                ))}
              </div>

              <div>
                <label style={S.label}>Notes · PRs · Times · Records</label>
                <textarea value={currentEntry.notes || ''} onChange={e => setCurrentEntry(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Sprint times, PR weights, boxing rounds, how it felt…" style={S.textarea} />
              </div>
            </div>

            <button onClick={saveLog} className={syncStatus === 'saved' ? 'pop' : ''} style={{
              ...S.btn(syncStatus === 'saved' ? '#3A7D5A' : phase.color), transition: 'background 0.3s',
            }}>
              {syncStatus === 'syncing' ? 'Saving to cloud…' : syncStatus === 'saved' ? '✓ Saved to cloud' : syncStatus === 'error' ? 'Retry' : 'Save to Cloud'}
            </button>
          </div>
        )}

        {/* ════ THIS WEEK ════ */}
        {tab === 'week' && (
          <div className="fade">
            <div style={S.h1}>This Week</div>
            <div style={S.sub}>{phase.emoji} {phase.label} · C{cycleNum}-D{cycleDay} · {setsLabel()} sets today</div>

            {Array.from({ length: 7 }, (_, i) => {
              // Build 7-day window starting from Monday of the week containing viewDate
              const vd = new Date(viewDate + 'T12:00:00')
              const dow = vd.getDay()
              const mondayOffset = (dow === 0 ? -6 : 1 - dow)
              const d = new Date(vd)
              d.setDate(d.getDate() + mondayOffset + i)
              const ds = toDateStr(d)
              const { cycleDay: cd, cycleNum: cn } = resolveCyclePosition(cycleStarts, ds)
              const p = getPhase(cd)
              const w = getWorkoutForDate(ds, cd)
              const isView = ds === viewDate
              const isTod = ds === today
              const hasLog = !!logs[ds]
              const sl = (() => {
                const pk = p.key === 'luteal' ? (cd >= 21 ? 'lateLuteal' : 'earlyLuteal') : p.key
                return getSetsScheme(getMonthNum(ds))[pk] || 3
              })()
              const ic = INTENSITY_COLORS[w?.intensity || 'Rest'] || { bg: '#E8E8E8', text: '#666' }
              return (
                <div key={i} onClick={() => { setViewDate(ds); setTab('today') }} style={{
                  background: '#141F18', border: `1px solid ${isView ? p.color + '60' : '#1E3028'}`,
                  borderRadius: 12, padding: '14px 16px', marginBottom: 10,
                  borderLeft: `3px solid ${isView ? p.color : isTod ? '#3A7D5A' : 'transparent'}`,
                  cursor: 'pointer',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: isView ? p.textLight : '#4A6A55', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
                        {w?.slot.icon} {d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        {isTod && ' · TODAY'}{isView && !isTod && ' · VIEWING'}
                        {hasLog && ' ✓'}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#C8D8CC', marginBottom: 2 }}>{w?.title || '—'}</div>
                      <div style={{ fontSize: 11, color: p.textLight }}>C{cn}-D{cd} · {p.emoji} {p.label}{p.key !== 'menstrual' ? ` · ${sl} sets` : ''}</div>
                    </div>
                    <div style={{ background: ic.bg, color: ic.text, fontSize: 10, padding: '3px 8px', borderRadius: 8, fontWeight: 600, flexShrink: 0 }}>{w?.intensity}</div>
                  </div>
                </div>
              )
            })}
            <div style={{ ...S.card, fontSize: 12, color: '#4A6A55', lineHeight: 1.8 }}>
              Tap any day to view and log that session. The ✓ mark shows days already logged.
            </div>
          </div>
        )}

        {/* ════ HISTORY ════ */}
        {tab === 'history' && (
          <div className="fade">
            <div style={S.h1}>Training History</div>
            <div style={S.sub}>{logDates.length} days logged · all saved to cloud</div>

            {logDates.length === 0 && (
              <div style={{ ...S.card, textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                <div style={S.h2}>No logs yet</div>
                <div style={{ fontSize: 13, color: '#4A6A55' }}>Log your first session in the Today tab.</div>
              </div>
            )}

            {logDates.map(date => {
              const log = logs[date]
              const { cycleDay: cd, cycleNum: cn } = resolveCyclePosition(cycleStarts, date)
              const p = getPhase(cd)
              const w = getWorkoutForDate(date, cd)
              const exDone = w ? w.exercises.filter((_, i) => log.checks?.[i]).length : 0
              const isOpen = expandedLog === date
              return (
                <div key={date} className="log-row" onClick={() => setExpandedLog(isOpen ? null : date)} style={{
                  background: '#141F18', border: `1px solid ${isOpen ? p.color + '60' : '#1E3028'}`,
                  borderRadius: 12, marginBottom: 10, overflow: 'hidden', cursor: 'pointer',
                  borderLeft: `3px solid ${p.color}`,
                }}>
                  <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#C8D8CC', marginBottom: 2 }}>
                        {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>
                      <div style={{ fontSize: 11, color: '#4A6A55' }}>
                        C{cn}-D{cd} · Prog Day {programDay(date)} · {p.emoji} {p.label}
                        {w && exDone > 0 && ` · ${exDone}/${w.exercises.length} done`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {log.energy && <span style={{ fontSize: 15 }}>{ENERGY_OPTS.find(e => e.v === log.energy)?.e}</span>}
                      {log.mood !== undefined && <span style={{ fontSize: 15 }}>{MOOD_OPTS[log.mood]}</span>}
                      <span style={{ color: '#2A4035', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '0 16px 14px', borderTop: '1px solid #1A2A20' }}>
                      {w?.exercises && (
                        <div style={{ marginTop: 10, marginBottom: 10 }}>
                          {w.exercises.map((ex, i) => (
                            <div key={i} style={{ fontSize: 12, color: log.checks?.[i] ? '#5BAA7A' : '#2A4035', padding: '3px 0', display: 'flex', gap: 6 }}>
                              <span>{log.checks?.[i] ? '✓' : '○'}</span><span>{ex}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: '#6A8A72' }}>
                        {log.steps && <span>👣 {log.steps}</span>}
                        {log.water && <span>💧 {log.water}L</span>}
                        {log.weight && <span>⚖️ {log.weight} lbs</span>}
                      </div>
                      {log.notes && <div style={{ marginTop: 8, fontSize: 12, color: '#6A8A72', fontStyle: 'italic', lineHeight: 1.6 }}>"{log.notes}"</div>}
                      <button onClick={(e) => { e.stopPropagation(); setViewDate(date); setTab('today') }}
                        style={{ ...S.btn('#1E3028', '#6A8A72'), width: 'auto', padding: '6px 14px', fontSize: 11, marginTop: 10 }}>
                        View / Edit this day →
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ════ STATS ════ */}
        {tab === 'stats' && (
          <div className="fade">
            <div style={S.h1}>Progress</div>
            <div style={S.sub}>Program Day {daysInProgram} · C{cycleNum}-D{cycleDay} · {Math.round(daysInProgram / 7)} weeks in</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[
                { icon: '📅', label: 'Program Day',   value: daysInProgram },
                { icon: '🔄', label: 'Cycle',         value: `C${cycleNum} D${cycleDay}` },
                { icon: '🏋️', label: 'Sessions',      value: totalSessions },
                { icon: '⚡', label: 'Avg Energy',    value: avgEnergy + '/5' },
              ].map(({ icon, label, value }) => (
                <div key={label} style={{ ...S.card, textAlign: 'center', padding: 16 }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4A6A55', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontFamily: "'Georgia',serif", fontSize: 22, color: '#F0EBE3' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Cycle history */}
            <div style={{ ...S.card, marginBottom: 16 }}>
              <div style={S.h2}>Cycle History</div>
              {cycleStarts.map((cs, i) => {
                const isCurrentCycle = i === cycleStarts.length - 1
                const nextStart = cycleStarts[i + 1]
                const endDate = nextStart
                  ? new Date(new Date(nextStart + 'T12:00:00') - 86400000)
                  : null
                const length = nextStart ? daysBetween(cs, nextStart) : daysBetween(cs, today) + 1
                return (
                  <div key={cs} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < cycleStarts.length - 1 ? '1px solid #1A2A20' : 'none' }}>
                    <div>
                      <div style={{ fontSize: 13, color: '#C8D8CC', fontWeight: 500 }}>Cycle {i + 1}</div>
                      <div style={{ fontSize: 11, color: '#4A6A55' }}>
                        Started {new Date(cs + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {endDate && ` · Ended ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: isCurrentCycle ? phase.textLight : '#6A8A72', fontWeight: isCurrentCycle ? 600 : 400 }}>
                        {isCurrentCycle ? `Day ${cycleDay} of ${CYCLE_LENGTH}` : `${length} days`}
                      </div>
                      {isCurrentCycle && <div style={{ fontSize: 10, color: '#4A6A55' }}>current</div>}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Periodization */}
            <div style={{ ...S.card, marginBottom: 16 }}>
              <div style={S.h2}>Program Blocks</div>
              {PERIODIZATION.map(p => {
                const isCurrent = p.cycles.includes(cycleNum)
                return (
                  <div key={p.block} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #1A2A20' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: isCurrent ? p.color : '#2A4035', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: isCurrent ? '#F0EBE3' : '#6A8A72', fontWeight: isCurrent ? 600 : 400 }}>{p.block}</div>
                      <div style={{ fontSize: 11, color: '#4A6A55' }}>Cycles {p.cycles[0]}–{p.cycles[p.cycles.length - 1]} · {p.sub}</div>
                    </div>
                    {isCurrent && <div style={{ fontSize: 11, color: p.color, fontWeight: 600 }}>← Now</div>}
                  </div>
                )
              })}
            </div>

            {/* Energy by phase */}
            {logDates.length > 1 && (
              <div style={{ ...S.card, marginBottom: 16 }}>
                <div style={S.h2}>Energy by Phase</div>
                {Object.entries(PHASES).map(([key, p]) => {
                  const pl = logDates.map(d => logs[d]).filter(l => {
                    const { cycleDay: cd } = resolveCyclePosition(cycleStarts, l._date || '')
                    return getPhase(cd).key === key && l.energy
                  })
                  // simpler: use stored phase from logs
                  const pl2 = Object.values(logs).filter(l => l.energy)
                  // just use energy across all logs for now
                  if (!pl2.length) return null
                  const avg = pl2.reduce((s, l) => s + l.energy, 0) / pl2.length
                  return (
                    <div key={key} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                        <span style={{ color: '#8AAA90' }}>{p.emoji} {p.label}</span>
                        <span style={{ color: p.textLight, fontWeight: 500 }}>{avg.toFixed(1)}/5</span>
                      </div>
                      <div style={{ height: 6, background: '#1A2A20', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(avg / 5) * 100}%`, background: p.color, borderRadius: 3, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Weight trend */}
            {(() => {
              const wl = logDates.filter(d => logs[d].weight).map(d => ({ date: d, w: parseFloat(logs[d].weight) })).filter(x => !isNaN(x.w))
              if (wl.length < 2) return null
              const first = wl[wl.length - 1].w, last = wl[0].w
              const diff = (last - first).toFixed(1)
              return (
                <div style={{ ...S.card, marginBottom: 16 }}>
                  <div style={S.h2}>Weight Trend</div>
                  <div style={{ display: 'flex', gap: 24 }}>
                    <div><div style={S.label}>Start</div><div style={{ fontFamily: "'Georgia',serif", fontSize: 22, color: '#F0EBE3' }}>{first} lbs</div></div>
                    <div><div style={S.label}>Now</div><div style={{ fontFamily: "'Georgia',serif", fontSize: 22, color: '#F0EBE3' }}>{last} lbs</div></div>
                    <div><div style={S.label}>Change</div><div style={{ fontFamily: "'Georgia',serif", fontSize: 22, color: parseFloat(diff) < 0 ? '#5BAA7A' : '#C4724A' }}>{parseFloat(diff) > 0 ? '+' : ''}{diff} lbs</div></div>
                  </div>
                </div>
              )
            })()}

            {/* Milestones */}
            <div style={S.card}>
              <div style={S.h2}>Goal Milestones</div>
              <div style={{ fontSize: 12, color: '#4A6A55', marginBottom: 14 }}>
                {Object.values(milestones).filter(Boolean).length} of {MILESTONES.length} achieved
              </div>
              {MILESTONES.map((goal, i) => (
                <div key={i} onClick={() => toggleMilestone(i)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px',
                  borderBottom: i < MILESTONES.length - 1 ? '1px solid #1A2A20' : 'none', cursor: 'pointer',
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                    background: milestones[i] ? '#3A7D5A' : 'transparent',
                    border: `2px solid ${milestones[i] ? '#3A7D5A' : '#2A4035'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                  }}>
                    {milestones[i] && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
                  </div>
                  <div style={{ fontSize: 13, color: milestones[i] ? '#4A6A55' : '#C8D8CC', textDecoration: milestones[i] ? 'line-through' : 'none' }}>{goal}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
