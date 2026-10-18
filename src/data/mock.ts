import type { AppNotification, Cadet, CoachProfile, Guardian, NetBatch } from '@/types'

export const ACADEMY = {
  name: 'Apex Cricket Academy',
  tagline: 'Excellence on Willow & Turf',
}

export const mockCoach: CoachProfile = {
  id: 'coach-01',
  name: 'Vikram Rathore',
  accreditation: 'ECB_L3',
  disciplines: ['batting', 'pace'],
  facility: 'Apex High Performance Academy',
  pitch: 'Oval Turf Pitch 3',
  schedules: [
    { id: 'morning', label: 'Morning Nets', start: '06:30', end: '08:30' },
    { id: 'floodlit', label: 'Floodlit Tactical Lab', start: '16:30', end: '18:30' },
  ],
}

export const mockBatches: NetBatch[] = [
  {
    id: 'u16-pace',
    label: 'U-16 Morning Pace Nets',
    ageGroup: 'U-16',
    focus: 'Pace & Top-Order Batting',
    start: '06:30',
    end: '08:30',
    pitch: 'Turf Pitch 3',
  },
  {
    id: 'u14-spin',
    label: 'U-14 Spin & Fielding',
    ageGroup: 'U-14',
    focus: 'Spin Craft & Ground Fielding',
    start: '16:30',
    end: '18:30',
    pitch: 'Indoor Nets 2',
  },
]

export const mockNotifications: AppNotification[] = [
  { id: 'n1', title: 'Fee overdue', body: 'Kabir Singh — $225 pending for October', time: '8m', read: false, tone: 'alert' },
  { id: 'n2', title: 'Invite opened', body: "Devin Miller's guardian viewed the WhatsApp invite", time: '32m', read: false, tone: 'info' },
  { id: 'n3', title: 'Injury flag', body: 'Ishaan Verma reported mild calf tightness', time: '1h', read: false, tone: 'alert' },
  { id: 'n4', title: 'Scout request', body: 'State selector requested Aarav Sharma dossier', time: '3h', read: true, tone: 'success' },
]

const g = (name: string, contact: string, relationship: Guardian['relationship']): Guardian => ({
  name,
  contact,
  relationship,
  permissions: ['fee_payer', 'attendance_signoff'],
  verified: true,
})

type Seed = [name: string, jersey: number, role: Cadet['role'], hand: Cadet['battingHand'], guardian: Guardian, feeDue?: number, bowling?: string]

const u16Seeds: Seed[] = [
  ['Aarav Sharma', 7, 'Batter', 'Right', g('Sunita Sharma', '+91 98200 11234', 'Mother'), 0, 'Right-arm off-break'],
  ['Kabir Singh', 11, 'Bowler', 'Right', g('Harjeet Singh', '+91 98111 22093', 'Father'), 225, 'Right-arm fast'],
  ['Ishaan Verma', 18, 'Bowler', 'Right', g('Meera Verma', 'meera.verma@mail.com', 'Mother'), 0, 'Right-arm fast-medium'],
  ['Arjun Nair', 3, 'Batter', 'Left', g('Suresh Nair', '+91 98450 77812', 'Father')],
  ['Vihaan Reddy', 21, 'All-Rounder', 'Right', g('Lakshmi Reddy', '+91 99001 34521', 'Mother'), 225, 'Left-arm orthodox'],
  ['Reyansh Gupta', 9, 'Wicketkeeper', 'Right', g('Anil Gupta', 'anil.gupta@mail.com', 'Father')],
  ['Sai Kulkarni', 14, 'Bowler', 'Left', g('Prakash Kulkarni', '+91 98220 66510', 'Father'), 0, 'Left-arm fast'],
  ['Aditya Menon', 5, 'Batter', 'Right', g('Kavya Menon', '+91 97400 22187', 'Mother')],
  ['Krish Malhotra', 27, 'All-Rounder', 'Left', g('Rajiv Malhotra', '+91 98100 90876', 'Father'), 0, 'Right-arm medium'],
  ['Dhruv Iyer', 33, 'Batter', 'Right', g('Priya Iyer', 'priya.iyer@mail.com', 'Mother')],
  ['Om Chatterjee', 44, 'Bowler', 'Right', g('Sourav Chatterjee', '+91 98300 45129', 'Father'), 0, 'Leg-break googly'],
  ['Yash Pandey', 12, 'Batter', 'Right', g('Neha Pandey', '+91 99110 78345', 'Mother')],
  ['Ayaan Khan', 23, 'All-Rounder', 'Right', g('Imran Khan', '+91 98190 33476', 'Father'), 0, 'Right-arm fast-medium'],
  ['Shaurya Joshi', 1, 'Batter', 'Left', g('Deepa Joshi', 'deepa.joshi@mail.com', 'Mother')],
  ['Rudra Desai', 16, 'Bowler', 'Right', g('Manish Desai', '+91 98250 61290', 'Father'), 0, 'Right-arm fast'],
  ['Atharv Bose', 8, 'Wicketkeeper', 'Right', g('Rina Bose', '+91 98310 50981', 'Mother')],
]

const fromSeed = ([name, jersey, role, hand, guardian, feeDue = 0, bowling]: Seed, batchId: string, ageGroup: Cadet['ageGroup']): Cadet => ({
  id: name.toLowerCase().replace(/\s+/g, '-'),
  name,
  jersey,
  role,
  battingHand: hand,
  bowlingStyle: bowling,
  ageGroup,
  batchId,
  linkStatus: 'linked',
  guardian,
  feeDue,
})

const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString()

export const mockCadets: Cadet[] = [
  ...u16Seeds.map((s) => fromSeed(s, 'u16-pace', 'U-16')),
  {
    id: 'devin-miller',
    name: 'Devin Miller',
    jersey: 19,
    role: 'All-Rounder',
    battingHand: 'Right',
    bowlingStyle: 'Right-arm medium-fast',
    ageGroup: 'U-16',
    batchId: 'u16-pace',
    linkStatus: 'pending',
    guardian: { name: 'Laura Miller', contact: '+44 7700 900123', relationship: 'Mother', permissions: ['fee_payer'], verified: false },
    inviteExpiresAt: inHours(46),
    feeDue: 0,
  },
  {
    id: 'rohan-patel',
    name: 'Rohan Patel',
    jersey: 28,
    role: 'Bowler',
    battingHand: 'Left',
    bowlingStyle: 'Slow left-arm orthodox',
    ageGroup: 'U-16',
    batchId: 'u16-pace',
    linkStatus: 'unlinked',
    feeDue: 0,
  },
  fromSeed(['Kian Rao', 6, 'Bowler', 'Right', g('Ramesh Rao', '+91 98860 20193', 'Father'), 0, 'Off-break'], 'u14-spin', 'U-14'),
  fromSeed(['Neel Shetty', 15, 'Batter', 'Left', g('Asha Shetty', 'asha.shetty@mail.com', 'Mother')], 'u14-spin', 'U-14'),
]
