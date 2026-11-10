export type DecisionStatus = 'idea' | 'validate' | 'approved' | 'building' | 'launched' | 'parked'

export type DecisionInput = {
  title: string
  description: string
  category: string
  status: DecisionStatus
  reach: number
  impact: number
  confidence: number
  build_hours: number
  monthly_hours: number
  hourly_cost: number
  energy: number
  price_per_customer: number
  variable_cost_per_customer: number
  fixed_monthly_cost: number
  customers_low: number
  customers_base: number
  customers_high: number
  validation_note: string
}

export type DecisionProject = DecisionInput & {
  id: string
  owner_id: string
  created_at: string
  updated_at: string
}

export type DecisionTask = {
  id: string
  project_id: string
  owner_id: string
  title: string
  status: 'planned' | 'in_progress' | 'done'
  created_at: string
}

export const DEFAULT_DECISION: DecisionInput = {
  title: '',
  description: '',
  category: 'Vedøy Studio',
  status: 'idea',
  reach: 50,
  impact: 1,
  confidence: 40,
  build_hours: 24,
  monthly_hours: 5,
  hourly_cost: 250,
  energy: 3,
  price_per_customer: 500,
  variable_cost_per_customer: 100,
  fixed_monthly_cost: 500,
  customers_low: 1,
  customers_base: 5,
  customers_high: 12,
  validation_note: '',
}

const safe = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0

export function riceScore(project: DecisionInput): number {
  if (project.build_hours <= 0) return 0
  const confidence = Math.min(100, safe(project.confidence)) / 100
  return Math.round((safe(project.reach) * safe(project.impact) * confidence / project.build_hours) * 100) / 100
}

export function estimateProfit(project: DecisionInput, customers: number) {
  const count = Math.floor(safe(customers))
  const revenue = count * safe(project.price_per_customer)
  const directCosts = count * safe(project.variable_cost_per_customer)
  const fixedCosts = safe(project.fixed_monthly_cost)
  const laborCosts = safe(project.monthly_hours) * safe(project.hourly_cost)
  const profit = revenue - directCosts - fixedCosts - laborCosts
  const investment = safe(project.build_hours) * safe(project.hourly_cost)
  return {
    customers: count,
    revenue,
    directCosts,
    fixedCosts,
    laborCosts,
    profit,
    margin: revenue > 0 ? profit / revenue : null,
    investment,
    paybackMonths: profit > 0 && investment > 0 ? investment / profit : null,
  }
}

export function breakEvenCustomers(project: DecisionInput): number | null {
  const contributionPerCustomer = safe(project.price_per_customer) - safe(project.variable_cost_per_customer)
  if (contributionPerCustomer <= 0) return null
  const monthlyCosts = safe(project.fixed_monthly_cost) + safe(project.monthly_hours) * safe(project.hourly_cost)
  return Math.ceil(monthlyCosts / contributionPerCustomer)
}

export function priorityAdvice(project: DecisionInput): string[] {
  const base = estimateProfit(project, project.customers_base)
  const advice: string[] = []
  if (!project.validation_note.trim()) advice.push('Snakk med potensielle kunder og dokumenter betalingsvilje før byggestart.')
  if (project.confidence < 60) advice.push('Usikkert estimat: test pris og etterspørsel med en liten pilot.')
  if (base.profit <= 0) advice.push('Basisscenarioet er ikke lønnsomt. Reduser kostnader eller øk dekningsbidraget.')
  if (project.energy >= 4) advice.push('Høyt energibehov: del arbeidet opp og reduser omfanget for første leveranse.')
  if (project.build_hours > 60) advice.push('Stor engangsinnsats: vurder en mindre MVP før full utvikling.')
  if (advice.length === 0) advice.push('Tallene ser lovende ut. Test antakelsene med ekte kunder før større investering.')
  return advice
}

export const INITIAL_APPROVAL_TASKS = [
  'Snakk med minst tre aktuelle kunder',
  'Test betalingsvilje med et konkret tilbud',
  'Definer en liten leveranse med akseptansekriterier',
]
