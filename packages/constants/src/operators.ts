/**
 * Extended operator type with user role information
 */
export interface OperatorWithRole {
  id: string
  code: string
  iata_code: string | null
  name: string
  country: string
  regulatory_authority: string
  timezone: string
  enabled_modules: string[]
  logo_url: string | null
  created_at: string
  updated_at: string
  // User-specific role from user_roles table
  user_role?: string | null
  user_role_id?: string | null
}

// TODO: Replace with mobile auth + Supabase client when ready
// Previously: getCurrentOperator() used React cache(), getAuthUser(), cookies(), createAdminClient()
// to fetch the current operator with user role from Supabase.

/**
 * Module name type (previously imported from @/types/database)
 */
export type ModuleName = 'home' | 'network' | 'operations' | 'ground' | 'workforce' | 'integration' | 'admin'

/**
 * Check if operator has access to a specific module
 */
export function hasModuleAccess(operator: OperatorWithRole | null, module: ModuleName): boolean {
  if (!operator) return false

  // Home is always accessible
  if (module === 'home') return true

  // Admin module requires admin or super_admin role
  if (module === 'admin') {
    return operator.user_role === 'admin' || operator.user_role === 'super_admin'
  }

  // Check enabled_modules (cast to ModuleName[] for type safety)
  return (operator.enabled_modules as ModuleName[]).includes(module)
}

/**
 * Get all accessible modules for an operator
 */
export function getAccessibleModules(operator: OperatorWithRole | null): ModuleName[] {
  if (!operator) return ['home']

  const modules: ModuleName[] = ['home']

  // Add enabled modules
  operator.enabled_modules.forEach((module) => {
    if (!modules.includes(module as ModuleName)) {
      modules.push(module as ModuleName)
    }
  })

  // Admin module for admin and super_admin roles
  if ((operator.user_role === 'admin' || operator.user_role === 'super_admin') && !modules.includes('admin')) {
    modules.push('admin')
  }

  return modules
}

/**
 * Check if operator is admin (includes super_admin)
 */
export function isAdmin(operator: OperatorWithRole | null): boolean {
  return operator?.user_role === 'admin' || operator?.user_role === 'super_admin'
}

/**
 * Check if operator is super admin
 */
export function isSuperAdmin(operator: OperatorWithRole | null): boolean {
  return operator?.user_role === 'super_admin'
}
