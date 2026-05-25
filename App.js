import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import {
  PHASES, getPhase, getDOWforCycleDay, getWorkout, getSetsScheme,
  CYCLE_LENGTH, DAY_SLOTS, DOW_NAMES,
  ENERGY_OPTS, MOOD_OPTS, MILESTONES, INTENSITY_COLORS,
  getPeriodizationBlock, getMonthNum, ANCHOR_DATE, ANCHOR_CYCLE_DAY,
} from './data'

const FOREST      = '#0A1A10'
const FOREST_MED  = '#2D4A3E'
const FOREST_LIGHT= '#3D6356'
const CREAM       = '#F5F0E8'

// ── HELPERS ──────────────────────────────────────────────────────
const todayKey = () => new Date().toISOString().split('T')[0]

const getCycleDayForDate = (dateStr) => {
  const d = new Date(dateStr + 'T12:00:00')
  const anchor = new Date(ANCHOR_DATE)
  anchor.setHours(12,0,0,0)
  const diffDays = Math.round((d - anchor) / (1000*60*60*24))
  const cyclePos = ((diffDays % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH
  return cyclePos + ANCHOR_CYCLE_DAY > CYCLE_LENGTH
    ? cyclePos + ANCHOR_CYCLE_DAY - CYCLE_LENGTH
    : cyclePos + ANCHOR_CYCLE_DAY
}

const getCycleNum = (dateStr) => {
  const d = new Date(dateStr + 'T12:00:00')
  const anchor = new Date(ANCHOR_DATE)
  anchor.setHours(12,0,0,0)
  const diffDays = Math.round((d - anchor) / (1000*60*60*24))
  return Math.floor(diffDays / CYCLE_LENGTH) + 1
}

// ── STYLES ───────────────────────────────────────────────────────
const S = {
  app: { fontFamily:"'DM Sans', 'Arial', sans-serif", background:'#0F1A15', minHeight:'100vh', color:'#F0EBE3' },
  nav: { background:FOREST, borderBottom:'1px solid #1E3028', padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, position:'sticky', top:0, zIndex:100 },
  navBrand: { fontFamily:"'Georgia', serif", fontSize:22, fontWeight:300, letterSpacing:'0.3em', color:'#F0EBE3' },
  navBrandEm: { fontStyle:'italic' },
  navSub: { fontSize:11, color:'#4A6A55', letterSpacing:'0.1em', marginTop:1 },
  cycleStrip: { background:FOREST, padding:'10px 20px 12px', display:'flex', gap:3, overflowX:'auto' },
  tabs: { background:FOREST, borderBottom:'1px solid #1E3028', display:'flex', padding:'0 20px' },
  content: { padding:'20px', maxWidth:640, margin:'0 auto' },
  card: { background:'#141F18', border:'1px solid #1E3028', borderRadius:14, padding:18, marginBottom:16 },
  cardTitle: { fontFamily:"'Georgia', serif", fontSize:20, color:'#F0EBE3', marginBottom:8 },
  label: { fontSize:11, textTransform:'uppercase', letterSpacing:'0.1em', color:'#4A6A55', marginBottom:6 },
  input: { width:'100%', padding:'8px 10px', border:'1px solid #1E3028', borderRadius:8, fontSize:13, background:'#0F1A15', color:'#F0EBE3', outline:'none', boxSizing:'border-box' },
  textarea: { width:'100%', padding:10, border:'1px solid #1E3028', borderRadius:8, fontSize:13, background:'#0F1A15', color:'#F0EBE3', outline:'none', minHeight:72, resize:'vertical', boxSizing:'border-box' },
  btn: (color='#2D4A3E', text='#F0EBE3') => ({ background:color, color:text, border:'none', borderRadius:10, padding:'12px 20px', fontSize:14, fontWeight:500, cursor:'pointer', letterSpacing:'0.06em', width:'100%' }),
  tag: (bg, color) => ({ background:bg, color, fontSize:10, padding:'3px 10px', borderRadius:12, fontWeight:600, whiteSpace:'nowrap', border:`1px solid ${color}44` }),
}

// ── SYNC STATUS ───────────────────────────────────────────────────
function SyncBadge({ status }) {
  const map = { syncing:['#C08A20','Syncing…'], saved:['#3A7D5A','✓ Saved'], error:['#B85C38','Sync error'], idle:['#2D4A3E',''] }
  const [color, label] = map[status] || map.idle
  if (!label) return null
  return <span style={{ fontSize:11, color, marginLeft:8, transition:'all 0.3s' }}>{label}</span>
}

// ── MAIN APP ──────────────────────────────────────────────────────
export default function App() {
  const today = new Date()
  const todayStr = todayKey()
  const todayCycleDay = getCycleDayForDate(todayStr)

  const [cycleDay, setCycleDay]   = useState(todayCycleDay)
  const [tab, setTab]             = useState('today')
  const [logs, setLogs]           = useState({})
  const [milestones, setMilestones] = useState({})
  const [syncStatus, setSyncStatus] = useState('idle')
  const [loading, setLoading]     = useState(true)
  const [expandedLog, setExpandedLog] = useState(null)

  const blankEntry = { checks:{}, energy:3, mood:2, steps:'', water:'', weight:'', notes:'' }
  const [todayEntry, setTodayEntry] = useState(blankEntry)

  const phase = getPhase(cycleDay)
  const workout = getWorkout(cycleDay)
  const monthNum = getMonthNum()
  const sets = getSetsScheme(monthNum)
  const progBlock = getPeriodizationBlock(getCycleNum(todayStr))

  // Sets label for current phase
  const setsLabel = () => {
    const pk = phase.key === 'luteal'
      ? (cycleDay >= 21 ? 'lateLuteal' : 'earlyLuteal')
      : phase.key
    return sets[pk] || 3
  }

  // ── LOAD FROM SUPABASE ──────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [{ data: logData }, { data: mData }] = await Promise.all([
          supabase.from('peak_logs').select('*'),
          supabase.from('peak_milestones').select('*'),
        ])
        if (logData) {
          const mapped = {}
          logData.forEach(l => { mapped[l.date] = l })
          setLogs(mapped)
          if (mapped[todayStr]) {
            setTodayEntry({
              checks: mapped[todayStr].checks || {},
              energy: mapped[todayStr].energy || 3,
              mood:   mapped[todayStr].mood   ?? 2,
              steps:  mapped[todayStr].steps  || '',
              water:  mapped[todayStr].water  || '',
              weight: mapped[todayStr].weight || '',
              notes:  mapped[todayStr].notes  || '',
            })
          }
        }
        if (mData) {
          const mm = {}
          mData.forEach(m => { mm[m.id] = m.achieved })
          setMilestones(mm)
        }
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [])

  // ── SAVE LOG ────────────────────────────────────────────────────
  const saveLog = useCallback(async () => {
    setSyncStatus('syncing')
    const entry = {
      date: todayStr,
      cycle_day: cycleDay,
      phase: phase.key,
      dow: getDOWforCycleDay(cycleDay),
      checks: todayEntry.checks,
      energy: todayEntry.energy,
      mood: todayEntry.mood,
      steps: todayEntry.steps,
      water: todayEntry.water,
      weight: todayEntry.weight,
      notes: todayEntry.notes,
    }
    const { error } = await supabase.from('peak_logs').upsert(entry, { onConflict: 'date' })
    if (error) { setSyncStatus('error'); setTimeout(() => setSyncStatus('idle'), 3000) }
    else {
      setLogs(prev => ({ ...prev, [todayStr]: entry }))
      setSyncStatus('saved')
      setTimeout(() => setSyncStatus('idle'), 2500)
    }
  }, [todayEntry, cycleDay, phase.key, todayStr])

  // ── TOGGLE MILESTONE ────────────────────────────────────────────
  const toggleMilestone = async (idx) => {
    const newVal = !milestones[idx]
    setMilestones(prev => ({ ...prev, [idx]: newVal }))
    await supabase.from('peak_milestones').upsert(
      { id: idx, achieved: newVal, achieved_at: newVal ? new Date().toISOString() : null },
      { onConflict: 'id' }
    )
  }

  const toggleCheck = (i) => setTodayEntry(p => ({ ...p, checks: { ...p.checks, [i]: !p.checks[i] } }))
  const doneCount = workout ? workout.exercises.filter((_,i) => todayEntry.checks[i]).length : 0

  // Phase shift calc
  const nextShift = (() => {
    const curKey = phase.key
    for (let d = cycleDay + 1; d <= CYCLE_LENGTH; d++) {
      const p = getPhase(d)
      if (p.key !== curKey) {
        const daysAway = d - cycleDay
        return { day: d, phase: p, daysAway, dow: getDOWforCycleDay(d) }
      }
    }
    const daysAway = CYCLE_LENGTH - cycleDay + 1
    return { day: 1, phase: { key:'menstrual',...PHASES.menstrual }, daysAway, dow: getDOWforCycleDay(1), nextCycle: true }
  })()

  const lutealSplit = (phase.key === 'luteal' && cycleDay < 21)
    ? { daysAway: 21 - cycleDay, dow: getDOWforCycleDay(21) }
    : null

  const logDates = Object.keys(logs).sort().reverse()
  const totalSessions = Object.values(logs).filter(l => l.checks && Object.values(l.checks).some(Boolean)).length
  const avgEnergy = logDates.length
    ? (Object.values(logs).reduce((s,l) => s + (l.energy||0), 0) / logDates.length).toFixed(1)
    : '—'

  if (loading) return (
    <div style={{ ...S.app, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12 }}>
      <div style={{ fontFamily:"'Georgia',serif", fontSize:28, color:'#F0EBE3', letterSpacing:'0.3em' }}>PEAK</div>
      <div style={{ fontSize:13, color:'#4A6A55' }}>Loading your data…</div>
    </div>
  )

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:#2A3D33;border-radius:3px}
        input,textarea{font-family:'DM Sans','Arial',sans-serif}
        .ex-row:hover{background:rgba(255,255,255,0.04)!important;border-radius:6px}
        .day-cell:hover{opacity:0.8;cursor:pointer}
        .tab-btn:hover{color:#F0EBE3!important}
        .milestone-row:hover{background:rgba(255,255,255,0.03);border-radius:6px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fade-in{animation:fadeUp 0.3s ease both}
        @keyframes pop{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
        .pop{animation:pop 0.3s ease}
      `}</style>

      {/* ── HEADER ── */}
      <div style={S.nav}>
        <div>
          <div style={S.navBrand}>PEAK <span style={S.navBrandEm}>Tracker</span></div>
          <div style={S.navSub}>
            {DOW_NAMES[getDOWforCycleDay(cycleDay)]} · Day {cycleDay} · {phase.emoji} {phase.label}
            <SyncBadge status={syncStatus} />
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <div style={{ ...S.tag(phase.color+'22', phase.textLight), border:`1px solid ${phase.color}44`, padding:'5px 14px', borderRadius:20, fontSize:12 }}>
            {progBlock.block} · Month {monthNum}
          </div>
          <div style={{ fontSize:11, color:'#4A6A55', background:'#141F18', border:'1px solid #1E3028', borderRadius:8, padding:'5px 10px' }}>
            {sets.follicular} sets (fol) · {sets.ovulation} sets (ovu)
          </div>
        </div>
      </div>

      {/* ── CYCLE STRIP ── */}
      <div style={S.cycleStrip}>
        {Array.from({length:CYCLE_LENGTH},(_,i)=>i+1).map(d => {
          const p = getPhase(d)
          const isCurrent = d === cycleDay
          const hasLog = Object.values(logs).some(l => l.cycle_day === d && l.date >= todayStr.slice(0,7))
          return (
            <div key={d} className="day-cell" onClick={() => setCycleDay(d)} style={{
              flex:'1 0 24px', height:36, borderRadius:5, transition:'all 0.15s',
              background: isCurrent ? p.color : p.color+'28',
              border:`1px solid ${isCurrent ? p.color : 'transparent'}`,
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              transform: isCurrent ? 'scaleY(1.1)' : 'scale(1)',
            }}>
              <div style={{ fontSize:10, fontWeight:isCurrent?700:400, color:isCurrent?'#fff':p.textLight+'AA', lineHeight:1 }}>{d}</div>
              {hasLog && <div style={{ width:3, height:3, borderRadius:'50%', background:isCurrent?'rgba(255,255,255,0.8)':p.color, marginTop:2 }}/>}
            </div>
          )
        })}
      </div>

      {/* ── TABS ── */}
      <div style={S.tabs}>
        {[['today','Today'],['week','This Week'],['history','History'],['stats','Stats']].map(([id,label]) => (
          <button key={id} className="tab-btn" onClick={() => setTab(id)} style={{
            padding:'11px 14px', background:'none', border:'none',
            borderBottom: tab===id ? `2px solid ${phase.color}` : '2px solid transparent',
            color: tab===id ? phase.textLight : '#4A6A55',
            fontSize:12, letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:500, cursor:'pointer',
          }}>{label}</button>
        ))}
      </div>

      <div style={S.content}>

        {/* ════════════════ TODAY ════════════════ */}
        {tab==='today' && (
          <div className="fade-in">

            {/* Phase shift banner */}
            {(() => {
              const sp = nextShift.phase
              const urgColor = nextShift.daysAway <= 1 ? '#C08A20' : sp.color
              const label = nextShift.daysAway === 0 ? 'Now' : nextShift.daysAway === 1 ? 'Tomorrow' : `in ${nextShift.daysAway} days`
              return (
                <div>
                  <div style={{ background:'#141F18', border:`1px solid ${urgColor}44`, borderLeft:`3px solid ${urgColor}`, borderRadius:10, padding:'10px 14px', marginBottom:8, display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
                    <div>
                      <div style={{ fontSize:11, color:'#4A6A55', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:2 }}>Next phase shift</div>
                      <div style={{ fontSize:13, color:'#C8D8CC' }}>
                        <span style={{ color:urgColor, fontWeight:600 }}>{sp.emoji} {sp.label}</span>
                        {' begins '}<span style={{ color:'#8AAA90' }}>{label}</span>
                        {' · '}<span style={{ color:'#6A8A72' }}>{DOW_NAMES[nextShift.dow]}, Day {nextShift.day}{nextShift.nextCycle ? ' (new cycle)' : ''}</span>
                      </div>
                      <div style={{ fontSize:11, color:'#4A6A55', marginTop:2 }}>
                        {sp.key==='follicular' && 'Training ramps up — strength + sprints begin'}
                        {sp.key==='ovulation'  && 'Peak performance window — hardest sessions go here'}
                        {sp.key==='luteal'     && 'Sustain intensity early, taper toward end'}
                        {sp.key==='menstrual'  && 'Rest days begin — walks + Pilates only'}
                      </div>
                    </div>
                    <div style={{ background:urgColor+'22', border:`1px solid ${urgColor}44`, color:urgColor, borderRadius:20, padding:'4px 12px', fontSize:13, fontWeight:700 }}>
                      {nextShift.daysAway === 0 ? 'Now' : `${nextShift.daysAway}d`}
                    </div>
                  </div>
                  {lutealSplit && (
                    <div style={{ background:'#141F18', border:'1px solid #6A5AAA44', borderLeft:'3px solid #6A5AAA66', borderRadius:10, padding:'10px 14px', marginBottom:8, display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
                      <div>
                        <div style={{ fontSize:11, color:'#4A6A55', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:2 }}>Luteal intensity drop</div>
                        <div style={{ fontSize:13, color:'#C8D8CC' }}>
                          <span style={{ color:'#8A7ACC' }}>🌙 Late luteal</span>
                          {' begins in '}<span style={{ color:'#8AAA90' }}>{lutealSplit.daysAway} day{lutealSplit.daysAway!==1?'s':''}</span>
                          {' · '}<span style={{ color:'#6A8A72' }}>{DOW_NAMES[lutealSplit.dow]}, Day 21</span>
                        </div>
                        <div style={{ fontSize:11, color:'#4A6A55', marginTop:2 }}>Sessions dial down — Pilates, technique, easy runs</div>
                      </div>
                      <div style={{ background:'#6A5AAA22', border:'1px solid #6A5AAA44', color:'#8A7ACC', borderRadius:20, padding:'4px 12px', fontSize:13, fontWeight:700 }}>{lutealSplit.daysAway}d</div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Sets reminder */}
            {phase.key !== 'menstrual' && (
              <div style={{ background:phase.color+'18', border:`1px solid ${phase.color}33`, borderRadius:10, padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontSize:13, color:'#C8D8CC' }}>
                  <span style={{ color:phase.textLight, fontWeight:600 }}>Today's sets: {setsLabel()}</span>
                  {' '}<span style={{ color:'#6A8A72', fontSize:12 }}>— {phase.label} phase, Month {monthNum}</span>
                </div>
                <div style={{ fontSize:11, color:'#4A6A55' }}>{workout.intensity}</div>
              </div>
            )}

            {/* Workout card */}
            <div style={{ background:'#141F18', border:'1px solid #1E3028', borderRadius:14, overflow:'hidden', marginBottom:16 }}>
              <div style={{ background:phase.color+'18', borderBottom:'1px solid #1E3028', padding:'14px 18px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
                <div>
                  <div style={{ fontSize:11, color:'#4A6A55', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:4 }}>
                    {workout.slot.icon} {workout.slot.name} · {DOW_NAMES[workout.dow]}
                  </div>
                  <div style={{ fontFamily:"'Georgia',serif", fontSize:22, color:'#F0EBE3', lineHeight:1.1, marginBottom:4 }}>{workout.title}</div>
                  {workout.note && <div style={{ fontSize:12, color:'#6A8A72', lineHeight:1.6, maxWidth:420 }}>{workout.note}</div>}
                </div>
                <div style={{ flexShrink:0, textAlign:'right' }}>
                  <div style={{ ...S.tag((INTENSITY_COLORS[workout.intensity]||{bg:'#E8E8E8'}).bg, (INTENSITY_COLORS[workout.intensity]||{text:'#666'}).text), padding:'4px 10px', borderRadius:12, fontSize:11, display:'inline-block' }}>
                    {workout.intensity}
                  </div>
                  {workout.exercises.length > 0 && (
                    <div style={{ fontSize:12, color:'#4A6A55', marginTop:6 }}>{doneCount}/{workout.exercises.length}</div>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              {workout.exercises.length > 0 && (
                <div style={{ height:3, background:'#1E3028' }}>
                  <div style={{ height:'100%', width:`${(doneCount/workout.exercises.length)*100}%`, background:phase.color, transition:'width 0.4s ease', borderRadius:2 }}/>
                </div>
              )}

              {/* Exercises */}
              {workout.exercises.map((ex, i) => {
                // Inject sets into exercise text where "sets" appears
                const display = ex.replace('sets', `${setsLabel()} sets`)
                return (
                  <div key={i} className="ex-row" onClick={() => toggleCheck(i)} style={{
                    display:'flex', alignItems:'flex-start', gap:12, padding:'11px 18px',
                    borderBottom: i < workout.exercises.length-1 ? '1px solid #1A2A20' : 'none',
                    cursor:'pointer',
                  }}>
                    <div style={{
                      width:20, height:20, borderRadius:6, flexShrink:0, marginTop:1,
                      background: todayEntry.checks[i] ? phase.color : 'transparent',
                      border:`2px solid ${todayEntry.checks[i] ? phase.color : '#2A4035'}`,
                      display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s',
                    }}>
                      {todayEntry.checks[i] && <span style={{ color:'#fff', fontSize:11, fontWeight:700 }}>✓</span>}
                    </div>
                    <div style={{ fontSize:13, color: todayEntry.checks[i] ? '#4A6A55' : '#C8D8CC', textDecoration: todayEntry.checks[i] ? 'line-through' : 'none', lineHeight:1.5 }}>{display}</div>
                  </div>
                )
              })}
            </div>

            {/* Check-in */}
            <div style={S.card}>
              <div style={S.cardTitle}>Daily Check-in</div>

              <div style={{ marginBottom:16 }}>
                <div style={S.label}>Energy</div>
                <div style={{ display:'flex', gap:8 }}>
                  {ENERGY_OPTS.map(e => (
                    <button key={e.v} onClick={() => setTodayEntry(p=>({...p,energy:e.v}))} style={{
                      flex:1, padding:'9px 2px', borderRadius:8, border:`1px solid ${todayEntry.energy===e.v ? phase.color : '#1E3028'}`,
                      background: todayEntry.energy===e.v ? phase.color+'28' : '#0F1A15',
                      cursor:'pointer', fontSize:20, transform: todayEntry.energy===e.v ? 'scale(1.1)' : 'scale(1)', transition:'all 0.15s',
                    }}>{e.e}</button>
                  ))}
                </div>
                <div style={{ textAlign:'center', fontSize:11, color:phase.textLight, marginTop:5 }}>
                  {ENERGY_OPTS.find(e=>e.v===todayEntry.energy)?.l}
                </div>
              </div>

              <div style={{ marginBottom:16 }}>
                <div style={S.label}>Mood</div>
                <div style={{ display:'flex', gap:8 }}>
                  {MOOD_OPTS.map((m,i) => (
                    <button key={i} onClick={() => setTodayEntry(p=>({...p,mood:i}))} style={{
                      flex:1, padding:'9px 2px', borderRadius:8, border:`1px solid ${todayEntry.mood===i ? phase.color : '#1E3028'}`,
                      background: todayEntry.mood===i ? phase.color+'28' : '#0F1A15',
                      cursor:'pointer', fontSize:20, transform: todayEntry.mood===i ? 'scale(1.1)' : 'scale(1)', transition:'all 0.15s',
                    }}>{m}</button>
                  ))}
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:14 }}>
                {[['steps','👣 Steps','e.g. 10,432'],['water','💧 Water (L)','e.g. 2.5'],['weight','⚖️ Weight (lbs)','e.g. 112']].map(([k,l,ph]) => (
                  <div key={k}>
                    <div style={S.label}>{l}</div>
                    <input value={todayEntry[k]} onChange={e=>setTodayEntry(p=>({...p,[k]:e.target.value}))} placeholder={ph} style={S.input}/>
                  </div>
                ))}
              </div>

              <div>
                <div style={S.label}>Notes · PRs · Times</div>
                <textarea value={todayEntry.notes} onChange={e=>setTodayEntry(p=>({...p,notes:e.target.value}))} placeholder="Record sprint times, PR weights, how it felt, round counts..." style={S.textarea}/>
              </div>
            </div>

            <button onClick={saveLog} className={syncStatus==='saved'?'pop':''} style={{
              ...S.btn(syncStatus==='saved' ? '#3A7D5A' : phase.color),
              transition:'background 0.3s',
            }}>
              {syncStatus==='syncing' ? 'Saving…' : syncStatus==='saved' ? '✓ Saved to cloud' : syncStatus==='error' ? 'Retry Save' : 'Save to Cloud'}
            </button>
          </div>
        )}

        {/* ════════════════ THIS WEEK ════════════════ */}
        {tab==='week' && (
          <div className="fade-in">
            <div style={{ fontFamily:"'Georgia',serif", fontSize:26, color:'#F0EBE3', marginBottom:4 }}>This Week</div>
            <div style={{ fontSize:12, color:'#4A6A55', marginBottom:20 }}>{phase.emoji} {phase.label} · Day {cycleDay} · Sets: {setsLabel()} today</div>

            {Array.from({length:7},(_,i)=>i).map(dowOffset => {
              // Calculate what cycle day this DOW is, based on selected cycle day
              const selectedDOW = getDOWforCycleDay(cycleDay)
              const thisDOW = (selectedDOW + dowOffset) % 7
              const cdOffset = ((thisDOW - selectedDOW + 7) % 7)
              const thisCycleDay = Math.min(Math.max(cycleDay + cdOffset, 1), CYCLE_LENGTH)
              const w = getWorkout(thisCycleDay)
              const p = getPhase(thisCycleDay)
              const isSelected = thisDOW === selectedDOW
              const setsForDay = (() => {
                const pk = p.key === 'luteal' ? (thisCycleDay>=21?'lateLuteal':'earlyLuteal') : p.key
                return sets[pk] || 3
              })()
              const ic = INTENSITY_COLORS[w.intensity] || { bg:'#E8E8E8', text:'#666' }
              return (
                <div key={dowOffset} style={{
                  background:'#141F18', border:`1px solid ${isSelected ? p.color+'60' : '#1E3028'}`,
                  borderRadius:12, padding:'14px 16px', marginBottom:10,
                  borderLeft:`3px solid ${isSelected ? p.color : 'transparent'}`,
                }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, color: isSelected ? p.textLight : '#4A6A55', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:3 }}>
                        {w.slot.icon} {DOW_NAMES[thisDOW]} · Day {thisCycleDay} {isSelected && '← Selected'}
                      </div>
                      <div style={{ fontSize:15, fontWeight:500, color:'#C8D8CC', marginBottom: w.note ? 3 : 0 }}>{w.title}</div>
                      {w.note && <div style={{ fontSize:12, color:'#4A6A55', lineHeight:1.5 }}>{w.note}</div>}
                      {p.key !== 'menstrual' && (
                        <div style={{ fontSize:11, color:p.textLight, marginTop:4 }}>{setsForDay} sets · {p.emoji} {p.label}</div>
                      )}
                    </div>
                    <div style={{ background:ic.bg, color:ic.text, fontSize:10, padding:'3px 8px', borderRadius:10, fontWeight:600, flexShrink:0 }}>{w.intensity}</div>
                  </div>
                </div>
              )
            })}

            <div style={{ background:'#141F18', border:'1px solid #1E3028', borderRadius:12, padding:'14px 16px', marginTop:4 }}>
              <div style={{ fontSize:12, color:'#4A6A55', lineHeight:1.8 }}>
                <strong style={{ color:'#6A8A72' }}>How sets work:</strong> The number shown adjusts automatically based on your training month.
                {' '}Month {monthNum} sets: Follicular <strong style={{color:PHASES.follicular.textLight}}>{sets.follicular}</strong> ·
                Ovulation <strong style={{color:PHASES.ovulation.textLight}}>{sets.ovulation}</strong> ·
                Early Luteal <strong style={{color:PHASES.luteal.textLight}}>{sets.earlyLuteal}</strong> ·
                Late Luteal <strong style={{color:PHASES.luteal.textLight}}>{sets.lateLuteal}</strong>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ HISTORY ════════════════ */}
        {tab==='history' && (
          <div className="fade-in">
            <div style={{ fontFamily:"'Georgia',serif", fontSize:26, color:'#F0EBE3', marginBottom:4 }}>Training History</div>
            <div style={{ fontSize:12, color:'#4A6A55', marginBottom:20 }}>{logDates.length} days logged · synced to cloud</div>

            {logDates.length === 0 && (
              <div style={{ ...S.card, textAlign:'center', padding:40 }}>
                <div style={{ fontSize:36, marginBottom:12 }}>📋</div>
                <div style={{ fontFamily:"'Georgia',serif", fontSize:22, color:'#F0EBE3', marginBottom:6 }}>No logs yet</div>
                <div style={{ fontSize:13, color:'#4A6A55' }}>Log your first session in the Today tab.</div>
              </div>
            )}

            {logDates.map(date => {
              const log = logs[date]
              const p = getPhase(log.cycle_day || 1)
              const w = log.dow !== undefined ? getWorkout(log.cycle_day || 1) : null
              const exDone = w ? w.exercises.filter((_,i) => log.checks?.[i]).length : 0
              const isOpen = expandedLog === date
              return (
                <div key={date} onClick={() => setExpandedLog(isOpen ? null : date)} style={{
                  background:'#141F18', border:`1px solid ${isOpen ? p.color+'60' : '#1E3028'}`,
                  borderRadius:12, marginBottom:10, overflow:'hidden', cursor:'pointer',
                  borderLeft:`3px solid ${p.color}`,
                }}>
                  <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500, color:'#C8D8CC', marginBottom:2 }}>
                        {new Date(date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}
                      </div>
                      <div style={{ fontSize:11, color:'#4A6A55' }}>
                        {p.emoji} Day {log.cycle_day} · {w?.title || 'Rest'}
                        {w && exDone > 0 && ` · ${exDone}/${w.exercises.length} done`}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      {log.energy && <span style={{ fontSize:15 }}>{ENERGY_OPTS.find(e=>e.v===log.energy)?.e}</span>}
                      {log.mood !== undefined && <span style={{ fontSize:15 }}>{MOOD_OPTS[log.mood]}</span>}
                      <span style={{ color:'#2A4035', fontSize:12 }}>{isOpen?'▲':'▼'}</span>
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{ padding:'0 16px 14px', borderTop:'1px solid #1A2A20' }}>
                      {w?.exercises && (
                        <div style={{ marginTop:10, marginBottom:10 }}>
                          {w.exercises.map((ex,i) => (
                            <div key={i} style={{ fontSize:12, color: log.checks?.[i] ? '#5BAA7A' : '#2A4035', padding:'3px 0', display:'flex', gap:6 }}>
                              <span>{log.checks?.[i] ? '✓' : '○'}</span><span>{ex}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display:'flex', gap:14, flexWrap:'wrap', fontSize:12, color:'#6A8A72' }}>
                        {log.steps && <span>👣 {log.steps}</span>}
                        {log.water && <span>💧 {log.water}L</span>}
                        {log.weight && <span>⚖️ {log.weight} lbs</span>}
                      </div>
                      {log.notes && <div style={{ marginTop:8, fontSize:12, color:'#6A8A72', fontStyle:'italic', lineHeight:1.6 }}>"{log.notes}"</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ════════════════ STATS ════════════════ */}
        {tab==='stats' && (
          <div className="fade-in">
            <div style={{ fontFamily:"'Georgia',serif", fontSize:26, color:'#F0EBE3', marginBottom:20 }}>Progress</div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
              {[
                { icon:'🏋️', label:'Sessions',    value: totalSessions },
                { icon:'📅', label:'Days Logged',  value: logDates.length },
                { icon:'⚡', label:'Avg Energy',   value: avgEnergy+'/5' },
                { icon:'🔄', label:'Cycle Day',    value: `Day ${cycleDay}` },
              ].map(({icon,label,value}) => (
                <div key={label} style={{ ...S.card, textAlign:'center', padding:16 }}>
                  <div style={{ fontSize:24, marginBottom:6 }}>{icon}</div>
                  <div style={S.label}>{label}</div>
                  <div style={{ fontFamily:"'Georgia',serif", fontSize:24, color:'#F0EBE3' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Energy by phase */}
            {logDates.length > 1 && (
              <div style={{ ...S.card, marginBottom:16 }}>
                <div style={S.cardTitle}>Energy by Phase</div>
                {Object.entries(PHASES).map(([key,p]) => {
                  const pl = Object.values(logs).filter(l=>l.phase===key && l.energy)
                  if (!pl.length) return null
                  const avg = pl.reduce((s,l)=>s+l.energy,0)/pl.length
                  return (
                    <div key={key} style={{ marginBottom:12 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5 }}>
                        <span style={{ color:'#8AAA90' }}>{p.emoji} {p.label}</span>
                        <span style={{ color:p.textLight, fontWeight:500 }}>{avg.toFixed(1)}/5 · {pl.length} days</span>
                      </div>
                      <div style={{ height:6, background:'#1A2A20', borderRadius:3, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${(avg/5)*100}%`, background:p.color, borderRadius:3, transition:'width 0.6s ease' }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Weight trend */}
            {(() => {
              const wl = logDates.filter(d=>logs[d].weight).map(d=>({date:d,w:parseFloat(logs[d].weight)})).filter(x=>!isNaN(x.w))
              if (wl.length < 2) return null
              const first = wl[wl.length-1].w, last = wl[0].w
              const diff = (last-first).toFixed(1)
              return (
                <div style={{ ...S.card, marginBottom:16 }}>
                  <div style={S.cardTitle}>Weight Trend</div>
                  <div style={{ display:'flex', gap:24, fontSize:13 }}>
                    <div><div style={S.label}>Start</div><div style={{ fontFamily:"'Georgia',serif", fontSize:22, color:'#F0EBE3' }}>{first} lbs</div></div>
                    <div><div style={S.label}>Now</div><div style={{ fontFamily:"'Georgia',serif", fontSize:22, color:'#F0EBE3' }}>{last} lbs</div></div>
                    <div><div style={S.label}>Change</div><div style={{ fontFamily:"'Georgia',serif", fontSize:22, color: parseFloat(diff)<0?'#5BAA7A':'#C4724A' }}>{parseFloat(diff)>0?'+':''}{diff} lbs</div></div>
                  </div>
                </div>
              )
            })()}

            {/* Milestones */}
            <div style={S.card}>
              <div style={S.cardTitle}>Goal Milestones</div>
              <div style={{ fontSize:12, color:'#4A6A55', marginBottom:14 }}>
                {Object.values(milestones).filter(Boolean).length} of {MILESTONES.length} achieved
              </div>
              {MILESTONES.map((goal,i) => (
                <div key={i} className="milestone-row" onClick={() => toggleMilestone(i)} style={{
                  display:'flex', alignItems:'center', gap:10, padding:'9px 4px',
                  borderBottom: i<MILESTONES.length-1 ? '1px solid #1A2A20' : 'none', cursor:'pointer',
                }}>
                  <div style={{
                    width:20, height:20, borderRadius:6, flexShrink:0,
                    background: milestones[i] ? '#3A7D5A' : 'transparent',
                    border:`2px solid ${milestones[i] ? '#3A7D5A' : '#2A4035'}`,
                    display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s',
                  }}>
                    {milestones[i] && <span style={{ color:'#fff', fontSize:11, fontWeight:700 }}>✓</span>}
                  </div>
                  <div style={{ fontSize:13, color: milestones[i] ? '#4A6A55' : '#C8D8CC', textDecoration: milestones[i] ? 'line-through' : 'none' }}>{goal}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
