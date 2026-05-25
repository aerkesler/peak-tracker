import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import {
  PROGRAM_START, CYCLE_LENGTH, TOTAL_CYCLES,
  PHASES, DOW_NAMES,
  ENERGY_OPTS, MOOD_OPTS, MILESTONES, INTENSITY_COLORS,
  PERIODIZATION,
  getPhase, getPhaseKey, isLateLuteal,
  getSetsForCycle, getSetsLabel, getCycleProgression,
  getWorkoutForDate, injectSets, getPeriodizationBlock,
  resolveCyclePosition, programDay, daysBetween,
  toDateStr, addDays, dowFromDate,
} from './data'

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
const todayStr = () => toDateStr(new Date())

const BLANK = { checks:{}, energy:3, mood:2, steps:'', water:'', weight:'', notes:'' }

// ─────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────
const S = {
  app:     { fontFamily:"'DM Sans','Arial',sans-serif", background:'#0C1610', minHeight:'100vh', color:'#F0EBE3' },
  nav:     { background:'#081210', borderBottom:'1px solid #1A2E20', padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, position:'sticky', top:0, zIndex:100 },
  tabs:    { background:'#081210', borderBottom:'1px solid #1A2E20', display:'flex', overflowX:'auto' },
  pg:      { padding:'16px 20px', maxWidth:680, margin:'0 auto' },
  card:    { background:'#121C16', border:'1px solid #1A2E20', borderRadius:12, padding:16, marginBottom:14 },
  label:   { fontSize:10, textTransform:'uppercase', letterSpacing:'0.12em', color:'#3A6045', marginBottom:5, display:'block' },
  input:   { width:'100%', padding:'8px 10px', border:'1px solid #1A2E20', borderRadius:8, fontSize:13, background:'#0C1610', color:'#F0EBE3', outline:'none', boxSizing:'border-box' },
  textarea:{ width:'100%', padding:10, border:'1px solid #1A2E20', borderRadius:8, fontSize:13, background:'#0C1610', color:'#F0EBE3', outline:'none', minHeight:72, resize:'vertical', boxSizing:'border-box' },
  h1:      { fontFamily:"'Georgia',serif", fontSize:22, color:'#F0EBE3', marginBottom:4, fontWeight:400 },
  h2:      { fontFamily:"'Georgia',serif", fontSize:17, color:'#F0EBE3', marginBottom:10, fontWeight:400 },
  muted:   { fontSize:12, color:'#3A6045', marginBottom:14, lineHeight:1.6 },
  btn:     (bg,color='#F0EBE3') => ({ background:bg, color, border:'none', borderRadius:9, padding:'11px 18px', fontSize:13, fontWeight:500, cursor:'pointer', letterSpacing:'0.04em' }),
}

// ─────────────────────────────────────────────────────────────────
// SYNC BADGE
// ─────────────────────────────────────────────────────────────────
function SyncBadge({ s }) {
  if (s === 'syncing') return <span style={{fontSize:11,color:'#C08A20',marginLeft:8}}>Saving…</span>
  if (s === 'saved')   return <span style={{fontSize:11,color:'#3A7D5A',marginLeft:8}}>✓ Saved</span>
  if (s === 'error')   return <span style={{fontSize:11,color:'#B85C38',marginLeft:8}}>Error</span>
  return null
}

// ─────────────────────────────────────────────────────────────────
// NEW CYCLE MODAL
// ─────────────────────────────────────────────────────────────────
function NewCycleModal({ onConfirm, onCancel }) {
  const [date, setDate] = useState(todayStr())
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'#121C16',border:'1px solid #1A2E20',borderRadius:16,padding:28,maxWidth:360,width:'100%'}}>
        <div style={S.h1}>🌑 New Cycle Started</div>
        <p style={{fontSize:13,color:'#6A8A72',lineHeight:1.7,marginBottom:20}}>
          Enter the date your period actually began. This updates your cycle day count going forward. Use today or a past date if it started earlier.
        </p>
        <label style={S.label}>Period start date</label>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{...S.input,marginBottom:20}}/>
        <div style={{display:'flex',gap:10}}>
          <button onClick={onCancel} style={{...S.btn('#1A2E20','#6A8A72'),flex:1}}>Cancel</button>
          <button onClick={()=>onConfirm(date)} style={{...S.btn('#B85C38'),flex:2}}>Confirm New Cycle</button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// CYCLE DAY ROW — used in cycle view
// ─────────────────────────────────────────────────────────────────
function CycleDayRow({ dateStr, cycleDay, cycleNum, log, onClick, isToday }) {
  const phase = getPhase(cycleDay)
  const workout = getWorkoutForDate(dateStr, cycleDay)
  const sets = getSetsLabel(cycleNum, phase.key, cycleDay)
  const ic = INTENSITY_COLORS[workout?.intensity || 'Rest'] || INTENSITY_COLORS.Rest
  const hasLog = log && (log.checks && Object.values(log.checks).some(Boolean))
  const isPast = dateStr < todayStr()
  const isFuture = dateStr > todayStr()

  return (
    <div onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
      borderBottom:'1px solid #1A2E20', cursor:'pointer',
      background: isToday ? phase.color+'18' : 'transparent',
      opacity: isFuture ? 0.65 : 1,
    }}>
      {/* Day number + phase dot */}
      <div style={{width:36,flexShrink:0,textAlign:'center'}}>
        <div style={{
          width:28,height:28,borderRadius:'50%',margin:'0 auto',
          background: isToday ? phase.color : phase.color+'30',
          border:`2px solid ${isToday ? phase.color : 'transparent'}`,
          display:'flex',alignItems:'center',justifyContent:'center',
        }}>
          <span style={{fontSize:11,fontWeight:700,color: isToday ? '#fff' : phase.textLight}}>{cycleDay}</span>
        </div>
      </div>

      {/* Date + slot */}
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,color: isToday ? phase.textLight : '#6A8A72', marginBottom:1}}>
          {new Date(dateStr+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}
          {isToday && <span style={{marginLeft:6,fontWeight:700,color:phase.textLight}}>← Today</span>}
        </div>
        <div style={{fontSize:13,color:'#C8D8CC',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          {workout?.slot.icon} {workout?.title || 'Rest'}
        </div>
        <div style={{fontSize:11,color:'#3A6045',marginTop:1}}>
          {phase.emoji} {phase.label}{sets ? ` · ${sets} sets` : ''}
        </div>
      </div>

      {/* Intensity + log status */}
      <div style={{flexShrink:0,textAlign:'right'}}>
        <div style={{background:ic.bg,color:ic.text,fontSize:9,padding:'2px 7px',borderRadius:6,fontWeight:600,marginBottom:4}}>
          {workout?.intensity || 'Rest'}
        </div>
        {hasLog && <div style={{fontSize:11,color:'#3A7D5A'}}>✓ logged</div>}
        {!hasLog && isPast && <div style={{fontSize:11,color:'#2A4035'}}>—</div>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────
export default function App() {
  const today = todayStr()

  // ── STATE ────────────────────────────────────────────────────
  const [tab, setTab]                 = useState('today')    // 'today' | 'cycle-N' | 'stats'
  const [logs, setLogs]               = useState({})         // keyed by date string
  const [milestones, setMilestones]   = useState({})
  const [cycleStarts, setCycleStarts] = useState([PROGRAM_START])
  const [syncStatus, setSyncStatus]   = useState('idle')
  const [loading, setLoading]         = useState(true)
  const [showNewCycle, setShowNewCycle] = useState(false)
  const [viewDate, setViewDate]       = useState(today)      // for cycle view tap-through
  const [expandedHistory, setExpandedHistory] = useState(null)

  // ── DERIVED — always from today's actual date ────────────────
  const { cycleNum: todayCycleNum, cycleDay: todayCycleDay } = resolveCyclePosition(cycleStarts, today)
  const todayPhase   = getPhase(todayCycleDay)
  const todayWorkout = getWorkoutForDate(today, todayCycleDay)
  const todaySets    = getSetsLabel(todayCycleNum, todayPhase.key, todayCycleDay)
  const todayEntry   = logs[today] || BLANK
  const todayProgDay = programDay(today)
  const todayProgBlock = getPeriodizationBlock(todayCycleNum)
  const todaySetsScheme = getSetsForCycle(todayCycleNum)

  // Next phase shift from today
  const nextShift = (() => {
    const curKey = todayPhase.key
    for (let d = todayCycleDay + 1; d <= CYCLE_LENGTH; d++) {
      const p = getPhase(d)
      if (p.key !== curKey) {
        const da = d - todayCycleDay
        return { day:d, phase:p, daysAway:da, dow: new Date(addDays(today,da)+'T12:00:00').getDay(), nextCycle:false }
      }
    }
    const da = CYCLE_LENGTH - todayCycleDay + 1
    return { day:1, phase:{key:'menstrual',...PHASES.menstrual}, daysAway:da, dow: new Date(addDays(today,da)+'T12:00:00').getDay(), nextCycle:true }
  })()

  const lutealSplit = (todayPhase.key==='luteal' && todayCycleDay<21) ? (() => {
    const da = 21-todayCycleDay
    return { daysAway:da, dow: new Date(addDays(today,da)+'T12:00:00').getDay() }
  })() : null

  // ── LOAD ─────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [{ data: ld }, { data: md }, { data: csd }] = await Promise.all([
          supabase.from('peak_logs').select('*'),
          supabase.from('peak_milestones').select('*'),
          supabase.from('peak_cycle_starts').select('start_date').order('start_date',{ascending:true}),
        ])
        if (ld) {
          const m = {}
          ld.forEach(l => { m[l.date] = { checks:l.checks||{}, energy:l.energy||3, mood:l.mood??2, steps:l.steps||'', water:l.water||'', weight:l.weight||'', notes:l.notes||'' } })
          setLogs(m)
        }
        if (md) { const m={}; md.forEach(x=>{ m[x.id]=x.achieved }); setMilestones(m) }
        if (csd && csd.length>0) setCycleStarts(csd.map(r=>r.start_date))
      } catch(e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [])

  // ── SAVE today's log ─────────────────────────────────────────
  const saveToday = useCallback(async () => {
    setSyncStatus('syncing')
    const e = logs[today] || BLANK
    const { error } = await supabase.from('peak_logs').upsert({
      date:today, cycle_num:todayCycleNum, cycle_day:todayCycleDay,
      prog_day:todayProgDay, phase:todayPhase.key, dow:dowFromDate(today),
      checks:e.checks, energy:e.energy, mood:e.mood,
      steps:e.steps, water:e.water, weight:e.weight, notes:e.notes,
    },{ onConflict:'date' })
    if (error) { setSyncStatus('error'); setTimeout(()=>setSyncStatus('idle'),3000) }
    else { setSyncStatus('saved'); setTimeout(()=>setSyncStatus('idle'),2500) }
  }, [logs, today, todayCycleNum, todayCycleDay, todayProgDay, todayPhase.key])

  // ── UPDATE today's entry field ────────────────────────────────
  const updateToday = (fn) => setLogs(prev => ({ ...prev, [today]: fn(prev[today] || BLANK) }))
  const toggleCheck = (i) => updateToday(e => ({ ...e, checks:{ ...e.checks, [i]:!e.checks[i] } }))
  const doneCount = todayWorkout ? todayWorkout.exercises.filter((_,i)=>todayEntry.checks?.[i]).length : 0

  // ── NEW CYCLE ─────────────────────────────────────────────────
  const confirmNewCycle = async (dateStr) => {
    const ns = [...cycleStarts.filter(d=>d!==dateStr), dateStr].sort()
    setCycleStarts(ns)
    setShowNewCycle(false)
    await supabase.from('peak_cycle_starts').upsert({start_date:dateStr},{onConflict:'start_date'})
  }

  // ── MILESTONE ─────────────────────────────────────────────────
  const toggleMilestone = async (idx) => {
    const v = !milestones[idx]
    setMilestones(p=>({...p,[idx]:v}))
    await supabase.from('peak_milestones').upsert({id:idx,achieved:v,achieved_at:v?new Date().toISOString():null},{onConflict:'id'})
  }

  // ── BUILD CYCLE TABS ─────────────────────────────────────────
  // How many cycles have started or are projected in the program
  const activeCycles = Math.max(todayCycleNum, 1)
  const cycleTabIds  = Array.from({length: Math.min(activeCycles + 2, TOTAL_CYCLES)}, (_,i)=>`cycle-${i+1}`)

  // Build 27 days for a given cycle number
  const buildCycleDays = (cn) => {
    const start = cn <= cycleStarts.length ? cycleStarts[cn-1] : addDays(cycleStarts[cycleStarts.length-1], (cn - cycleStarts.length) * CYCLE_LENGTH)
    return Array.from({length:CYCLE_LENGTH}, (_,i) => {
      const ds = addDays(start, i)
      return { dateStr:ds, cycleDay:i+1 }
    })
  }

  // Parse current cycle from tab id
  const currentTabCycle = tab.startsWith('cycle-') ? parseInt(tab.replace('cycle-','')) : null

  const daysInProgram = daysBetween(PROGRAM_START, today) + 1

  if (loading) return (
    <div style={{...S.app,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12}}>
      <div style={{fontFamily:"'Georgia',serif",fontSize:28,letterSpacing:'0.3em',color:'#F0EBE3'}}>PEAK</div>
      <div style={{fontSize:13,color:'#3A6045'}}>Loading your program…</div>
    </div>
  )

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:#1A3020;border-radius:3px}
        input,textarea{font-family:'DM Sans','Arial',sans-serif}
        .row-hover:hover{background:#1A2E2088!important}
        .tab-b:hover{color:#C8D8CC!important}
        @keyframes fu{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fu 0.22s ease both}
        input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(0.4)}
      `}</style>

      {showNewCycle && <NewCycleModal onConfirm={confirmNewCycle} onCancel={()=>setShowNewCycle(false)}/>}

      {/* ── NAV ── */}
      <div style={S.nav}>
        <div>
          <div style={{fontFamily:"'Georgia',serif",fontSize:19,fontWeight:300,letterSpacing:'0.3em',color:'#F0EBE3'}}>
            PEAK <span style={{fontStyle:'italic',color:todayPhase.textLight}}>Tracker</span>
          </div>
          <div style={{fontSize:11,color:'#3A6045',marginTop:1}}>
            Day {todayProgDay} · C{todayCycleNum}-D{todayCycleDay} · {todayPhase.emoji} {todayPhase.label}
            <SyncBadge s={syncStatus}/>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <div style={{background:todayPhase.color+'22',border:`1px solid ${todayPhase.color}44`,color:todayPhase.textLight,borderRadius:16,padding:'4px 12px',fontSize:11,fontWeight:500}}>
            {todayProgBlock.block}
          </div>
          <button onClick={()=>setShowNewCycle(true)}
            style={{background:'#2A100A',border:'1px solid #B85C3866',color:'#E8956D',borderRadius:16,padding:'4px 12px',fontSize:11,cursor:'pointer',fontWeight:500}}>
            🌑 New Cycle
          </button>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={S.tabs}>
        {/* Today */}
        <button className="tab-b" onClick={()=>setTab('today')} style={{
          padding:'10px 16px',background:'none',border:'none',
          borderBottom:`2px solid ${tab==='today' ? todayPhase.color : 'transparent'}`,
          color: tab==='today' ? todayPhase.textLight : '#3A6045',
          fontSize:12,letterSpacing:'0.1em',textTransform:'uppercase',fontWeight:500,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,
        }}>Today</button>

        {/* Cycle tabs */}
        {cycleTabIds.map(id => {
          const cn = parseInt(id.replace('cycle-',''))
          const isActive = tab === id
          const isCurrent = cn === todayCycleNum
          const pb = getPeriodizationBlock(cn)
          return (
            <button key={id} className="tab-b" onClick={()=>setTab(id)} style={{
              padding:'10px 14px',background:'none',border:'none',
              borderBottom:`2px solid ${isActive ? pb.color : 'transparent'}`,
              color: isActive ? pb.color : isCurrent ? '#6A8A72' : '#3A6045',
              fontSize:12,letterSpacing:'0.08em',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,fontWeight:isActive||isCurrent?600:400,
            }}>
              C{cn}{isCurrent ? ' ←' : ''}
            </button>
          )
        })}

        {/* Stats */}
        <button className="tab-b" onClick={()=>setTab('stats')} style={{
          padding:'10px 16px',background:'none',border:'none',
          borderBottom:`2px solid ${tab==='stats' ? '#6A8A72' : 'transparent'}`,
          color: tab==='stats' ? '#C8D8CC' : '#3A6045',
          fontSize:12,letterSpacing:'0.1em',textTransform:'uppercase',fontWeight:500,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,
        }}>Stats</button>
      </div>

      <div style={S.pg}>

        {/* ════════════════════════════════════════════════
            TODAY TAB
        ════════════════════════════════════════════════ */}
        {tab === 'today' && (
          <div className="fu">
            {/* Header */}
            <div style={{...S.card, borderLeft:`3px solid ${todayPhase.color}`, marginBottom:14}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
                <div>
                  <div style={{fontSize:11,color:'#3A6045',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:3}}>
                    {new Date(today+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}
                  </div>
                  <div style={{fontFamily:"'Georgia',serif",fontSize:20,color:'#F0EBE3',marginBottom:2}}>
                    C{todayCycleNum}-D{todayCycleDay} · Program Day {todayProgDay}
                  </div>
                  <div style={{fontSize:12,color:todayPhase.textLight}}>
                    {todayPhase.emoji} {todayPhase.label} · {todayProgBlock.block} · Month {Math.ceil(daysInProgram/30.44)}
                  </div>
                </div>
                {todaySets && (
                  <div style={{background:todayPhase.color+'22',border:`1px solid ${todayPhase.color}44`,borderRadius:10,padding:'8px 14px',textAlign:'center',flexShrink:0}}>
                    <div style={{fontSize:10,color:'#3A6045',textTransform:'uppercase',letterSpacing:'0.1em'}}>Sets</div>
                    <div style={{fontFamily:"'Georgia',serif",fontSize:22,color:todayPhase.textLight,lineHeight:1}}>{todaySets}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Phase shift banner */}
            {(() => {
              const sp = nextShift.phase
              const urg = nextShift.daysAway <= 1 ? '#C08A20' : sp.color
              const lbl = nextShift.daysAway===0?'Today':nextShift.daysAway===1?'Tomorrow':`in ${nextShift.daysAway} days`
              return (
                <div style={{marginBottom:12}}>
                  <div style={{background:'#121C16',border:`1px solid ${urg}33`,borderLeft:`3px solid ${urg}`,borderRadius:10,padding:'10px 14px',marginBottom:6,display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                    <div>
                      <div style={{fontSize:10,color:'#3A6045',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:2}}>Next phase shift</div>
                      <div style={{fontSize:13,color:'#C8D8CC'}}>
                        <span style={{color:urg,fontWeight:600}}>{sp.emoji} {sp.label}</span>
                        {' begins '}<span style={{color:'#6A8A72'}}>{lbl}</span>
                        {nextShift.nextCycle && <span style={{color:'#3A6045'}}> · new cycle</span>}
                      </div>
                    </div>
                    <div style={{background:urg+'22',color:urg,borderRadius:16,padding:'3px 10px',fontSize:12,fontWeight:700,flexShrink:0}}>
                      {nextShift.daysAway===0?'Now':`${nextShift.daysAway}d`}
                    </div>
                  </div>
                  {lutealSplit && (
                    <div style={{background:'#121C16',border:'1px solid #6A5AAA33',borderLeft:'3px solid #6A5AAA66',borderRadius:10,padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                      <div>
                        <div style={{fontSize:10,color:'#3A6045',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:2}}>Luteal intensity drop</div>
                        <div style={{fontSize:13,color:'#C8D8CC'}}>
                          <span style={{color:'#8A7ACC'}}>🌙 Late luteal</span>
                          {' in '}<span style={{color:'#6A8A72'}}>{lutealSplit.daysAway} day{lutealSplit.daysAway!==1?'s':''}</span>
                          <span style={{color:'#3A6045'}}> · {DOW_NAMES[lutealSplit.dow]}, Day 21</span>
                        </div>
                      </div>
                      <div style={{background:'#6A5AAA22',color:'#8A7ACC',borderRadius:16,padding:'3px 10px',fontSize:12,fontWeight:700,flexShrink:0}}>{lutealSplit.daysAway}d</div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Workout card */}
            {todayWorkout && (
              <div style={{...S.card,padding:0,overflow:'hidden',marginBottom:14}}>
                <div style={{background:todayPhase.color+'18',padding:'14px 16px',borderBottom:'1px solid #1A2E20'}}>
                  <div style={{fontSize:10,color:'#3A6045',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:3}}>
                    {todayWorkout.slot.icon} {todayWorkout.slot.name} · {DOW_NAMES[todayWorkout.dow]}
                  </div>
                  <div style={{fontFamily:"'Georgia',serif",fontSize:20,color:'#F0EBE3',marginBottom:3}}>{todayWorkout.title}</div>
                  {todayWorkout.note && <div style={{fontSize:12,color:'#6A8A72',lineHeight:1.6}}>{todayWorkout.note}</div>}
                  <div style={{fontSize:11,color:'#3A6045',marginTop:5}}>{doneCount}/{todayWorkout.exercises.length} completed</div>
                </div>
                <div style={{height:3,background:'#1A2E20'}}>
                  <div style={{height:'100%',width:`${todayWorkout.exercises.length?(doneCount/todayWorkout.exercises.length)*100:0}%`,background:todayPhase.color,transition:'width 0.4s ease'}}/>
                </div>
                {injectSets(todayWorkout.exercises, todaySets||'—').map((ex,i) => (
                  <div key={i} className="row-hover" onClick={()=>toggleCheck(i)} style={{
                    display:'flex',alignItems:'flex-start',gap:12,padding:'11px 16px',
                    borderBottom:i<todayWorkout.exercises.length-1?'1px solid #111E15':'none',cursor:'pointer',
                  }}>
                    <div style={{
                      width:20,height:20,borderRadius:5,flexShrink:0,marginTop:1,transition:'all 0.15s',
                      background:todayEntry.checks?.[i]?todayPhase.color:'transparent',
                      border:`2px solid ${todayEntry.checks?.[i]?todayPhase.color:'#1E3020'}`,
                      display:'flex',alignItems:'center',justifyContent:'center',
                    }}>
                      {todayEntry.checks?.[i] && <span style={{color:'#fff',fontSize:10,fontWeight:700}}>✓</span>}
                    </div>
                    <div style={{fontSize:13,color:todayEntry.checks?.[i]?'#3A6045':'#C8D8CC',textDecoration:todayEntry.checks?.[i]?'line-through':'none',lineHeight:1.5}}>{ex}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Check-in */}
            <div style={S.card}>
              <div style={S.h2}>Daily Check-in</div>

              <label style={S.label}>Energy</label>
              <div style={{display:'flex',gap:8,marginBottom:4}}>
                {ENERGY_OPTS.map(e=>(
                  <button key={e.v} onClick={()=>updateToday(p=>({...p,energy:e.v}))} style={{
                    flex:1,padding:'8px 2px',borderRadius:8,fontSize:20,cursor:'pointer',
                    border:`1px solid ${todayEntry.energy===e.v?todayPhase.color:'#1A2E20'}`,
                    background:todayEntry.energy===e.v?todayPhase.color+'28':'#0C1610',
                    transform:todayEntry.energy===e.v?'scale(1.1)':'scale(1)',transition:'all 0.15s',
                  }}>{e.e}</button>
                ))}
              </div>
              <div style={{textAlign:'center',fontSize:11,color:todayPhase.textLight,marginBottom:16}}>
                {ENERGY_OPTS.find(e=>e.v===todayEntry.energy)?.l}
              </div>

              <label style={S.label}>Mood</label>
              <div style={{display:'flex',gap:8,marginBottom:16}}>
                {MOOD_OPTS.map((m,i)=>(
                  <button key={i} onClick={()=>updateToday(p=>({...p,mood:i}))} style={{
                    flex:1,padding:'8px 2px',borderRadius:8,fontSize:20,cursor:'pointer',
                    border:`1px solid ${todayEntry.mood===i?todayPhase.color:'#1A2E20'}`,
                    background:todayEntry.mood===i?todayPhase.color+'28':'#0C1610',
                    transform:todayEntry.mood===i?'scale(1.1)':'scale(1)',transition:'all 0.15s',
                  }}>{m}</button>
                ))}
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:14}}>
                {[['steps','👣 Steps','10,432'],['water','💧 Water L','2.5'],['weight','⚖️ lbs','112']].map(([k,l,ph])=>(
                  <div key={k}>
                    <label style={S.label}>{l}</label>
                    <input value={todayEntry[k]||''} onChange={e=>updateToday(p=>({...p,[k]:e.target.value}))} placeholder={ph} style={S.input}/>
                  </div>
                ))}
              </div>

              <label style={S.label}>Notes · PRs · Times</label>
              <textarea value={todayEntry.notes||''} onChange={e=>updateToday(p=>({...p,notes:e.target.value}))}
                placeholder="Sprint times · PR weights · boxing rounds · how it felt…" style={S.textarea}/>
            </div>

            <button onClick={saveToday} style={{
              ...S.btn(syncStatus==='saved'?'#2A6040':todayPhase.color),
              width:'100%',transition:'background 0.3s',
            }}>
              {syncStatus==='syncing'?'Saving…':syncStatus==='saved'?'✓ Saved to cloud':'Save to Cloud'}
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            CYCLE TAB — shows all 27 days
        ════════════════════════════════════════════════ */}
        {currentTabCycle && (
          <div className="fu">
            {(() => {
              const cn = currentTabCycle
              const pb = getPeriodizationBlock(cn)
              const setsScheme = getSetsForCycle(cn)
              const prog = getCycleProgression(cn)
              const days = buildCycleDays(cn)
              const cycleStart = days[0].dateStr
              const cycleEnd   = days[days.length-1].dateStr
              const isCurrent  = cn === todayCycleNum
              const isPast     = cn < todayCycleNum
              const isFuture   = cn > todayCycleNum

              return (
                <>
                  {/* Cycle header */}
                  <div style={{...S.card,borderLeft:`3px solid ${pb.color}`,marginBottom:14}}>
                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10,marginBottom:10}}>
                      <div>
                        <div style={{fontSize:10,color:'#3A6045',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:4}}>
                          {pb.block} · {pb.sub}
                          {isCurrent && <span style={{marginLeft:8,color:pb.color,fontWeight:700}}>← Current</span>}
                          {isPast && <span style={{marginLeft:8,color:'#3A6045'}}>Completed</span>}
                          {isFuture && <span style={{marginLeft:8,color:'#3A6045'}}>Upcoming</span>}
                        </div>
                        <div style={{fontFamily:"'Georgia',serif",fontSize:22,color:'#F0EBE3',marginBottom:2}}>Cycle {cn}</div>
                        <div style={{fontSize:12,color:'#6A8A72'}}>
                          {new Date(cycleStart+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                          {' – '}
                          {new Date(cycleEnd+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                        </div>
                      </div>
                      <div style={{flexShrink:0,textAlign:'right'}}>
                        <div style={{fontSize:10,color:'#3A6045',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4}}>Sets this cycle</div>
                        <div style={{fontSize:12,color:'#C8D8CC',lineHeight:1.8}}>
                          <span style={{color:PHASES.follicular.textLight}}>🌿 {setsScheme.follicular}</span><br/>
                          <span style={{color:PHASES.ovulation.textLight}}>☀️ {setsScheme.ovulation}</span><br/>
                          <span style={{color:PHASES.luteal.textLight}}>🌙 {setsScheme.earlyLuteal}/{setsScheme.lateLuteal}</span>
                        </div>
                      </div>
                    </div>

                    {/* Progression targets */}
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                      {[
                        {icon:'⚡',label:'Sprint',val:prog.sprint},
                        {icon:'🎒',label:'Ruck',val:prog.ruck},
                        {icon:'🏃',label:'Run',val:prog.run},
                        {icon:'🥊',label:'Boxing',val:prog.boxing},
                      ].map(({icon,label,val})=>(
                        <div key={label} style={{background:'#0C1610',border:'1px solid #1A2E20',borderRadius:8,padding:'8px 10px'}}>
                          <div style={{fontSize:10,color:'#3A6045',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:2}}>{icon} {label}</div>
                          <div style={{fontSize:12,color:'#C8D8CC'}}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 27-day list */}
                  <div style={{...S.card,padding:0,overflow:'hidden'}}>
                    {days.map(({dateStr,cycleDay}) => (
                      <CycleDayRow
                        key={dateStr}
                        dateStr={dateStr}
                        cycleDay={cycleDay}
                        cycleNum={cn}
                        log={logs[dateStr]}
                        isToday={dateStr===today}
                        onClick={()=>{ setViewDate(dateStr); setTab('today') }}
                      />
                    ))}
                  </div>
                  <div style={{...S.muted,textAlign:'center',marginTop:10}}>Tap any day to view or log that session in the Today tab.</div>
                </>
              )
            })()}
          </div>
        )}

        {/* ════════════════════════════════════════════════
            STATS TAB
        ════════════════════════════════════════════════ */}
        {tab === 'stats' && (
          <div className="fu">
            <div style={S.h1}>Progress</div>
            <div style={S.muted}>Program Day {daysInProgram} · C{todayCycleNum}-D{todayCycleDay} · {Math.round(daysInProgram/7)} weeks in</div>

            {/* Summary grid */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
              {[
                {icon:'📅',label:'Program Day',value:daysInProgram},
                {icon:'🔄',label:'Position',value:`C${todayCycleNum}-D${todayCycleDay}`},
                {icon:'🏋️',label:'Sessions',value:Object.values(logs).filter(l=>l.checks&&Object.values(l.checks).some(Boolean)).length},
                {icon:'⚡',label:'Avg Energy',value: Object.values(logs).length ? (Object.values(logs).reduce((s,l)=>s+(l.energy||0),0)/Object.values(logs).length).toFixed(1)+'/5' : '—'},
              ].map(({icon,label,value})=>(
                <div key={label} style={{...S.card,textAlign:'center',padding:14}}>
                  <div style={{fontSize:22,marginBottom:5}}>{icon}</div>
                  <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'0.1em',color:'#3A6045',marginBottom:3}}>{label}</div>
                  <div style={{fontFamily:"'Georgia',serif",fontSize:20,color:'#F0EBE3'}}>{value}</div>
                </div>
              ))}
            </div>

            {/* Cycle history */}
            <div style={{...S.card,marginBottom:14}}>
              <div style={S.h2}>Cycle History</div>
              {cycleStarts.map((cs,i)=>{
                const cn = i+1
                const isCur = cn === todayCycleNum
                const nextCs = cycleStarts[i+1]
                const len = nextCs ? daysBetween(cs,nextCs) : daysBetween(cs,today)+1
                return (
                  <div key={cs} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:i<cycleStarts.length-1?'1px solid #1A2E20':'none'}}>
                    <div>
                      <div style={{fontSize:13,color:'#C8D8CC',fontWeight:isCur?600:400}}>Cycle {cn}</div>
                      <div style={{fontSize:11,color:'#3A6045'}}>
                        Started {new Date(cs+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                      </div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:12,color:isCur?todayPhase.textLight:'#6A8A72',fontWeight:isCur?600:400}}>
                        {isCur ? `Day ${todayCycleDay} / ${CYCLE_LENGTH}` : `${len} days`}
                      </div>
                      <div style={{fontSize:10,color:isCur?todayPhase.color:'#2A4030'}}>{isCur?'active':nextCs?'complete':'—'}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Periodization */}
            <div style={{...S.card,marginBottom:14}}>
              <div style={S.h2}>Program Blocks</div>
              {PERIODIZATION.map(p=>{
                const isCur = p.cycles.includes(todayCycleNum)
                return (
                  <div key={p.block} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid #1A2E20'}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:isCur?p.color:'#1A2E20',flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,color:isCur?'#F0EBE3':'#6A8A72',fontWeight:isCur?600:400}}>{p.block}</div>
                      <div style={{fontSize:11,color:'#3A6045'}}>Cycles {p.cycles[0]}–{p.cycles[p.cycles.length-1]} · {p.sub}</div>
                    </div>
                    {isCur && <div style={{fontSize:11,color:p.color,fontWeight:600}}>Now</div>}
                  </div>
                )
              })}
            </div>

            {/* Weight trend */}
            {(()=>{
              const wl = Object.entries(logs).filter(([,l])=>l.weight).map(([d,l])=>({date:d,w:parseFloat(l.weight)})).filter(x=>!isNaN(x.w)).sort((a,b)=>a.date.localeCompare(b.date))
              if (wl.length<2) return null
              const first=wl[0].w, last=wl[wl.length-1].w, diff=(last-first).toFixed(1)
              return (
                <div style={{...S.card,marginBottom:14}}>
                  <div style={S.h2}>Weight Trend</div>
                  <div style={{display:'flex',gap:24}}>
                    <div><label style={S.label}>Start</label><div style={{fontFamily:"'Georgia',serif",fontSize:20,color:'#F0EBE3'}}>{first} lbs</div></div>
                    <div><label style={S.label}>Now</label><div style={{fontFamily:"'Georgia',serif",fontSize:20,color:'#F0EBE3'}}>{last} lbs</div></div>
                    <div><label style={S.label}>Change</label><div style={{fontFamily:"'Georgia',serif",fontSize:20,color:parseFloat(diff)<0?'#5BAA7A':'#C4724A'}}>{parseFloat(diff)>0?'+':''}{diff}</div></div>
                  </div>
                </div>
              )
            })()}

            {/* Milestones */}
            <div style={S.card}>
              <div style={S.h2}>Goal Milestones</div>
              <div style={{fontSize:11,color:'#3A6045',marginBottom:12}}>
                {Object.values(milestones).filter(Boolean).length} of {MILESTONES.length} achieved
              </div>
              {MILESTONES.map((goal,i)=>(
                <div key={i} onClick={()=>toggleMilestone(i)} style={{
                  display:'flex',alignItems:'center',gap:10,padding:'9px 4px',
                  borderBottom:i<MILESTONES.length-1?'1px solid #1A2E20':'none',cursor:'pointer',
                }}>
                  <div style={{
                    width:20,height:20,borderRadius:5,flexShrink:0,
                    background:milestones[i]?'#3A7D5A':'transparent',
                    border:`2px solid ${milestones[i]?'#3A7D5A':'#1E3020'}`,
                    display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s',
                  }}>
                    {milestones[i]&&<span style={{color:'#fff',fontSize:10,fontWeight:700}}>✓</span>}
                  </div>
                  <div style={{fontSize:13,color:milestones[i]?'#3A6045':'#C8D8CC',textDecoration:milestones[i]?'line-through':'none'}}>{goal}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
