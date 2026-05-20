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
