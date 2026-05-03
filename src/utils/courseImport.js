import * as XLSX from 'xlsx'

const WEEKDAY_MAP = {
  星期一: 1,
  星期二: 2,
  星期三: 3,
  星期四: 4,
  星期五: 5,
  星期六: 6,
  星期日: 7,
}

function formatDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(dateKey, offset) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + offset)
  return formatDateKey(date)
}

function normalizeText(value) {
  return String(value ?? '')
    .replace(/\r/g, '')
    .replace(/\u3000/g, ' ')
    .trim()
}

function findDayColumns(rows) {
  const dayColumns = new Map()

  for (const row of rows) {
    row.forEach((cell, columnIndex) => {
      const text = normalizeText(cell)
      if (WEEKDAY_MAP[text]) dayColumns.set(columnIndex, WEEKDAY_MAP[text])
    })
    if (dayColumns.size > 0) break
  }

  return dayColumns
}

function splitCourseBlocks(text) {
  const normalized = normalizeText(text)
  if (!normalized) return []

  return normalized
    .split(/(?=（本）|\(本\))/)
    .map(block => block.trim())
    .filter(block => block.includes('第') && block.includes('节'))
}

function parseSection(block) {
  const matches = [...block.matchAll(/第\s*(\d+)\s*(?:[,，、\-~至]\s*(\d+))?\s*节/g)]
  const match = matches.at(-1)
  if (!match) return null

  const start = Number(match[1])
  const end = Number(match[2] ?? match[1])

  if (!start || !end) return null
  return { startSection: Math.min(start, end), endSection: Math.max(start, end) }
}

function parseCourseBlock(block) {
  const lines = block
    .split('\n')
    .map(line => normalizeText(line))
    .filter(Boolean)

  const titleLine = lines[0] ?? ''
  const title = titleLine.replace(/^（本）|\(本\)/, '').trim()
  const section = parseSection(block)

  if (!title || !section) return null

  const teacherMatch = block.match(/\n([^\n[]+)\[([\s\S]*?)\]/)
  const teacher = normalizeText(teacherMatch?.[1] ?? '')
  const weeks = normalizeText((teacherMatch?.[2] ?? '').replace(/\n/g, ' '))
  const locationText = block
    .replace(titleLine, '')
    .replace(teacherMatch?.[0] ?? '', '')
    .replace(/第\s*\d+\s*(?:[,，、\-~至]\s*\d+)?\s*节/g, '')
  const location = locationText
    .split('\n')
    .map(line => normalizeText(line))
    .filter(Boolean)
    .join(' ')

  return {
    title,
    teacher,
    weeks,
    location,
    ...section,
  }
}

export async function parseBeihangScheduleWorkbook(file, weekStartDate) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  const dayColumns = findDayColumns(rows)
  const sourceTitle = normalizeText(rows[0]?.[0] ?? file.name)
  const events = []

  rows.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      const weekday = dayColumns.get(columnIndex)
      if (!weekday) return

      const blocks = splitCourseBlocks(cell)
      for (const block of blocks) {
        const course = parseCourseBlock(block)
        if (!course) continue

        events.push({
          ...course,
          eventDate: addDays(weekStartDate, weekday - 1),
          weekday,
          source: `${sourceTitle} · row ${rowIndex + 1}`,
        })
      }
    })
  })

  const seen = new Set()
  return events.filter(event => {
    const key = [
      event.eventDate,
      event.title,
      event.startSection,
      event.endSection,
      event.teacher,
      event.location,
    ].join('|')

    if (seen.has(key)) return false

    seen.add(key)
    return true
  })
}

function parseWeekNumbers(weeksAndTeachers) {
  const weekText = normalizeText(weeksAndTeachers).split('[')[0]
  const parts = weekText.split(/[,，]/).map(part => normalizeText(part)).filter(Boolean)
  const weeks = new Set()

  for (const part of parts) {
    const parity = part.includes('单') ? 'odd' : part.includes('双') ? 'even' : null
    const cleanPart = part.replace(/周|\(单\)|\(双\)|（单）|（双）/g, '')
    const rangeMatch = cleanPart.match(/^(\d+)\s*-\s*(\d+)$/)
    const singleMatch = cleanPart.match(/^(\d+)$/)

    if (rangeMatch) {
      const start = Number(rangeMatch[1])
      const end = Number(rangeMatch[2])
      for (let week = start; week <= end; week++) {
        if (parity === 'odd' && week % 2 === 0) continue
        if (parity === 'even' && week % 2 !== 0) continue
        weeks.add(week)
      }
    } else if (singleMatch) {
      const week = Number(singleMatch[1])
      if (parity === 'odd' && week % 2 === 0) continue
      if (parity === 'even' && week % 2 !== 0) continue
      weeks.add(week)
    }
  }

  return [...weeks].sort((a, b) => a - b)
}

function parseTeacher(weeksAndTeachers) {
  const match = normalizeText(weeksAndTeachers).match(/\/([^/[{]+)\[/)
  return normalizeText(match?.[1] ?? '')
}

export async function parseBeihangApiScheduleFile(file, semesterStartDate) {
  const raw = await file.text()
  return parseBeihangApiSchedule(JSON.parse(raw), semesterStartDate)
}

export function parseBeihangApiSchedule(payload, semesterStartDate) {
  const courses = payload?.datas?.arrangedList ?? []
  const events = []

  for (const course of courses) {
    if (!course.dayOfWeek || !course.beginSection || !course.endSection) continue

    const weeks = parseWeekNumbers(course.weeksAndTeachers)
    const teacher = parseTeacher(course.weeksAndTeachers)

    for (const week of weeks) {
      events.push({
        title: course.courseName,
        teacher,
        location: course.placeName ?? '',
        eventDate: addDays(semesterStartDate, (week - 1) * 7 + course.dayOfWeek - 1),
        weekday: course.dayOfWeek,
        startSection: course.beginSection,
        endSection: course.endSection,
        weeks: course.weeksAndTeachers ?? '',
        source: `BUAA ${payload?.datas?.code ?? ''} · ${course.teachClassId ?? course.courseCode ?? ''} · week ${week}`,
      })
    }
  }

  const seen = new Set()
  return events.filter(event => {
    const key = [
      event.eventDate,
      event.title,
      event.startSection,
      event.endSection,
      event.teacher,
      event.location,
    ].join('|')

    if (seen.has(key)) return false

    seen.add(key)
    return true
  })
}

export function parseBeihangWeeklySchedule(payload, weekStartDate, weekNumber) {
  const courses = payload?.datas?.list ?? payload?.datas?.arrangedList ?? []
  const events = []

  for (const course of courses) {
    const weekday = Number(course.dayOfWeek)
    const startSection = Number(course.beginSection)
    const endSection = Number(course.endSection)

    if (
      !Number.isInteger(weekday)
      || weekday < 1
      || weekday > 7
      || !Number.isInteger(startSection)
      || !Number.isInteger(endSection)
    ) {
      continue
    }

    events.push({
      title: course.courseName ?? course.teachClassName ?? '',
      teacher: parseTeacher(course.weeksAndTeachers),
      location: course.placeName ?? '',
      eventDate: addDays(weekStartDate, weekday - 1),
      weekday,
      startSection: Math.min(startSection, endSection),
      endSection: Math.max(startSection, endSection),
      startTime: course.beginTime ?? '',
      endTime: course.endTime ?? '',
      weeks: course.weeksAndTeachers ?? '',
      source: `BUAA ${payload?.datas?.code ?? ''} · ${course.teachClassId ?? course.courseCode ?? ''} · week ${weekNumber ?? ''}`,
    })
  }

  const seen = new Set()
  return events.filter(event => {
    const key = [
      event.eventDate,
      event.title,
      event.startSection,
      event.endSection,
      event.teacher,
      event.location,
      event.source,
    ].join('|')

    if (seen.has(key)) return false

    seen.add(key)
    return true
  })
}

export function parseBeihangApiScheduleWithTermWeeks(payload, termWeeksPayload) {
  const weekStartByNumber = new Map(
    (termWeeksPayload?.datas ?? []).map(week => [
      week.serialNumber,
      normalizeText(week.startDate).slice(0, 10),
    ])
  )
  const courses = payload?.datas?.arrangedList ?? []
  const events = []

  for (const course of courses) {
    if (!course.dayOfWeek || !course.beginSection || !course.endSection) continue

    const weeks = parseWeekNumbers(course.weeksAndTeachers)
    const teacher = parseTeacher(course.weeksAndTeachers)

    for (const week of weeks) {
      const weekStartDate = weekStartByNumber.get(week)
      if (!weekStartDate) continue

      events.push({
        title: course.courseName,
        teacher,
        location: course.placeName ?? '',
        eventDate: addDays(weekStartDate, course.dayOfWeek - 1),
        weekday: course.dayOfWeek,
        startSection: course.beginSection,
        endSection: course.endSection,
        weeks: course.weeksAndTeachers ?? '',
        source: `BUAA ${payload?.datas?.code ?? ''} · ${course.teachClassId ?? course.courseCode ?? ''} · week ${week}`,
      })
    }
  }

  const seen = new Set()
  return events.filter(event => {
    const key = [
      event.eventDate,
      event.title,
      event.startSection,
      event.endSection,
      event.teacher,
      event.location,
    ].join('|')

    if (seen.has(key)) return false

    seen.add(key)
    return true
  })
}

export function getCurrentWeekMonday() {
  const today = new Date()
  const day = today.getDay()
  const offset = day === 0 ? -6 : 1 - day
  today.setDate(today.getDate() + offset)
  return formatDateKey(today)
}
