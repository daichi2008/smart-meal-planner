export interface User {
  id: string
  email: string
  full_name: string | null
  plan: 'free' | 'pro'
  calorie_target: number | null
  dietary_preferences: string | null
  is_active: boolean
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface FridgeItem {
  id: string
  name: string
  quantity: number
  unit: string | null
  category: string | null
  expires_at: string | null
  created_at: string
}

export interface Recipe {
  title: string
  summary: string
  calories_per_serving: number | null
  prep_time_minutes: number | null
  servings: number
  ingredients: string[]
  steps: string[]
  macros: { protein: number; carbs: number; fat: number } | null
  tags: string[] | null
  missing_ingredients: string[] | null
  tip: string | null
}

export interface RecipeSuggestionResponse {
  recipes: Recipe[]
  source: 'ai' | 'cache'
}

export interface SavedRecipe {
  id: string
  title: string
  summary: string | null
  created_at: string
  recipe: Recipe
}

export interface Plan {
  id: string
  name: string
  price_cents: number
  features: string[]
}

export interface SubscriptionInfo {
  plan: 'free' | 'pro'
  is_pro: boolean
  status: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
}
