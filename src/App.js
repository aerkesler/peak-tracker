import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import {
  PROGRAM_START, CYCLE_LENGTH, TOTAL_CYCLES,
  PHASES, DOW_NAMES, DOW_SHORT,
  ENERGY_OPTS, MOOD_OPTS, MILESTONES, INTENSITY_COLORS,
  PERIODIZATION,
  getPhase, getPhaseKey, isLateLuteal,
  getSetsForCycle, getSetsLabel, getCycleProgression,
  getWorkoutForDate, injectSets, getPeriodizationBlock,
  resolveCyclePosition, programDay, daysBetween,
  toDateStr, addDays, dowFromDate,
} from './data'

// ─────────────────────────────────────────────────────────────────
// CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────────
const todayStr  = () => toDateStr(new Date())
const BLANK     = { checks:{}, energy:3, mood:2, steps:'', water:'', weight:'', notes:'' }

// Build all 27 date strings for a given cycle number
// Uses cycleStarts array if available, otherwise calculates from anchor
const buildCycleDays = (cn, cycleStarts) => {
  let start
  if (cn <= cycleStarts.length) {
    start = cycleStarts[cn - 1]
  } else {
    // Project future cycles from last known start
    const last = cycleStarts[cycleStarts.length - 1]
    start = addDays(last, (cn - cycleStarts.length) * CYCLE_LENGTH)
  }
  return Array.from({ length: CYCLE_LENGTH }, (_, i) => ({
    dateStr:  addDays(start, i),
    cycleDay: i + 1,
  }))
}

// ─────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────
const forest   = '#0A1410'
const forestMd = '#141F18'
const border1  = '#1E3028'

const S = {
  app:      { fontFamily:"'DM Sans','Arial',sans-serif", background:'#0C1610', minHeight:'100vh', color:'#F0EBE3' },
  nav:      { background:forest, borderBottom:`1px solid ${border1}`, padding:'12px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, position:'sticky', top:0, zIndex:100 },
  topTabs:  { background:forest, borderBottom:`1px solid ${border1}`, display:'flex', overflowX:'auto' },
  pg:       { padding:'14px 16px', maxWidth:900, margin:'0 auto' },
  card:     { background:forestMd, border:`1px solid ${border1}`, borderRadius:12, padding:14, marginBottom:12 },
  label:    { fontSize:10, textTransform:'uppercase', letterSpacing:'0.12em', color:'#3A6045', marginBottom:4, display:'block' },
  input:    { width:'100%', padding:'7px 10px', border:`1px solid ${border1}`, borderRadius:8, fontSize:13, background:'#0C1610', color:'#F0EBE3', outline:'none', boxSizing:'border-box' },
  textarea: { width:'100%', padding:9, border:`1px solid ${border1}`, borderRadius:8, fontSize:13, background:'#0C1610', color:'#F0EBE3', outline:'none', minHeight:68, resize:'vertical', boxSizing:'border-box' },
  h1:       { fontFamily:"'Georgia',serif", fontSize:21, color:'#F0EBE3', marginBottom:3, fontWeight:400 },
  h2:       { fontFamily:"'Georgia',serif", fontSize:16, color:'#F0EBE3', marginBottom:8, fontWeight:400 },
  muted:    { fontSize:11, color:'#3A6045', lineHeight:1.6 },
  btn:      (bg, col='#F0EBE3') => ({ background:bg, color:col, border:'none', borderRadius:8, padding:'10px 18px', fontSize:13, fontWeight:500, cursor:'pointer' }),
}

// ─────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────
function SyncBadge({ s }) {
  if (s==='syncing') return <span style={{fontSize:11,color:'#C08A20',marginLeft:8}}>Saving…</span>
  if (s==='saved')   return <span style={{fontSize:11,color:'#3A7D5A',marginLeft:8}}>✓ Saved</span>
  if (s==='error')   return <span style={{fontSize:11,color:'#B85C38',marginLeft:8}}>Error</span>
  return null
}

function NewCycleModal({ onConfirm, onCancel }) {
  const [date, setDate] = useState(todayStr())
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:forestMd,border:`1px solid ${border1}`,borderRadius:16,padding:28,maxWidth:360,width:'100%'}}>
        <div style={S.h1}>🌑 New Cycle Started</div>
        <p style={{fontSize:13,color:'#6A8A72',lineHeight:1.7,marginBottom:20}}>
          Enter the date your period actually began. This resets your cycle day count and updates all future workouts.
        </p>
        <label style={S.label}>Period start date</label>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{...S.input,marginBottom:20}}/>
        <div style={{display:'flex',gap:10}}>
          <button onClick={onCancel} style={{...S.btn('#1E3028','#6A8A72'),flex:1}}>Cancel</button>
          <button onClick={()=>onConfirm(date)} style={{...S.btn('#B85C38'),flex:2}}>Confirm New Cycle</button>
        </div>
      </div>
    </div>
  )
}

// Workout detail modal/panel shown when a day is tapped in cycle view
function DayDetail({ dateStr, cycleDay, cycleNum, log, onClose, onSave, phase }) {
  const workout = getWorkoutForDate(dateStr, cycleDay)
  const sets    = getSetsLabel(cycleNum, phase.key, cycleDay)
  const [entry, setEntry] = useState(log || BLANK)
  const d = new Date(dateStr+'T12:00:00')
  const ic = INTENSITY_COLORS[workout?.intensity||'Rest']||INTENSITY_COLORS.Rest

  const toggleCheck = (i) => setEntry(p=>({...p, checks:{...p.checks,[i]:!p.checks[i]}}))
  const doneCount = workout ? workout.exercises.filter((_,i)=>entry.checks?.[i]).length : 0

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center'}}
      onClick={e=>{ if(e.target===e.currentTarget) onClose() }}>
      <div style={{background:forestMd,border:`1px solid ${border1}`,borderRadius:'16px 16px 0 0',width:'100%',maxWidth:640,maxHeight:'90vh',overflowY:'auto'}}>

        {/* Header */}
        <div style={{background:phase.color+'22',padding:'16px 18px',borderBottom:`1px solid ${border1}`,position:'sticky',top:0,background:forestMd,zIndex:1}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
            <div>
              <div style={{fontSize:10,color:'#3A6045',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:3}}>
                C{cycleNum}-D{cycleDay} · {d.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}
              </div>
              <div style={{fontFamily:"'Georgia',serif",fontSize:20,color:'#F0EBE3',marginBottom:2}}>
                {workout?.title || 'Rest Day'}
              </div>
              <div style={{fontSize:12,color:phase.textLight}}>
                {phase.emoji} {phase.label}{sets?` · ${sets} sets`:''}
                {' · '}
                <span style={{background:ic.bg,color:ic.text,padding:'2px 8px',borderRadius:5,fontSize:10,fontWeight:600}}>{workout?.intensity||'Rest'}</span>
              </div>
              {workout?.note && <div style={{fontSize:12,color:'#6A8A72',marginTop:4,lineHeight:1.6}}>{workout.note}</div>}
            </div>
            <button onClick={onClose} style={{background:'#1E3028',border:'none',color:'#6A8A72',borderRadius:8,padding:'6px 12px',fontSize:13,cursor:'pointer',flexShrink:0}}>✕</button>
          </div>
        </div>

        <div style={{padding:'14px 18px'}}>
          {/* Exercise checklist */}
          {workout && (
            <div style={{...S.card,padding:0,overflow:'hidden',marginBottom:14}}>
              <div style={{height:3,background:'#1E3028'}}>
                <div style={{height:'100%',width:`${workout.exercises.length?(doneCount/workout.exercises.length)*100:0}%`,background:phase.color,transition:'width 0.3s'}}/>
              </div>
              {injectSets(workout.exercises, sets||'—').map((ex,i)=>(
                <div key={i} onClick={()=>toggleCheck(i)} style={{
                  display:'flex',alignItems:'flex-start',gap:12,padding:'10px 14px',
                  borderBottom:i<workout.exercises.length-1?`1px solid #111E15`:'none',
                  cursor:'pointer',background:entry.checks?.[i]?phase.color+'0A':'transparent',
                }}>
                  <div style={{
                    width:19,height:19,borderRadius:5,flexShrink:0,marginTop:1,
                    background:entry.checks?.[i]?phase.color:'transparent',
                    border:`2px solid ${entry.checks?.[i]?phase.color:'#1E3020'}`,
                    display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s',
                  }}>
                    {entry.checks?.[i]&&<span style={{color:'#fff',fontSize:10,fontWeight:700}}>✓</span>}
                  </div>
                  <div style={{fontSize:13,color:entry.checks?.[i]?'#3A6045':'#C8D8CC',textDecoration:entry.checks?.[i]?'line-through':'none',lineHeight:1.5}}>{ex}</div>
                </div>
              ))}
            </div>
          )}

          {/* Check-in */}
          <div style={{...S.card,marginBottom:14}}>
            <div style={S.h2}>Check-in</div>

            <label style={S.label}>Energy</label>
            <div style={{display:'flex',gap:6,marginBottom:4}}>
              {ENERGY_OPTS.map(e=>(
                <button key={e.v} onClick={()=>setEntry(p=>({...p,energy:e.v}))} style={{
                  flex:1,padding:'7px 2px',borderRadius:7,fontSize:18,cursor:'pointer',
                  border:`1px solid ${entry.energy===e.v?phase.color:'#1E3028'}`,
                  background:entry.energy===e.v?phase.color+'28':'#0C1610',
                  transform:entry.energy===e.v?'scale(1.1)':'scale(1)',transition:'all 0.15s',
                }}>{e.e}</button>
              ))}
            </div>
            <div style={{textAlign:'center',fontSize:11,color:phase.textLight,marginBottom:14}}>
              {ENERGY_OPTS.find(e=>e.v===entry.energy)?.l}
            </div>

            <label style={S.label}>Mood</label>
            <div style={{display:'flex',gap:6,marginBottom:14}}>
              {MOOD_OPTS.map((m,i)=>(
                <button key={i} onClick={()=>setEntry(p=>({...p,mood:i}))} style={{
                  flex:1,padding:'7px 2px',borderRadius:7,fontSize:18,cursor:'pointer',
                  border:`1px solid ${entry.mood===i?phase.color:'#1E3028'}`,
                  background:entry.mood===i?phase.color+'28':'#0C1610',
                  transform:entry.mood===i?'scale(1.1)':'scale(1)',transition:'all 0.15s',
                }}>{m}</button>
              ))}
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12}}>
              {[['steps','👣 Steps','10,432'],['water','💧 Water L','2.5'],['weight','⚖️ lbs','112']].map(([k,l,ph])=>(
                <div key={k}>
                  <label style={S.label}>{l}</label>
                  <input value={entry[k]||''} onChange={e=>setEntry(p=>({...p,[k]:e.target.value}))} placeholder={ph} style={S.input}/>
                </div>
              ))}
            </div>

            <label style={S.label}>Notes · PRs · Times</label>
            <textarea value={entry.notes||''} onChange={e=>setEntry(p=>({...p,notes:e.target.value}))}
              placeholder="Sprint times · weights · boxing rounds…" style={S.textarea}/>
          </div>

          <button onClick={()=>onSave(dateStr,entry)} style={{...S.btn(phase.color),width:'100%',marginBottom:8}}>
            Save to Cloud
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// CYCLE PANEL — horizontal 27-day strip + sub-header
// ─────────────────────────────────────────────────────────────────
function CyclePanel({ cycleNum, cycleStarts, logs, today, onDayClick }) {
  const pb       = getPeriodizationBlock(cycleNum)
  const sets     = getSetsForCycle(cycleNum)
  const prog     = getCycleProgression(cycleNum)
  const days     = buildCycleDays(cycleNum, cycleStarts)
  const cycleStart = days[0].dateStr
  const cycleEnd   = days[days.length-1].dateStr
  const isPast   = cycleEnd < today
  const isCurrent= days.some(d=>d.dateStr===today)
  const isFuture = cycleStart > today

  // Phase sections for the strip legend
  const phaseBlocks = []
  let curPhase = null, curStart = 0
  days.forEach(({cycleDay},i)=>{
    const pk = getPhase(cycleDay).key
    if (pk !== curPhase) {
      if (curPhase) phaseBlocks.push({key:curPhase,start:curStart,end:i-1})
      curPhase=pk; curStart=i
    }
    if (i===days.length-1) phaseBlocks.push({key:curPhase,start:curStart,end:i})
  })

  return (
    <div style={{marginBottom:20}}>
      {/* Cycle sub-header */}
      <div style={{background:pb.color+'18',border:`1px solid ${pb.color}33`,borderLeft:`3px solid ${pb.color}`,borderRadius:'10px 10px 0 0',padding:'12px 16px'}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
          <div>
            <div style={{fontSize:10,color:'#3A6045',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:3}}>
              {pb.block} · {pb.sub}
              {isCurrent && <span style={{marginLeft:8,color:pb.color,fontWeight:700}}>← Current</span>}
              {isPast    && <span style={{marginLeft:8,color:'#3A6045'}}>Complete</span>}
              {isFuture  && <span style={{marginLeft:8,color:'#3A6045'}}>Upcoming</span>}
            </div>
            <div style={{fontFamily:"'Georgia',serif",fontSize:18,color:'#F0EBE3'}}>Cycle {cycleNum}</div>
            <div style={{fontSize:11,color:'#6A8A72',marginTop:2}}>
              {new Date(cycleStart+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}
              {' – '}
              {new Date(cycleEnd+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
            </div>
          </div>

          {/* Sets + progression */}
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <div style={{background:'#0C1610',border:`1px solid ${border1}`,borderRadius:8,padding:'7px 12px',fontSize:11}}>
              <div style={{color:'#3A6045',marginBottom:3,textTransform:'uppercase',fontSize:9,letterSpacing:'0.1em'}}>Sets</div>
              <div style={{color:PHASES.follicular.textLight}}>🌿 {sets.follicular}</div>
              <div style={{color:PHASES.ovulation.textLight}}>☀️ {sets.ovulation}</div>
              <div style={{color:PHASES.luteal.textLight}}>🌙 {sets.earlyLuteal}/{sets.lateLuteal}</div>
            </div>
            <div style={{background:'#0C1610',border:`1px solid ${border1}`,borderRadius:8,padding:'7px 12px',fontSize:11,minWidth:120}}>
              <div style={{color:'#3A6045',marginBottom:3,textTransform:'uppercase',fontSize:9,letterSpacing:'0.1em'}}>Targets</div>
              <div style={{color:'#C8D8CC'}}>⚡ {prog.sprint}</div>
              <div style={{color:'#C8D8CC'}}>🎒 {prog.ruck}</div>
              <div style={{color:'#C8D8CC'}}>🏃 {prog.run}</div>
              <div style={{color:'#C8D8CC'}}>🥊 {prog.boxing}</div>
            </div>
          </div>
        </div>

        {/* Phase legend bar */}
        <div style={{display:'flex',gap:4,marginTop:10,alignItems:'center'}}>
          {phaseBlocks.map(({key,start,end})=>{
            const p=PHASES[key]
            const count=end-start+1
            return (
              <div key={key+start} style={{flex:count,background:p.color+'40',borderRadius:4,padding:'2px 6px',minWidth:0}}>
                <div style={{fontSize:9,color:p.textLight,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                  {p.emoji} D{days[start].cycleDay}–D{days[end].cycleDay}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 27-day horizontal strip */}
      <div style={{background:forestMd,border:`1px solid ${border1}`,borderTop:'none',borderRadius:'0 0 10px 10px',padding:'10px 12px',overflowX:'auto'}}>
        <div style={{display:'flex',gap:4,minWidth:'max-content'}}>
          {days.map(({dateStr,cycleDay})=>{
            const phase   = getPhase(cycleDay)
            const workout = getWorkoutForDate(dateStr,cycleDay)
            const hasLog  = logs[dateStr] && Object.values(logs[dateStr].checks||{}).some(Boolean)
            const isToday = dateStr===today
            const isPastDay = dateStr<today
            const ic      = INTENSITY_COLORS[workout?.intensity||'Rest']||INTENSITY_COLORS.Rest
            const d       = new Date(dateStr+'T12:00:00')

            return (
              <div key={dateStr} onClick={()=>onDayClick(dateStr,cycleDay,cycleNum)}
                style={{
                  width:52,flexShrink:0,cursor:'pointer',borderRadius:9,overflow:'hidden',
                  border:`2px solid ${isToday?phase.color:'transparent'}`,
                  background:isToday?phase.color+'22':isPastDay?'#0E1810':'#111C15',
                  opacity:dateStr>today?0.55:1,
                  transition:'transform 0.12s,box-shadow 0.12s',
                  boxShadow:isToday?`0 0 0 2px ${phase.color}44`:'none',
                }}>
                {/* Phase colour top bar */}
                <div style={{height:4,background:phase.color+(isToday?'FF':'66')}}/>

                {/* Day number */}
                <div style={{padding:'5px 4px 3px',textAlign:'center'}}>
                  <div style={{
                    width:24,height:24,borderRadius:'50%',margin:'0 auto 2px',
                    background:isToday?phase.color:'transparent',
                    display:'flex',alignItems:'center',justifyContent:'center',
                  }}>
                    <span style={{fontSize:11,fontWeight:700,color:isToday?'#fff':phase.textLight}}>{cycleDay}</span>
                  </div>
                  <div style={{fontSize:9,color:'#3A6045',lineHeight:1}}>{DOW_SHORT[d.getDay()]}</div>
                  <div style={{fontSize:9,color:'#3A6045',lineHeight:1.2}}>{d.toLocaleDateString('en-US',{month:'numeric',day:'numeric'})}</div>
                </div>

                {/* Slot icon */}
                <div style={{textAlign:'center',fontSize:13,padding:'2px 0',background:'#0C1610'}}>
                  {workout?.slot.icon||'🧘'}
                </div>

                {/* Intensity pip */}
                <div style={{background:ic.bg,padding:'2px 3px',textAlign:'center'}}>
                  <div style={{fontSize:8,color:ic.text,fontWeight:600,letterSpacing:'0.03em',overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>
                    {workout?.intensity||'Rest'}
                  </div>
                </div>

                {/* Log check */}
                <div style={{height:14,background:hasLog?'#1A3A20':'transparent',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {hasLog&&<span style={{fontSize:9,color:'#5BAA7A',fontWeight:700}}>✓</span>}
                </div>
              </div>
            )
          })}
        </div>

        {/* Slot legend */}
        <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:8,paddingTop:8,borderTop:`1px solid ${border1}`}}>
          {[['🧘','Rest/Pilates'],['🏋️','Strength'],['⚡','Sprint'],['🥊','Boxing'],['💪','Pull·Push·Core'],['🏃','Run+Plyo'],['🎒','Ruck']].map(([icon,name])=>(
            <div key={name} style={{fontSize:10,color:'#3A6045',display:'flex',alignItems:'center',gap:3}}>
              <span>{icon}</span><span>{name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────
export default function App() {
  const today = todayStr()

  const [tab, setTab]                 = useState('today')
  const [logs, setLogs]               = useState({})
  const [milestones, setMilestones]   = useState({})
  const [cycleStarts, setCycleStarts] = useState([PROGRAM_START])
  const [syncStatus, setSyncStatus]   = useState('idle')
  const [loading, setLoading]         = useState(true)
  const [showNewCycle, setShowNewCycle] = useState(false)
  const [dayDetail, setDayDetail]     = useState(null) // {dateStr,cycleDay,cycleNum}

  // Today's derived values
  const { cycleNum:todayCN, cycleDay:todayCD } = resolveCyclePosition(cycleStarts, today)
  const todayPhase   = getPhase(todayCD)
  const todayWorkout = getWorkoutForDate(today, todayCD)
  const todaySets    = getSetsLabel(todayCN, todayPhase.key, todayCD)
  const todayEntry   = logs[today] || BLANK
  const todayProgDay = programDay(today)
  const todayPB      = getPeriodizationBlock(todayCN)
  const daysInProg   = daysBetween(PROGRAM_START, today) + 1

  const nextShift = (() => {
    for (let d=todayCD+1;d<=CYCLE_LENGTH;d++) {
      const p=getPhase(d)
      if (p.key!==todayPhase.key) {
        const da=d-todayCD
        return {day:d,phase:p,daysAway:da,nextCycle:false}
      }
    }
    const da=CYCLE_LENGTH-todayCD+1
    return {day:1,phase:{key:'menstrual',...PHASES.menstrual},daysAway:da,nextCycle:true}
  })()

  const lutealSplit = todayPhase.key==='luteal'&&todayCD<21 ? {daysAway:21-todayCD} : null

  // ── LOAD ────────────────────────────────────────────────────────
  useEffect(()=>{
    const load = async () => {
      setLoading(true)
      try {
        const [{data:ld},{data:md},{data:csd}] = await Promise.all([
          supabase.from('peak_logs').select('*'),
          supabase.from('peak_milestones').select('*'),
          supabase.from('peak_cycle_starts').select('start_date').order('start_date',{ascending:true}),
        ])
        if (ld) {
          const m={}
          ld.forEach(l=>{m[l.date]={checks:l.checks||{},energy:l.energy||3,mood:l.mood??2,steps:l.steps||'',water:l.water||'',weight:l.weight||'',notes:l.notes||''}})
          setLogs(m)
        }
        if (md) { const m={}; md.forEach(x=>{m[x.id]=x.achieved}); setMilestones(m) }
        if (csd&&csd.length>0) setCycleStarts(csd.map(r=>r.start_date))
      } catch(e){console.error(e)}
      setLoading(false)
    }
    load()
  },[])

  // ── SAVE ────────────────────────────────────────────────────────
  const saveEntry = useCallback(async (dateStr, entry) => {
    setSyncStatus('syncing')
    const {cycleNum:cn,cycleDay:cd} = resolveCyclePosition(cycleStarts, dateStr)
    const {error} = await supabase.from('peak_logs').upsert({
      date:dateStr,cycle_num:cn,cycle_day:cd,
      prog_day:programDay(dateStr),phase:getPhase(cd).key,dow:dowFromDate(dateStr),
      checks:entry.checks,energy:entry.energy,mood:entry.mood,
      steps:entry.steps,water:entry.water,weight:entry.weight,notes:entry.notes,
    },{onConflict:'date'})
    if (error){setSyncStatus('error');setTimeout(()=>setSyncStatus('idle'),3000)}
    else {
      setLogs(p=>({...p,[dateStr]:entry}))
      setSyncStatus('saved');setTimeout(()=>setSyncStatus('idle'),2500)
    }
  },[cycleStarts])

  const saveToday = useCallback(()=>saveEntry(today, logs[today]||BLANK),[saveEntry,today,logs])
  const saveDayDetail = (dateStr,entry)=>{ saveEntry(dateStr,entry); setDayDetail(null) }

  const updateToday = fn => setLogs(p=>({...p,[today]:fn(p[today]||BLANK)}))
  const toggleCheck = i => updateToday(e=>({...e,checks:{...e.checks,[i]:!e.checks[i]}}))
  const doneCount = todayWorkout ? todayWorkout.exercises.filter((_,i)=>todayEntry.checks?.[i]).length : 0

  const confirmNewCycle = async dateStr => {
    const ns=[...cycleStarts.filter(d=>d!==dateStr),dateStr].sort()
    setCycleStarts(ns);setShowNewCycle(false)
    await supabase.from('peak_cycle_starts').upsert({start_date:dateStr},{onConflict:'start_date'})
  }

  const toggleMilestone = async idx => {
    const v=!milestones[idx]
    setMilestones(p=>({...p,[idx]:v}))
    await supabase.from('peak_milestones').upsert({id:idx,achieved:v,achieved_at:v?new Date().toISOString():null},{onConflict:'id'})
  }

  // All 13 cycles pre-built
  const allCycles = Array.from({length:TOTAL_CYCLES},(_,i)=>i+1)

  if (loading) return (
    <div style={{...S.app,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12}}>
      <div style={{fontFamily:"'Georgia',serif",fontSize:28,letterSpacing:'0.3em',color:'#F0EBE3'}}>PEAK</div>
      <div style={{fontSize:13,color:'#3A6045'}}>Loading your program…</div>
    </div>
  )

  const detailPhase = dayDetail ? getPhase(dayDetail.cycleDay) : null

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:#1A3020;border-radius:3px}
        input,textarea{font-family:'DM Sans','Arial',sans-serif}
        .day-cell:hover{transform:translateY(-2px)!important;box-shadow:0 4px 12px rgba(0,0,0,0.4)!important;opacity:1!important}
        .tab-b:hover{color:#C8D8CC!important}
        @keyframes fu{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fu 0.22s ease both}
        input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(0.4)}
        .ex-row:hover{background:#1A2E1888}
      `}</style>

      {showNewCycle && <NewCycleModal onConfirm={confirmNewCycle} onCancel={()=>setShowNewCycle(false)}/>}

      {dayDetail && (
        <DayDetail
          dateStr={dayDetail.dateStr}
          cycleDay={dayDetail.cycleDay}
          cycleNum={dayDetail.cycleNum}
          log={logs[dayDetail.dateStr]}
          phase={detailPhase}
          onClose={()=>setDayDetail(null)}
          onSave={saveDayDetail}
        />
      )}

      {/* ── NAV ── */}
      <div style={S.nav}>
        <div>
          <div style={{fontFamily:"'Georgia',serif",fontSize:19,fontWeight:300,letterSpacing:'0.3em',color:'#F0EBE3'}}>
            PEAK <span style={{fontStyle:'italic',color:todayPhase.textLight}}>Tracker</span>
          </div>
          <div style={{fontSize:11,color:'#3A6045',marginTop:1}}>
            Day {todayProgDay} · C{todayCN}-D{todayCD} · {todayPhase.emoji} {todayPhase.label}
            <SyncBadge s={syncStatus}/>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <div style={{background:todayPhase.color+'22',border:`1px solid ${todayPhase.color}44`,color:todayPhase.textLight,borderRadius:14,padding:'4px 12px',fontSize:11,fontWeight:500}}>
            {todayPB.block}
          </div>
          <button onClick={()=>setShowNewCycle(true)}
            style={{background:'#2A100A',border:'1px solid #B85C3866',color:'#E8956D',borderRadius:14,padding:'4px 12px',fontSize:11,cursor:'pointer'}}>
            🌑 New Cycle
          </button>
        </div>
      </div>

      {/* ── TOP TABS ── */}
      <div style={S.topTabs}>
        {/* Today */}
        <button className="tab-b" onClick={()=>setTab('today')} style={{
          padding:'10px 16px',background:'none',border:'none',flexShrink:0,
          borderBottom:`2px solid ${tab==='today'?todayPhase.color:'transparent'}`,
          color:tab==='today'?todayPhase.textLight:'#3A6045',
          fontSize:12,letterSpacing:'0.1em',textTransform:'uppercase',fontWeight:500,cursor:'pointer',
        }}>Today</button>

        {/* Program (all cycles) */}
        <button className="tab-b" onClick={()=>setTab('program')} style={{
          padding:'10px 16px',background:'none',border:'none',flexShrink:0,
          borderBottom:`2px solid ${tab==='program'?'#6A8A72':'transparent'}`,
          color:tab==='program'?'#C8D8CC':'#3A6045',
          fontSize:12,letterSpacing:'0.1em',textTransform:'uppercase',fontWeight:500,cursor:'pointer',
        }}>12-Month Program</button>

        {/* Stats */}
        <button className="tab-b" onClick={()=>setTab('stats')} style={{
          padding:'10px 16px',background:'none',border:'none',flexShrink:0,
          borderBottom:`2px solid ${tab==='stats'?'#6A8A72':'transparent'}`,
          color:tab==='stats'?'#C8D8CC':'#3A6045',
          fontSize:12,letterSpacing:'0.1em',textTransform:'uppercase',fontWeight:500,cursor:'pointer',
        }}>Stats</button>
      </div>

      <div style={S.pg}>

        {/* ══════════════════════════════════════════════
            TODAY
        ══════════════════════════════════════════════ */}
        {tab==='today' && (
          <div className="fu">
            {/* Header card */}
            <div style={{...S.card,borderLeft:`3px solid ${todayPhase.color}`}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>
                <div>
                  <div style={{fontSize:10,color:'#3A6045',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:2}}>
                    {new Date(today+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}
                  </div>
                  <div style={{fontFamily:"'Georgia',serif",fontSize:20,color:'#F0EBE3'}}>C{todayCN}-D{todayCD} · Program Day {todayProgDay}</div>
                  <div style={{fontSize:12,color:todayPhase.textLight,marginTop:2}}>
                    {todayPhase.emoji} {todayPhase.label} · {todayPB.block}
                  </div>
                </div>
                {todaySets&&(
                  <div style={{background:todayPhase.color+'22',border:`1px solid ${todayPhase.color}44`,borderRadius:9,padding:'8px 14px',textAlign:'center',flexShrink:0}}>
                    <div style={{fontSize:9,color:'#3A6045',textTransform:'uppercase',letterSpacing:'0.1em'}}>Sets</div>
                    <div style={{fontFamily:"'Georgia',serif",fontSize:22,color:todayPhase.textLight,lineHeight:1}}>{todaySets}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Phase shift banner */}
            {(()=>{
              const sp=nextShift.phase
              const urg=nextShift.daysAway<=1?'#C08A20':sp.color
              const lbl=nextShift.daysAway===0?'Today':nextShift.daysAway===1?'Tomorrow':`in ${nextShift.daysAway} days`
              return (
                <div style={{marginBottom:12}}>
                  <div style={{background:forestMd,border:`1px solid ${urg}33`,borderLeft:`3px solid ${urg}`,borderRadius:10,padding:'9px 14px',marginBottom:6,display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                    <div>
                      <div style={{fontSize:9,color:'#3A6045',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:2}}>Next phase shift</div>
                      <div style={{fontSize:13,color:'#C8D8CC'}}>
                        <span style={{color:urg,fontWeight:600}}>{sp.emoji} {sp.label}</span>
                        {' begins '}<span style={{color:'#6A8A72'}}>{lbl}</span>
                        {nextShift.nextCycle&&<span style={{color:'#3A6045'}}> · new cycle</span>}
                      </div>
                    </div>
                    <div style={{background:urg+'22',color:urg,borderRadius:14,padding:'3px 10px',fontSize:12,fontWeight:700,flexShrink:0}}>
                      {nextShift.daysAway===0?'Now':`${nextShift.daysAway}d`}
                    </div>
                  </div>
                  {lutealSplit&&(
                    <div style={{background:forestMd,border:'1px solid #6A5AAA33',borderLeft:'3px solid #6A5AAA55',borderRadius:10,padding:'9px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                      <div>
                        <div style={{fontSize:9,color:'#3A6045',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:2}}>Luteal intensity drop</div>
                        <div style={{fontSize:13,color:'#C8D8CC'}}>
                          <span style={{color:'#8A7ACC'}}>🌙 Late luteal</span>
                          {' in '}<span style={{color:'#6A8A72'}}>{lutealSplit.daysAway} day{lutealSplit.daysAway!==1?'s':''}</span>
                          <span style={{color:'#3A6045'}}> · Day 21</span>
                        </div>
                      </div>
                      <div style={{background:'#6A5AAA22',color:'#8A7ACC',borderRadius:14,padding:'3px 10px',fontSize:12,fontWeight:700}}>{lutealSplit.daysAway}d</div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Workout */}
            {todayWorkout&&(
              <div style={{...S.card,padding:0,overflow:'hidden',marginBottom:12}}>
                <div style={{background:todayPhase.color+'18',padding:'12px 16px',borderBottom:`1px solid ${border1}`}}>
                  <div style={{fontSize:10,color:'#3A6045',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:2}}>
                    {todayWorkout.slot.icon} {todayWorkout.slot.name} · {DOW_NAMES[todayWorkout.dow]}
                  </div>
                  <div style={{fontFamily:"'Georgia',serif",fontSize:19,color:'#F0EBE3',marginBottom:2}}>{todayWorkout.title}</div>
                  {todayWorkout.note&&<div style={{fontSize:12,color:'#6A8A72',lineHeight:1.6}}>{todayWorkout.note}</div>}
                  <div style={{fontSize:11,color:'#3A6045',marginTop:4}}>{doneCount}/{todayWorkout.exercises.length} done</div>
                </div>
                <div style={{height:3,background:'#1E3028'}}>
                  <div style={{height:'100%',width:`${todayWorkout.exercises.length?(doneCount/todayWorkout.exercises.length)*100:0}%`,background:todayPhase.color,transition:'width 0.4s'}}/>
                </div>
                {injectSets(todayWorkout.exercises,todaySets||'—').map((ex,i)=>(
                  <div key={i} className="ex-row" onClick={()=>toggleCheck(i)} style={{
                    display:'flex',alignItems:'flex-start',gap:12,padding:'10px 16px',
                    borderBottom:i<todayWorkout.exercises.length-1?'1px solid #111E15':'none',cursor:'pointer',
                  }}>
                    <div style={{
                      width:19,height:19,borderRadius:5,flexShrink:0,marginTop:1,
                      background:todayEntry.checks?.[i]?todayPhase.color:'transparent',
                      border:`2px solid ${todayEntry.checks?.[i]?todayPhase.color:'#1E3020'}`,
                      display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s',
                    }}>
                      {todayEntry.checks?.[i]&&<span style={{color:'#fff',fontSize:9,fontWeight:700}}>✓</span>}
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
              <div style={{display:'flex',gap:6,marginBottom:4}}>
                {ENERGY_OPTS.map(e=>(
                  <button key={e.v} onClick={()=>updateToday(p=>({...p,energy:e.v}))} style={{
                    flex:1,padding:'7px 2px',borderRadius:7,fontSize:18,cursor:'pointer',
                    border:`1px solid ${todayEntry.energy===e.v?todayPhase.color:'#1E3028'}`,
                    background:todayEntry.energy===e.v?todayPhase.color+'28':'#0C1610',
                    transform:todayEntry.energy===e.v?'scale(1.1)':'scale(1)',transition:'all 0.15s',
                  }}>{e.e}</button>
                ))}
              </div>
              <div style={{textAlign:'center',fontSize:11,color:todayPhase.textLight,marginBottom:14}}>
                {ENERGY_OPTS.find(e=>e.v===todayEntry.energy)?.l}
              </div>
              <label style={S.label}>Mood</label>
              <div style={{display:'flex',gap:6,marginBottom:14}}>
                {MOOD_OPTS.map((m,i)=>(
                  <button key={i} onClick={()=>updateToday(p=>({...p,mood:i}))} style={{
                    flex:1,padding:'7px 2px',borderRadius:7,fontSize:18,cursor:'pointer',
                    border:`1px solid ${todayEntry.mood===i?todayPhase.color:'#1E3028'}`,
                    background:todayEntry.mood===i?todayPhase.color+'28':'#0C1610',
                    transform:todayEntry.mood===i?'scale(1.1)':'scale(1)',transition:'all 0.15s',
                  }}>{m}</button>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12}}>
                {[['steps','👣 Steps','10,432'],['water','💧 Water L','2.5'],['weight','⚖️ lbs','112']].map(([k,l,ph])=>(
                  <div key={k}>
                    <label style={S.label}>{l}</label>
                    <input value={todayEntry[k]||''} onChange={e=>updateToday(p=>({...p,[k]:e.target.value}))} placeholder={ph} style={S.input}/>
                  </div>
                ))}
              </div>
              <label style={S.label}>Notes · PRs · Times</label>
              <textarea value={todayEntry.notes||''} onChange={e=>updateToday(p=>({...p,notes:e.target.value}))}
                placeholder="Sprint times · weights · boxing rounds…" style={S.textarea}/>
            </div>

            <button onClick={saveToday} style={{
              ...S.btn(syncStatus==='saved'?'#2A6040':todayPhase.color),width:'100%',transition:'background 0.3s',
            }}>
              {syncStatus==='syncing'?'Saving…':syncStatus==='saved'?'✓ Saved to cloud':'Save to Cloud'}
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            12-MONTH PROGRAM — all cycles
        ══════════════════════════════════════════════ */}
        {tab==='program' && (
          <div className="fu">
            <div style={S.h1}>12-Month Program</div>
            <div style={{...S.muted,marginBottom:16}}>
              All {TOTAL_CYCLES} cycles pre-built · May 23 2026 – May 2027 · Tap any day to view workout &amp; log
            </div>

            {/* Periodization legend */}
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:20}}>
              {PERIODIZATION.map(p=>(
                <div key={p.block} style={{background:p.color+'18',border:`1px solid ${p.color}44`,borderRadius:8,padding:'6px 12px',fontSize:11}}>
                  <span style={{color:p.color,fontWeight:600}}>{p.block}</span>
                  <span style={{color:'#3A6045',marginLeft:6}}>C{p.cycles[0]}–C{p.cycles[p.cycles.length-1]}</span>
                </div>
              ))}
            </div>

            {allCycles.map(cn=>(
              <CyclePanel
                key={cn}
                cycleNum={cn}
                cycleStarts={cycleStarts}
                logs={logs}
                today={today}
                onDayClick={(dateStr,cycleDay,cycleNum)=>setDayDetail({dateStr,cycleDay,cycleNum})}
              />
            ))}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            STATS
        ══════════════════════════════════════════════ */}
        {tab==='stats' && (
          <div className="fu">
            <div style={S.h1}>Progress</div>
            <div style={{...S.muted,marginBottom:16}}>Day {daysInProg} · C{todayCN}-D{todayCD} · {Math.round(daysInProg/7)} weeks in</div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
              {[
                {icon:'📅',label:'Program Day',value:daysInProg},
                {icon:'🔄',label:'Position',value:`C${todayCN}-D${todayCD}`},
                {icon:'🏋️',label:'Sessions',value:Object.values(logs).filter(l=>l.checks&&Object.values(l.checks).some(Boolean)).length},
                {icon:'⚡',label:'Avg Energy',value:Object.values(logs).length?(Object.values(logs).reduce((s,l)=>s+(l.energy||0),0)/Object.values(logs).length).toFixed(1)+'/5':'—'},
              ].map(({icon,label,value})=>(
                <div key={label} style={{...S.card,textAlign:'center',padding:14}}>
                  <div style={{fontSize:22,marginBottom:4}}>{icon}</div>
                  <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:'0.1em',color:'#3A6045',marginBottom:3}}>{label}</div>
                  <div style={{fontFamily:"'Georgia',serif",fontSize:20,color:'#F0EBE3'}}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{...S.card,marginBottom:14}}>
              <div style={S.h2}>Cycle History</div>
              {cycleStarts.map((cs,i)=>{
                const cn=i+1,isCur=cn===todayCN,next=cycleStarts[i+1]
                const len=next?daysBetween(cs,next):daysBetween(cs,today)+1
                return (
                  <div key={cs} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 0',borderBottom:i<cycleStarts.length-1?`1px solid ${border1}`:'none'}}>
                    <div>
                      <div style={{fontSize:13,color:'#C8D8CC',fontWeight:isCur?600:400}}>Cycle {cn}</div>
                      <div style={{fontSize:11,color:'#3A6045'}}>{new Date(cs+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:12,color:isCur?todayPhase.textLight:'#6A8A72',fontWeight:isCur?600:400}}>
                        {isCur?`D${todayCD}/${CYCLE_LENGTH}`:next?`${len}d`:'active'}
                      </div>
                      {isCur&&<div style={{fontSize:9,color:todayPhase.color}}>now</div>}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{...S.card,marginBottom:14}}>
              <div style={S.h2}>Program Blocks</div>
              {PERIODIZATION.map(p=>{
                const isCur=p.cycles.includes(todayCN)
                return (
                  <div key={p.block} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 0',borderBottom:`1px solid ${border1}`}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:isCur?p.color:'#1A2E20',flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,color:isCur?'#F0EBE3':'#6A8A72',fontWeight:isCur?600:400}}>{p.block}</div>
                      <div style={{fontSize:11,color:'#3A6045'}}>C{p.cycles[0]}–C{p.cycles[p.cycles.length-1]} · {p.sub}</div>
                    </div>
                    {isCur&&<div style={{fontSize:11,color:p.color,fontWeight:600}}>Now</div>}
                  </div>
                )
              })}
            </div>

            {(()=>{
              const wl=Object.entries(logs).filter(([,l])=>l.weight).map(([d,l])=>({d,w:parseFloat(l.weight)})).filter(x=>!isNaN(x.w)).sort((a,b)=>a.d.localeCompare(b.d))
              if (wl.length<2) return null
              const first=wl[0].w,last=wl[wl.length-1].w,diff=(last-first).toFixed(1)
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

            <div style={S.card}>
              <div style={S.h2}>Goal Milestones</div>
              <div style={{fontSize:11,color:'#3A6045',marginBottom:12}}>{Object.values(milestones).filter(Boolean).length}/{MILESTONES.length} achieved</div>
              {MILESTONES.map((goal,i)=>(
                <div key={i} onClick={()=>toggleMilestone(i)} style={{
                  display:'flex',alignItems:'center',gap:10,padding:'8px 4px',
                  borderBottom:i<MILESTONES.length-1?`1px solid ${border1}`:'none',cursor:'pointer',
                }}>
                  <div style={{
                    width:18,height:18,borderRadius:5,flexShrink:0,
                    background:milestones[i]?'#3A7D5A':'transparent',
                    border:`2px solid ${milestones[i]?'#3A7D5A':'#1E3020'}`,
                    display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s',
                  }}>
                    {milestones[i]&&<span style={{color:'#fff',fontSize:9,fontWeight:700}}>✓</span>}
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
