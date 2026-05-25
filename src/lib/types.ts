export type Priority = 'urgent' | 'soon' | 'normal' | 'low'
export type Assignee = 'adi' | 'tahel' | 'both'
export type Recur = 'daily' | 'weekly' | 'monthly' | ''
export type Category = 'medical' | 'home' | 'studies' | 'formal' | 'hobbies' | 'finance' | 'miluim'

export interface Task {
  id: string
  created_at: string
  text: string
  category: Category
  assignee: Assignee
  priority: Priority
  due_date: string | null
  recur: Recur
  note: string
  done: boolean
  done_at: string | null
  stuck_since: string | null
  family_id: string
  related_member_ids: string[]
  source_fact_id: string | null
  source_fact_table: 'vehicles' | 'subscriptions' | null
}

export interface Vehicle {
  id: string
  family_id: string
  make: string
  model: string | null
  year: number | null
  license_plate: string | null
  test_expiry_date: string | null
  insurance_renewal_date: string | null
  insurance_policy_number: string | null
  notes: string | null
}

export interface Subscription {
  id: string
  family_id: string
  name: string
  monthly_cost: number | null
  currency: string
  billing_type: 'monthly' | 'yearly'
  billing_day_of_month: number | null  // for billing_type='monthly': day 1-31
  renewal_date: string | null           // for billing_type='yearly': full date
  account_email: string | null
  notes: string | null
}

export type ScheduleActivityType = 'school' | 'kindergarten' | 'class' | 'meeting'

export interface Schedule {
  id: string
  family_id: string
  child_id: string | null
  activity_type: ScheduleActivityType | null
  activity_name: string
  days_of_week: string[]
  start_time: string | null
  end_time: string | null
  location: string | null
  contact_phone: string | null
  notes: string | null
}

export interface Lesson {
  id: string
  family_id: string
  child_id: string | null
  school_name: string | null
  day_of_week: 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
  start_time: string
  end_time: string
  subject: string
  teacher: string | null
  created_at: string
}

export interface FamilyMember {
  id: string
  family_id: string
  name: string
  nicknames: string[]
  birth_date: string | null
  gender: 'male' | 'female' | null
  is_active: boolean
}

export const CATEGORIES: { id: Category; name: string; icon: string; color: string }[] = [
  { id: 'medical',  name: 'רפואי',                   icon: '🏥', color: 'rose' },
  { id: 'home',     name: 'בית',                     icon: '🏠', color: 'amber' },
  { id: 'studies',  name: 'לימודים',                 icon: '📚', color: 'violet' },
  { id: 'formal',   name: 'ילדים — מסגרות',          icon: '🏫', color: 'blue' },
  { id: 'hobbies',  name: 'ילדים — חוגים וטיפולים', icon: '🎨', color: 'orange' },
  { id: 'finance',  name: 'כספים',                   icon: '💰', color: 'green' },
  { id: 'miluim',   name: 'מילואים',                 icon: '🪖', color: 'slate' },
]

export const CHILDREN = ['הלל', 'רחל', 'נעמי', 'עוז']
