// Database types — aligned with actual Supabase schema

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface CabinEntry {
  class: string
  seats: number
}

export type ModuleName = 'home' | 'network' | 'operations' | 'workforce' | 'reports' | 'admin'
export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'ops_controller'
  | 'crew_controller'
  | 'roster_planner'
  | 'crew_member'
  | 'viewer'
export type UserStatus = 'active' | 'inactive' | 'suspended'

export interface Database {
  public: {
    Tables: {
      operators: {
        Row: {
          id: string
          code: string
          iata_code: string | null
          name: string
          country: string | null
          regulatory_authority: string | null
          fdtl_ruleset: string
          timezone: string
          enabled_modules: Json
          is_active: boolean
          user_id: string | null
          email: string | null
          full_name: string | null
          role: string | null
          status: string | null
          logo_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          iata_code?: string | null
          name: string
          country?: string | null
          regulatory_authority?: string | null
          fdtl_ruleset?: string
          timezone?: string
          enabled_modules?: Json
          is_active?: boolean
          user_id?: string | null
          email?: string | null
          full_name?: string | null
          role?: string | null
          status?: string | null
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          iata_code?: string | null
          name?: string
          country?: string | null
          regulatory_authority?: string | null
          fdtl_ruleset?: string
          timezone?: string
          enabled_modules?: Json
          is_active?: boolean
          user_id?: string | null
          email?: string | null
          full_name?: string | null
          role?: string | null
          status?: string | null
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      module_definitions: {
        Row: {
          id: string
          module_key: string
          module_name: string
          description: string | null
          category: 'core' | 'addon'
          depends_on: string[]
          created_at: string
        }
        Insert: {
          id?: string
          module_key: string
          module_name: string
          description?: string | null
          category: 'core' | 'addon'
          depends_on?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          module_key?: string
          module_name?: string
          description?: string | null
          category?: 'core' | 'addon'
          depends_on?: string[]
          created_at?: string
        }
      }
      airports: {
        Row: {
          id: string
          icao_code: string
          iata_code: string | null
          name: string
          city: string | null
          country: string | null
          country_id: string | null
          timezone: string
          timezone_zone_id: string | null
          utc_offset_hours: number | null
          latitude: number | null
          longitude: number | null
          elevation_ft: number | null
          is_active: boolean
          created_at: string
          longest_runway_length_m: number | null
          longest_runway_width_m: number | null
          runway_identifiers: string | null
          ils_category: string | null
          fire_category: number | null
          slot_classification: string | null
          slot_departure_tolerance_early: number | null
          slot_departure_tolerance_late: number | null
          slot_arrival_tolerance_early: number | null
          slot_arrival_tolerance_late: number | null
          terminals: string | null
          curfew_times: string | null
          crew_reporting_time_minutes: number | null
          crew_debrief_time_minutes: number | null
          is_home_base: boolean
          cannot_be_used_for_diversion: boolean
          weather_limitations: string | null
          notes: string | null
          fuel_available: boolean
          fuel_types: Json | null
          airport_authority: string | null
          operating_hours_open: string | null
          operating_hours_close: string | null
          is_24_hour: boolean
          ground_handling_agents: Json | null
          self_handling_permitted: boolean
          slot_coordinator_contact: string | null
          is_crew_base: boolean
          crew_lounge_available: boolean
          rest_facility_available: boolean
          crew_positioning_reporting_minutes: number | null
          is_etops_alternate: boolean
          etops_diversion_minutes: number | null
          special_notes: string | null
          weather_monitored: boolean
          proxy_weather_station: string | null
        }
        Insert: {
          id?: string
          icao_code: string
          iata_code?: string | null
          name: string
          city?: string | null
          country?: string | null
          country_id?: string | null
          timezone: string
          timezone_zone_id?: string | null
          utc_offset_hours?: number | null
          latitude?: number | null
          longitude?: number | null
          elevation_ft?: number | null
          is_active?: boolean
          created_at?: string
          longest_runway_length_m?: number | null
          longest_runway_width_m?: number | null
          runway_identifiers?: string | null
          ils_category?: string | null
          fire_category?: number | null
          slot_classification?: string | null
          slot_departure_tolerance_early?: number | null
          slot_departure_tolerance_late?: number | null
          slot_arrival_tolerance_early?: number | null
          slot_arrival_tolerance_late?: number | null
          terminals?: string | null
          curfew_times?: string | null
          crew_reporting_time_minutes?: number | null
          crew_debrief_time_minutes?: number | null
          is_home_base?: boolean
          cannot_be_used_for_diversion?: boolean
          weather_limitations?: string | null
          notes?: string | null
          fuel_available?: boolean
          fuel_types?: Json | null
          airport_authority?: string | null
          operating_hours_open?: string | null
          operating_hours_close?: string | null
          is_24_hour?: boolean
          ground_handling_agents?: Json | null
          self_handling_permitted?: boolean
          slot_coordinator_contact?: string | null
          is_crew_base?: boolean
          crew_lounge_available?: boolean
          rest_facility_available?: boolean
          crew_positioning_reporting_minutes?: number | null
          is_etops_alternate?: boolean
          etops_diversion_minutes?: number | null
          special_notes?: string | null
          weather_monitored?: boolean
          proxy_weather_station?: string | null
        }
        Update: {
          id?: string
          icao_code?: string
          iata_code?: string | null
          name?: string
          city?: string | null
          country?: string | null
          country_id?: string | null
          timezone?: string
          timezone_zone_id?: string | null
          utc_offset_hours?: number | null
          latitude?: number | null
          longitude?: number | null
          elevation_ft?: number | null
          is_active?: boolean
          created_at?: string
          longest_runway_length_m?: number | null
          longest_runway_width_m?: number | null
          runway_identifiers?: string | null
          ils_category?: string | null
          fire_category?: number | null
          slot_classification?: string | null
          slot_departure_tolerance_early?: number | null
          slot_departure_tolerance_late?: number | null
          slot_arrival_tolerance_early?: number | null
          slot_arrival_tolerance_late?: number | null
          terminals?: string | null
          curfew_times?: string | null
          crew_reporting_time_minutes?: number | null
          crew_debrief_time_minutes?: number | null
          is_home_base?: boolean
          cannot_be_used_for_diversion?: boolean
          weather_limitations?: string | null
          notes?: string | null
          fuel_available?: boolean
          fuel_types?: Json | null
          airport_authority?: string | null
          operating_hours_open?: string | null
          operating_hours_close?: string | null
          is_24_hour?: boolean
          ground_handling_agents?: Json | null
          self_handling_permitted?: boolean
          slot_coordinator_contact?: string | null
          is_crew_base?: boolean
          crew_lounge_available?: boolean
          rest_facility_available?: boolean
          crew_positioning_reporting_minutes?: number | null
          is_etops_alternate?: boolean
          etops_diversion_minutes?: number | null
          special_notes?: string | null
          weather_monitored?: boolean
          proxy_weather_station?: string | null
        }
      }
      countries: {
        Row: {
          id: string
          iso_code_2: string
          iso_code_3: string
          name: string
          official_name: string | null
          region: string | null
          sub_region: string | null
          icao_prefix: string | null
          currency_code: string | null
          currency_name: string | null
          currency_symbol: string | null
          iso_numeric: string | null
          phone_code: string | null
          flag_emoji: string | null
          latitude: number | null
          longitude: number | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          iso_code_2: string
          iso_code_3?: string
          name: string
          official_name?: string | null
          region?: string | null
          sub_region?: string | null
          icao_prefix?: string | null
          currency_code?: string | null
          currency_name?: string | null
          currency_symbol?: string | null
          iso_numeric?: string | null
          phone_code?: string | null
          flag_emoji?: string | null
          latitude?: number | null
          longitude?: number | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          iso_code_2?: string
          iso_code_3?: string
          name?: string
          official_name?: string | null
          region?: string | null
          sub_region?: string | null
          icao_prefix?: string | null
          currency_code?: string | null
          currency_name?: string | null
          currency_symbol?: string | null
          iso_numeric?: string | null
          phone_code?: string | null
          flag_emoji?: string | null
          latitude?: number | null
          longitude?: number | null
          is_active?: boolean
          created_at?: string
        }
      }
      timezone_zones: {
        Row: {
          id: string
          country_id: string
          zone_code: string
          zone_name: string
          iana_timezone: string
          utc_offset: string
          dst_observed: boolean
          is_active: boolean
          created_at: string
          notes: string | null
        }
        Insert: {
          id?: string
          country_id: string
          zone_code: string
          zone_name: string
          iana_timezone: string
          utc_offset: string
          dst_observed?: boolean
          is_active?: boolean
          created_at?: string
          notes?: string | null
        }
        Update: {
          id?: string
          country_id?: string
          zone_code?: string
          zone_name?: string
          iana_timezone?: string
          utc_offset?: string
          dst_observed?: boolean
          is_active?: boolean
          created_at?: string
          notes?: string | null
        }
      }
      aircraft_types: {
        Row: {
          id: string
          operator_id: string
          icao_type: string
          iata_type: string | null
          name: string
          family: string | null
          category: string
          pax_capacity: number | null
          cockpit_crew_required: number
          cabin_crew_required: number | null
          default_tat_minutes: number | null
          default_cabin_config: Json | null
          is_active: boolean
          created_at: string
          updated_at: string | null
          image_url: string | null
          iata_type_code: string | null
          manufacturer: string | null
          mtow_kg: number | null
          mlw_kg: number | null
          mzfw_kg: number | null
          oew_kg: number | null
          max_fuel_capacity_kg: number | null
          fuel_unit: string | null
          fuel_burn_rate_kg_per_hour: number | null
          max_range_nm: number | null
          cruising_speed_kts: number | null
          cruising_mach: number | null
          min_runway_length_m: number | null
          min_runway_width_m: number | null
          fire_category: number | null
          wake_turbulence_category: string | null
          etops_capable: boolean | null
          etops_max_minutes: number | null
          noise_category: string | null
          emissions_class: string | null
          tat_dom_dom_minutes: number | null
          tat_dom_int_minutes: number | null
          tat_int_dom_minutes: number | null
          tat_int_int_minutes: number | null
          tat_min_dd_minutes: number | null
          tat_min_di_minutes: number | null
          tat_min_id_minutes: number | null
          tat_min_ii_minutes: number | null
          max_cargo_weight_kg: number | null
          cargo_positions: number | null
          uld_types_accepted: Json | null
          bulk_hold_capacity_kg: number | null
          cockpit_rest_facility_class: string | null
          cabin_rest_facility_class: string | null
          cockpit_rest_positions: number | null
          cabin_rest_positions: number | null
          weather_limitations: Json | null
          ils_category_required: string | null
          autoland_capable: boolean | null
          notes: string | null
          color: string | null
        }
        Insert: {
          id?: string
          operator_id: string
          icao_type: string
          iata_type?: string | null
          name: string
          family?: string | null
          category?: string
          pax_capacity?: number | null
          cockpit_crew_required?: number
          cabin_crew_required?: number | null
          default_tat_minutes?: number | null
          default_cabin_config?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
          image_url?: string | null
          iata_type_code?: string | null
          manufacturer?: string | null
          mtow_kg?: number | null
          mlw_kg?: number | null
          mzfw_kg?: number | null
          oew_kg?: number | null
          max_fuel_capacity_kg?: number | null
          fuel_unit?: string | null
          fuel_burn_rate_kg_per_hour?: number | null
          max_range_nm?: number | null
          cruising_speed_kts?: number | null
          cruising_mach?: number | null
          min_runway_length_m?: number | null
          min_runway_width_m?: number | null
          fire_category?: number | null
          wake_turbulence_category?: string | null
          etops_capable?: boolean | null
          etops_max_minutes?: number | null
          noise_category?: string | null
          emissions_class?: string | null
          tat_dom_dom_minutes?: number | null
          tat_dom_int_minutes?: number | null
          tat_int_dom_minutes?: number | null
          tat_int_int_minutes?: number | null
          tat_min_dd_minutes?: number | null
          tat_min_di_minutes?: number | null
          tat_min_id_minutes?: number | null
          tat_min_ii_minutes?: number | null
          max_cargo_weight_kg?: number | null
          cargo_positions?: number | null
          uld_types_accepted?: Json | null
          bulk_hold_capacity_kg?: number | null
          cockpit_rest_facility_class?: string | null
          cabin_rest_facility_class?: string | null
          cockpit_rest_positions?: number | null
          cabin_rest_positions?: number | null
          weather_limitations?: Json | null
          ils_category_required?: string | null
          autoland_capable?: boolean | null
          notes?: string | null
          color?: string | null
        }
        Update: {
          id?: string
          operator_id?: string
          icao_type?: string
          iata_type?: string | null
          name?: string
          family?: string | null
          category?: string
          pax_capacity?: number | null
          cockpit_crew_required?: number
          cabin_crew_required?: number | null
          default_tat_minutes?: number | null
          default_cabin_config?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
          image_url?: string | null
          iata_type_code?: string | null
          manufacturer?: string | null
          mtow_kg?: number | null
          mlw_kg?: number | null
          mzfw_kg?: number | null
          oew_kg?: number | null
          max_fuel_capacity_kg?: number | null
          fuel_unit?: string | null
          fuel_burn_rate_kg_per_hour?: number | null
          max_range_nm?: number | null
          cruising_speed_kts?: number | null
          cruising_mach?: number | null
          min_runway_length_m?: number | null
          min_runway_width_m?: number | null
          fire_category?: number | null
          wake_turbulence_category?: string | null
          etops_capable?: boolean | null
          etops_max_minutes?: number | null
          noise_category?: string | null
          emissions_class?: string | null
          tat_dom_dom_minutes?: number | null
          tat_dom_int_minutes?: number | null
          tat_int_dom_minutes?: number | null
          tat_int_int_minutes?: number | null
          tat_min_dd_minutes?: number | null
          tat_min_di_minutes?: number | null
          tat_min_id_minutes?: number | null
          tat_min_ii_minutes?: number | null
          max_cargo_weight_kg?: number | null
          cargo_positions?: number | null
          uld_types_accepted?: Json | null
          bulk_hold_capacity_kg?: number | null
          cockpit_rest_facility_class?: string | null
          cabin_rest_facility_class?: string | null
          cockpit_rest_positions?: number | null
          cabin_rest_positions?: number | null
          weather_limitations?: Json | null
          ils_category_required?: string | null
          autoland_capable?: boolean | null
          notes?: string | null
          color?: string | null
        }
      }
      aircraft_type_seating_configs: {
        Row: {
          id: string
          aircraft_type_id: string | null
          config_name: string
          cabin_config: Json
          is_default: boolean | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          aircraft_type_id?: string | null
          config_name: string
          cabin_config: Json
          is_default?: boolean | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          aircraft_type_id?: string | null
          config_name?: string
          cabin_config?: Json
          is_default?: boolean | null
          notes?: string | null
          created_at?: string
        }
      }
      aircraft: {
        Row: {
          id: string
          operator_id: string
          registration: string
          aircraft_type_id: string
          status: string
          home_base_id: string | null
          seating_config: Json | null
          is_active: boolean
          created_at: string
          updated_at: string
          selcal: string | null
          serial_number: string | null
          sub_operator: string | null
          date_of_manufacture: string | null
          date_of_delivery: string | null
          lease_expiry_date: string | null
          image_url: string | null
          notes: string | null
          current_location_id: string | null
          current_location_updated_at: string | null
          flight_hours_total: number | null
          cycles_total: number | null
          next_maintenance_due: string | null
          last_maintenance_date: string | null
          last_maintenance_description: string | null
          aircraft_version: string | null
          mtow_kg_override: number | null
          max_range_nm_override: number | null
          cockpit_rest_facility_class_override: string | null
          cabin_rest_facility_class_override: string | null
          cockpit_rest_positions_override: number | null
          cabin_rest_positions_override: number | null
          variant: string | null
          performance_factor: number | null
          is_virtual: boolean
        }
        Insert: {
          id?: string
          operator_id: string
          registration: string
          aircraft_type_id: string
          status?: string
          home_base_id?: string | null
          seating_config?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          selcal?: string | null
          serial_number?: string | null
          sub_operator?: string | null
          date_of_manufacture?: string | null
          date_of_delivery?: string | null
          lease_expiry_date?: string | null
          image_url?: string | null
          notes?: string | null
          current_location_id?: string | null
          current_location_updated_at?: string | null
          flight_hours_total?: number | null
          cycles_total?: number | null
          next_maintenance_due?: string | null
          last_maintenance_date?: string | null
          last_maintenance_description?: string | null
          aircraft_version?: string | null
          mtow_kg_override?: number | null
          max_range_nm_override?: number | null
          cockpit_rest_facility_class_override?: string | null
          cabin_rest_facility_class_override?: string | null
          cockpit_rest_positions_override?: number | null
          cabin_rest_positions_override?: number | null
          variant?: string | null
          performance_factor?: number | null
          is_virtual?: boolean
        }
        Update: {
          id?: string
          operator_id?: string
          registration?: string
          aircraft_type_id?: string
          status?: string
          home_base_id?: string | null
          seating_config?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          selcal?: string | null
          serial_number?: string | null
          sub_operator?: string | null
          date_of_manufacture?: string | null
          date_of_delivery?: string | null
          lease_expiry_date?: string | null
          image_url?: string | null
          notes?: string | null
          current_location_id?: string | null
          current_location_updated_at?: string | null
          flight_hours_total?: number | null
          cycles_total?: number | null
          next_maintenance_due?: string | null
          last_maintenance_date?: string | null
          last_maintenance_description?: string | null
          aircraft_version?: string | null
          mtow_kg_override?: number | null
          max_range_nm_override?: number | null
          cockpit_rest_facility_class_override?: string | null
          cabin_rest_facility_class_override?: string | null
          cockpit_rest_positions_override?: number | null
          cabin_rest_positions_override?: number | null
          variant?: string | null
          performance_factor?: number | null
          is_virtual?: boolean
        }
      }
      aircraft_performance_factors: {
        Row: {
          id: string
          operator_id: string
          aircraft_id: string
          period_name: string
          effective_from: string
          effective_to: string | null
          performance_factor: number
          variant: string | null
          notes: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          operator_id: string
          aircraft_id: string
          period_name: string
          effective_from: string
          effective_to?: string | null
          performance_factor?: number
          variant?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          operator_id?: string
          aircraft_id?: string
          period_name?: string
          effective_from?: string
          effective_to?: string | null
          performance_factor?: number
          variant?: string | null
          notes?: string | null
          updated_at?: string
        }
      }
      aircraft_seating_configs: {
        Row: {
          id: string
          aircraft_id: string
          config_name: string
          effective_from: string
          effective_to: string | null
          cabin_config: Json
          total_capacity: number
          cockpit_rest_facility_class: string | null
          cabin_rest_facility_class: string | null
          cockpit_rest_positions: number | null
          cabin_rest_positions: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          aircraft_id: string
          config_name: string
          effective_from: string
          effective_to?: string | null
          cabin_config: Json
          total_capacity?: number
          cockpit_rest_facility_class?: string | null
          cabin_rest_facility_class?: string | null
          cockpit_rest_positions?: number | null
          cabin_rest_positions?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          aircraft_id?: string
          config_name?: string
          effective_from?: string
          effective_to?: string | null
          cabin_config?: Json
          total_capacity?: number
          cockpit_rest_facility_class?: string | null
          cabin_rest_facility_class?: string | null
          cockpit_rest_positions?: number | null
          cabin_rest_positions?: number | null
          notes?: string | null
          created_at?: string
        }
      }
      airport_tat_rules: {
        Row: {
          id: string
          airport_id: string
          aircraft_type_id: string
          tat_minutes: number
          tat_dom_dom_minutes: number | null
          tat_dom_int_minutes: number | null
          tat_int_dom_minutes: number | null
          tat_int_int_minutes: number | null
          notes: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          airport_id: string
          aircraft_type_id: string
          tat_minutes: number
          tat_dom_dom_minutes?: number | null
          tat_dom_int_minutes?: number | null
          tat_int_dom_minutes?: number | null
          tat_int_int_minutes?: number | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          airport_id?: string
          aircraft_type_id?: string
          tat_minutes?: number
          tat_dom_dom_minutes?: number | null
          tat_dom_int_minutes?: number | null
          tat_int_dom_minutes?: number | null
          tat_int_int_minutes?: number | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      airport_runways: {
        Row: {
          id: string
          airport_id: string
          identifier: string
          length_m: number | null
          width_m: number | null
          surface: string | null
          ils_category: string | null
          lighting: boolean
          status: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          airport_id: string
          identifier: string
          length_m?: number | null
          width_m?: number | null
          surface?: string | null
          ils_category?: string | null
          lighting?: boolean
          status?: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          airport_id?: string
          identifier?: string
          length_m?: number | null
          width_m?: number | null
          surface?: string | null
          ils_category?: string | null
          lighting?: boolean
          status?: string
          notes?: string | null
          created_at?: string
        }
      }
      airport_terminals: {
        Row: {
          id: string
          airport_id: string
          code: string
          name: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          airport_id: string
          code: string
          name?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          airport_id?: string
          code?: string
          name?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      airport_curfews: {
        Row: {
          id: string
          airport_id: string
          days: string
          no_ops_from: string
          no_ops_until: string
          exception: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          airport_id: string
          days?: string
          no_ops_from: string
          no_ops_until: string
          exception?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          airport_id?: string
          days?: string
          no_ops_from?: string
          no_ops_until?: string
          exception?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      airport_frequencies: {
        Row: {
          id: string
          airport_id: string
          type: string
          frequency: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          airport_id: string
          type: string
          frequency: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          airport_id?: string
          type?: string
          frequency?: string
          notes?: string | null
          created_at?: string
        }
      }
      airport_weather_limits: {
        Row: {
          id: string
          airport_id: string
          limitation_type: string
          warning_value: number | null
          alert_value: number | null
          unit: string
          created_at: string
        }
        Insert: {
          id?: string
          airport_id: string
          limitation_type: string
          warning_value?: number | null
          alert_value?: number | null
          unit: string
          created_at?: string
        }
        Update: {
          id?: string
          airport_id?: string
          limitation_type?: string
          warning_value?: number | null
          alert_value?: number | null
          unit?: string
          created_at?: string
        }
      }
      flight_service_types: {
        Row: {
          id: string
          operator_id: string
          code: string
          name: string
          description: string | null
          color: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          operator_id: string
          code: string
          name: string
          description?: string | null
          color?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          operator_id?: string
          code?: string
          name?: string
          description?: string | null
          color?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      delay_codes: {
        Row: {
          id: string
          operator_id: string
          code: string
          category: string
          name: string
          description: string | null
          is_active: boolean
          is_iata_standard: boolean
          created_at: string
        }
        Insert: {
          id?: string
          operator_id: string
          code: string
          category: string
          name: string
          description?: string | null
          is_active?: boolean
          is_iata_standard?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          operator_id?: string
          code?: string
          category?: string
          name?: string
          description?: string | null
          is_active?: boolean
          is_iata_standard?: boolean
          created_at?: string
        }
      }
      cabin_classes: {
        Row: {
          id: string
          operator_id: string | null
          code: string
          name: string
          color: string | null
          sort_order: number | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          operator_id?: string | null
          code: string
          name: string
          color?: string | null
          sort_order?: number | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          operator_id?: string | null
          code?: string
          name?: string
          color?: string | null
          sort_order?: number | null
          is_active?: boolean
          created_at?: string
        }
      }
      airlines: {
        Row: {
          id: string
          icao_code: string
          iata_code: string | null
          name: string
          country: string | null
          country_id: string | null
          alliance: string | null
          callsign: string | null
          operator_id: string | null
          is_own_airline: boolean
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          icao_code: string
          iata_code?: string | null
          name: string
          country?: string | null
          country_id?: string | null
          alliance?: string | null
          callsign?: string | null
          operator_id?: string | null
          is_own_airline?: boolean
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          icao_code?: string
          iata_code?: string | null
          name?: string
          country?: string | null
          country_id?: string | null
          alliance?: string | null
          callsign?: string | null
          operator_id?: string | null
          is_own_airline?: boolean
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string | null
        }
      }
      city_pairs: {
        Row: {
          id: string
          departure_airport_id: string | null
          arrival_airport_id: string | null
          departure_airport: string | null
          arrival_airport: string | null
          standard_block_minutes: number | null
          distance_nm: number | null
          distance_km: number | null
          great_circle_distance_nm: number | null
          block_time: number | null
          distance: number | null
          route_type: string
          is_etops: boolean
          etops_required: boolean
          etops_diversion_time_minutes: number | null
          is_overwater: boolean
          requires_special_qualification: boolean
          status: string
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          departure_airport_id?: string | null
          arrival_airport_id?: string | null
          departure_airport?: string | null
          arrival_airport?: string | null
          standard_block_minutes?: number | null
          distance_nm?: number | null
          distance_km?: number | null
          great_circle_distance_nm?: number | null
          block_time?: number | null
          distance?: number | null
          route_type: string
          is_etops?: boolean
          etops_required?: boolean
          etops_diversion_time_minutes?: number | null
          is_overwater?: boolean
          requires_special_qualification?: boolean
          status?: string
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          departure_airport_id?: string | null
          arrival_airport_id?: string | null
          departure_airport?: string | null
          arrival_airport?: string | null
          standard_block_minutes?: number | null
          distance_nm?: number | null
          distance_km?: number | null
          great_circle_distance_nm?: number | null
          block_time?: number | null
          distance?: number | null
          route_type?: string
          is_etops?: boolean
          etops_required?: boolean
          etops_diversion_time_minutes?: number | null
          is_overwater?: boolean
          requires_special_qualification?: boolean
          status?: string
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
        }
      }
      city_pair_block_hours: {
        Row: {
          id: string
          city_pair_id: string
          aircraft_type_id: string
          season_type: string
          month_applicable: number | null
          direction1_block_minutes: number
          direction2_block_minutes: number
          direction1_flight_minutes: number | null
          direction2_flight_minutes: number | null
          direction1_fuel_kg: number | null
          direction2_fuel_kg: number | null
          direction1_avg_payload_kg: number | null
          direction2_avg_payload_kg: number | null
          cruise_altitude_ft: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          city_pair_id: string
          aircraft_type_id: string
          season_type: string
          month_applicable?: number | null
          direction1_block_minutes: number
          direction2_block_minutes: number
          direction1_flight_minutes?: number | null
          direction2_flight_minutes?: number | null
          direction1_fuel_kg?: number | null
          direction2_fuel_kg?: number | null
          direction1_avg_payload_kg?: number | null
          direction2_avg_payload_kg?: number | null
          cruise_altitude_ft?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          city_pair_id?: string
          aircraft_type_id?: string
          season_type?: string
          month_applicable?: number | null
          direction1_block_minutes?: number
          direction2_block_minutes?: number
          direction1_flight_minutes?: number | null
          direction2_flight_minutes?: number | null
          direction1_fuel_kg?: number | null
          direction2_fuel_kg?: number | null
          direction1_avg_payload_kg?: number | null
          direction2_avg_payload_kg?: number | null
          cruise_altitude_ft?: number | null
          notes?: string | null
          created_at?: string
        }
      }
      schedule_seasons: {
        Row: {
          id: string
          operator_id: string
          code: string
          name: string
          start_date: string
          end_date: string
          status: string
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          operator_id: string
          code: string
          name: string
          start_date: string
          end_date: string
          status?: string
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          operator_id?: string
          code?: string
          name?: string
          start_date?: string
          end_date?: string
          status?: string
          created_at?: string
          updated_at?: string | null
        }
      }
      service_types: {
        Row: {
          id: string
          code: string
          name: string
          description: string | null
          color: string
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          code: string
          name: string
          description?: string | null
          color?: string
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          code?: string
          name?: string
          description?: string | null
          color?: string
          created_at?: string
          updated_at?: string | null
        }
      }
      cabin_configurations: {
        Row: {
          id: string
          aircraft_type: string
          name: string
          cabins: CabinEntry[]
          total_seats: number
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          aircraft_type: string
          name: string
          cabins?: CabinEntry[]
          total_seats: number
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          aircraft_type?: string
          name?: string
          cabins?: CabinEntry[]
          total_seats?: number
          created_at?: string
          updated_at?: string | null
        }
      }
      flight_numbers: {
        Row: {
          id: string
          operator_id: string
          season_id: string | null
          flight_number: string
          departure_iata: string | null
          arrival_iata: string | null
          std: string
          sta: string
          block_minutes: number
          days_of_week: string
          aircraft_type_id: string | null
          service_type: string
          effective_from: string | null
          effective_until: string | null
          arrival_day_offset: number
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          operator_id: string
          season_id?: string | null
          flight_number: string
          departure_iata?: string | null
          arrival_iata?: string | null
          std?: string
          sta?: string
          block_minutes?: number
          days_of_week?: string
          aircraft_type_id?: string | null
          service_type?: string
          effective_from?: string | null
          effective_until?: string | null
          arrival_day_offset?: number
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          operator_id?: string
          season_id?: string | null
          flight_number?: string
          departure_iata?: string | null
          arrival_iata?: string | null
          std?: string
          sta?: string
          block_minutes?: number
          days_of_week?: string
          aircraft_type_id?: string | null
          service_type?: string
          effective_from?: string | null
          effective_until?: string | null
          arrival_day_offset?: number
          created_at?: string
          updated_at?: string | null
        }
      }
      flights: {
        Row: {
          id: string
          operator_id: string
          flight_number_id: string | null
          flight_number: string | null
          flight_date: string
          departure_iata: string | null
          arrival_iata: string | null
          std_utc: string | null
          sta_utc: string | null
          std_local: string
          sta_local: string
          block_minutes: number
          aircraft_type_id: string | null
          aircraft_id: string | null
          service_type: string
          status: string
          arrival_day_offset: number
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          operator_id: string
          flight_number_id?: string | null
          flight_number?: string | null
          flight_date: string
          departure_iata?: string | null
          arrival_iata?: string | null
          std_utc?: string | null
          sta_utc?: string | null
          std_local?: string
          sta_local?: string
          block_minutes?: number
          aircraft_type_id?: string | null
          aircraft_id?: string | null
          service_type?: string
          status?: string
          arrival_day_offset?: number
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          operator_id?: string
          flight_number_id?: string | null
          flight_number?: string | null
          flight_date?: string
          departure_iata?: string | null
          arrival_iata?: string | null
          std_utc?: string | null
          sta_utc?: string | null
          std_local?: string
          sta_local?: string
          block_minutes?: number
          aircraft_type_id?: string | null
          aircraft_id?: string | null
          service_type?: string
          status?: string
          arrival_day_offset?: number
          created_at?: string
          updated_at?: string | null
        }
      }
      ssim_imports: {
        Row: {
          id: string
          operator_id: string
          season_id: string | null
          filename: string | null
          direction: string
          total_records: number
          new_records: number
          updated_records: number
          unchanged_records: number
          error_records: number
          errors: Json
          created_at: string
        }
        Insert: {
          id?: string
          operator_id: string
          season_id?: string | null
          filename?: string | null
          direction?: string
          total_records?: number
          new_records?: number
          updated_records?: number
          unchanged_records?: number
          error_records?: number
          errors?: Json
          created_at?: string
        }
        Update: {
          id?: string
          operator_id?: string
          season_id?: string | null
          filename?: string | null
          direction?: string
          total_records?: number
          new_records?: number
          updated_records?: number
          unchanged_records?: number
          error_records?: number
          errors?: Json
          created_at?: string
        }
      }
      gantt_settings: {
        Row: {
          id: string
          operator_id: string
          settings: Json
          updated_at: string
        }
        Insert: {
          id?: string
          operator_id: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          operator_id?: string
          settings?: Json
          updated_at?: string
        }
      }
      message_log: {
        Row: {
          id: string
          operator_id: string
          message_type: string
          action_code: string | null
          direction: string
          flight_number: string | null
          flight_date: string | null
          departure_station: string | null
          arrival_station: string | null
          source: string | null
          flight_id: string | null
          status: string
          summary: string | null
          raw_message: string | null
          changes: Json | null
          reject_reason: string | null
          processed_at: string | null
          processed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          operator_id: string
          message_type: string
          action_code?: string | null
          direction: string
          flight_number?: string | null
          flight_date?: string | null
          departure_station?: string | null
          arrival_station?: string | null
          source?: string | null
          flight_id?: string | null
          status?: string
          summary?: string | null
          raw_message?: string | null
          changes?: Json | null
          reject_reason?: string | null
          processed_at?: string | null
          processed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          operator_id?: string
          message_type?: string
          action_code?: string | null
          direction?: string
          flight_number?: string | null
          flight_date?: string | null
          departure_station?: string | null
          arrival_station?: string | null
          source?: string | null
          flight_id?: string | null
          status?: string
          summary?: string | null
          raw_message?: string | null
          changes?: Json | null
          reject_reason?: string | null
          processed_at?: string | null
          processed_by?: string | null
          created_at?: string
        }
      }

      weather_observations: {
        Row: {
          id: string
          station_icao: string
          observed_at: string
          raw_metar: string
          wind_direction_deg: number | null
          wind_speed_kts: number | null
          wind_gust_kts: number | null
          wind_variable: boolean
          visibility_meters: number | null
          ceiling_feet: number | null
          flight_category: string
          temperature_c: number | null
          dewpoint_c: number | null
          altimeter_hpa: number | null
          weather_phenomena: string[]
          clouds: Json
          remarks: string | null
          weather_source: string
          proxy_station: string | null
          operator_id: string
          fetched_at: string
        }
        Insert: {
          id?: string
          station_icao: string
          observed_at: string
          raw_metar: string
          wind_direction_deg?: number | null
          wind_speed_kts?: number | null
          wind_gust_kts?: number | null
          wind_variable?: boolean
          visibility_meters?: number | null
          ceiling_feet?: number | null
          flight_category?: string
          temperature_c?: number | null
          dewpoint_c?: number | null
          altimeter_hpa?: number | null
          weather_phenomena?: string[]
          clouds?: Json
          remarks?: string | null
          weather_source?: string
          proxy_station?: string | null
          operator_id: string
          fetched_at?: string
        }
        Update: {
          id?: string
          station_icao?: string
          observed_at?: string
          raw_metar?: string
          wind_direction_deg?: number | null
          wind_speed_kts?: number | null
          wind_gust_kts?: number | null
          wind_variable?: boolean
          visibility_meters?: number | null
          ceiling_feet?: number | null
          flight_category?: string
          temperature_c?: number | null
          dewpoint_c?: number | null
          altimeter_hpa?: number | null
          weather_phenomena?: string[]
          clouds?: Json
          remarks?: string | null
          weather_source?: string
          proxy_station?: string | null
          operator_id?: string
          fetched_at?: string
        }
      }

      weather_forecasts: {
        Row: {
          id: string
          station_icao: string
          issued_at: string
          valid_from: string
          valid_to: string
          raw_taf: string
          forecast_periods: Json
          weather_source: string
          operator_id: string
          fetched_at: string
        }
        Insert: {
          id?: string
          station_icao: string
          issued_at: string
          valid_from: string
          valid_to: string
          raw_taf: string
          forecast_periods?: Json
          weather_source?: string
          operator_id: string
          fetched_at?: string
        }
        Update: {
          id?: string
          station_icao?: string
          issued_at?: string
          valid_from?: string
          valid_to?: string
          raw_taf?: string
          forecast_periods?: Json
          weather_source?: string
          operator_id?: string
          fetched_at?: string
        }
      }

      weather_advisories: {
        Row: {
          id: string
          advisory_id: string
          advisory_type: string
          hazard_type: string | null
          region: string | null
          raw_text: string
          valid_from: string | null
          valid_to: string | null
          geometry: Json | null
          min_altitude_ft: number | null
          max_altitude_ft: number | null
          fetched_at: string
        }
        Insert: {
          id?: string
          advisory_id: string
          advisory_type: string
          hazard_type?: string | null
          region?: string | null
          raw_text: string
          valid_from?: string | null
          valid_to?: string | null
          geometry?: Json | null
          min_altitude_ft?: number | null
          max_altitude_ft?: number | null
          fetched_at?: string
        }
        Update: {
          id?: string
          advisory_id?: string
          advisory_type?: string
          hazard_type?: string | null
          region?: string | null
          raw_text?: string
          valid_from?: string | null
          valid_to?: string | null
          geometry?: Json | null
          min_altitude_ft?: number | null
          max_altitude_ft?: number | null
          fetched_at?: string
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}

export type Operator = Database['public']['Tables']['operators']['Row']
export type Airport = Database['public']['Tables']['airports']['Row']
export type Country = Database['public']['Tables']['countries']['Row']
export type AircraftType = Database['public']['Tables']['aircraft_types']['Row']
export type AircraftTypeSeatingConfig = Database['public']['Tables']['aircraft_type_seating_configs']['Row']
export type Airline = Database['public']['Tables']['airlines']['Row']
export type CityPair = Database['public']['Tables']['city_pairs']['Row']
export type CityPairBlockHours = Database['public']['Tables']['city_pair_block_hours']['Row']
export type ModuleDefinition = Database['public']['Tables']['module_definitions']['Row']
export type ScheduleSeason = Database['public']['Tables']['schedule_seasons']['Row']
export type ServiceType = Database['public']['Tables']['service_types']['Row']
export type CabinConfiguration = Database['public']['Tables']['cabin_configurations']['Row']
export type Aircraft = Database['public']['Tables']['aircraft']['Row']
export type AircraftPerformanceFactor = Database['public']['Tables']['aircraft_performance_factors']['Row']
export type AircraftSeatingConfig = Database['public']['Tables']['aircraft_seating_configs']['Row']
export type AirportTatRule = Database['public']['Tables']['airport_tat_rules']['Row']
export type AirportRunway = Database['public']['Tables']['airport_runways']['Row']
export type AirportTerminal = Database['public']['Tables']['airport_terminals']['Row']
export type AirportCurfew = Database['public']['Tables']['airport_curfews']['Row']
export type AirportFrequency = Database['public']['Tables']['airport_frequencies']['Row']
export type AirportWeatherLimit = Database['public']['Tables']['airport_weather_limits']['Row']
export type FlightServiceType = Database['public']['Tables']['flight_service_types']['Row']
export type DelayCode = Database['public']['Tables']['delay_codes']['Row']
export type CabinClass = Database['public']['Tables']['cabin_classes']['Row']
// FlightNumber is now a virtual type mapped from scheduled_flights
export interface FlightNumber {
  id: string
  operator_id: string
  season_id: string | null
  flight_number: string
  suffix: string | null
  departure_airport_id: string | null
  arrival_airport_id: string | null
  departure_iata: string | null
  arrival_iata: string | null
  std_local: string
  sta_local: string
  std: string
  sta: string
  std_utc: string | null
  sta_utc: string | null
  block_minutes: number
  arrival_day_offset: number
  days_of_operation: string
  days_of_week: string
  aircraft_type_id: string | null
  aircraft_type_icao: string | null
  connecting_flight: string | null
  status: string
  cockpit_crew_required: number | null
  cabin_crew_required: number | null
  service_type: string
  is_etops: boolean
  is_overwater: boolean
  is_active: boolean
  effective_from: string | null
  effective_until: string | null
  created_at: string
  updated_at: string | null
  source: string | null
  scenario_id: string | null
  scenario_name: string | null
  scenario_number: string | null
  previous_status: string | null
  rotation_id: string | null
  rotation_sequence: number | null
  rotation_label: string | null
}
export type Flight = Database['public']['Tables']['flights']['Row']
export type SsimImport = Database['public']['Tables']['ssim_imports']['Row']
export type GanttSettings = Database['public']['Tables']['gantt_settings']['Row']
export type MessageLog = Database['public']['Tables']['message_log']['Row']
export type TimezoneZone = Database['public']['Tables']['timezone_zones']['Row']

export interface ScheduleScenario {
  id: string
  operator_id: string
  scenario_number: string
  scenario_name: string
  description: string | null
  period_start: string
  period_end: string
  season_code: string | null
  is_private: boolean
  created_by: string
  status: 'draft' | 'published' | 'archived'
  published_at: string | null
  published_by: string | null
  created_at: string
  updated_at: string
}

export interface UserPreferences {
  id: string
  user_id: string
  theme: 'light' | 'dark' | 'system'
  dock_position: 'bottom' | 'left' | 'top'
  created_at: string
  updated_at: string
}

export interface CrewPosition {
  id: string
  operator_id: string
  code: string
  name: string
  category: 'cockpit' | 'cabin'
  rank_order: number
  is_pic: boolean
  can_downrank: boolean
  color: string | null
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CrewBase {
  id: string
  operator_id: string
  airport_id: string
  report_location: string | null
  color: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// Joined version for display — airport IS the base identity
export interface CrewBaseWithAirport extends CrewBase {
  airport: {
    id: string
    iata_code: string | null
    icao_code: string
    name: string
    city: string | null
    latitude: number | null
    longitude: number | null
    timezone: string | null
    utc_offset: string | null // formatted e.g. "+07:00", computed from utc_offset_hours
  }
}

// ─── 4.5.4 Activity Codes ─────────────────────────────────────────────────────

export interface ActivityCodeGroup {
  id: string
  operator_id: string
  code: string
  name: string
  color: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ActivityCode {
  id: string
  operator_id: string
  group_id: string
  code: string
  name: string
  description: string | null
  short_label: string | null
  /** Per-code chip color override (hex). Overrides group color in the Gantt when set. */
  color: string | null
  flags: string[]
  credit_ratio: number | null
  credit_fixed_min: number | null
  pay_ratio: number | null
  min_rest_before_min: number | null
  min_rest_after_min: number | null
  sim_platform: string | null
  sim_duration_min: number | null
  default_duration_min: number | null
  requires_time: boolean
  default_start_time: string | null
  default_end_time: string | null
  applicable_positions: string[]
  is_system: boolean
  is_active: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface ActivityCodeWithGroup extends ActivityCode {
  group: ActivityCodeGroup
}

// ─── 4.5.3 Expiry Codes ───────────────────────────────────────────────────────

export interface ExpiryCodeCategory {
  id: string
  operator_id: string
  key: string
  label: string
  description: string | null
  color: string
  sort_order: number
  created_at: string
}

export type ExpiryFormula =
  | 'manual'
  | 'fixed_validity'
  | 'easa_ops'
  | 'age_variation'
  | 'takeoff_landing'
  | 'ac_type_recency'
  | 'airport_category'
  | 'accumulated_hours'
  | 'opc_alternating'
  | 'route_check'
  | 'instrument_flying'
  | 'citypairs'
  | 'country_visa'

export type ExpirySeverityKey =
  | 'block_auto_assign'
  | 'block_manual_assign'
  | 'include_in_reports'
  | 'show_validation_warning'
  | 'expire_on_failure'
  | 'auto_renew'

export interface ExpiryCode {
  id: string
  operator_id: string
  category_id: string
  code: string
  name: string
  description: string | null
  crew_category: 'both' | 'cockpit' | 'cabin'
  applicable_positions: string[]
  formula: ExpiryFormula
  formula_params: Record<string, any>
  ac_type_specific: boolean
  ac_type_scope: 'none' | 'family' | 'variant'
  linked_training_code: string | null
  warning_days: number | null
  severity: ExpirySeverityKey[]
  notes: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ExpiryCodeWithCategory extends ExpiryCode {
  category: ExpiryCodeCategory
}

export type CrewComplementTemplateKey = 'standard' | 'aug1' | 'aug2'

export interface CrewGroup {
  id: string
  operator_id: string
  sort_order: number
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface DutyPattern {
  id: string
  operator_id: string
  sort_order: number
  code: string
  description: string | null
  sequence: number[]
  cycle_days: number
  off_code: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface CrewComplement {
  id: string
  operator_id: string
  aircraft_type: string
  template_key: string
  counts: Record<string, number> // e.g. { CP: 1, FO: 1, CA: 3 } — keyed by position code from 4.5.1
  notes: string | null
  created_at: string
  updated_at: string
}

// ─── 3.1.1 Crew Profile ───────────────────────────────────────────────────────

export interface CrewMember {
  id: string
  operator_id: string
  employee_id: string
  first_name: string
  middle_name: string | null
  last_name: string
  short_code: string | null
  gender: 'male' | 'female' | 'other' | null
  date_of_birth: string | null
  nationality: string | null
  base: string | null
  position: string | null
  status: 'active' | 'inactive' | 'suspended' | 'terminated'
  employment_date: string | null
  exit_date: string | null
  exit_reason: string | null
  contract_type: string | null
  seniority: number | null
  seniority_group: number
  languages: string[]
  apis_alias: string | null
  country_of_residence: string | null
  residence_permit_no: string | null
  email_primary: string | null
  email_secondary: string | null
  address_line1: string | null
  address_line2: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
  address_country: string | null
  emergency_name: string | null
  emergency_relationship: string | null
  emergency_phone: string | null
  no_accommodation_airports: string[]
  transport_required: boolean
  hotel_at_home_base: boolean
  travel_time_minutes: number | null
  payroll_number: string | null
  min_guarantee: string | null
  fly_with_senior_until: string | null
  do_not_schedule_alt_position: string | null
  standby_exempted: boolean
  crew_under_training: boolean
  no_domestic_flights: boolean
  no_international_flights: boolean
  max_layover_stops: number | null
  photo_url: string | null
  created_at: string
  updated_at: string
}

export interface CrewPhone {
  id: string
  crew_id: string
  priority: number
  type: string
  number: string
  sms_enabled: boolean
}

export interface CrewPassport {
  id: string
  crew_id: string
  number: string
  country: string
  nationality: string | null
  place_of_issue: string | null
  issue_date: string | null
  expiry: string
  is_active: boolean
}

export interface CrewLicense {
  id: string
  crew_id: string
  number: string
  type: string
  country: string | null
  place_of_issue: string | null
  issue_date: string | null
  temporary: boolean
}

export interface CrewVisa {
  id: string
  crew_id: string
  country: string
  type: string | null
  number: string | null
  issue_date: string | null
  expiry: string
}

export interface CrewQualification {
  id: string
  crew_id: string
  base: string | null
  aircraft_type: string
  position: string
  start_date: string
  end_date: string | null
  is_primary: boolean
  ac_family_qualified: boolean
  training_quals: string[]
}

export interface CrewExpiryDate {
  id: string
  crew_id: string
  expiry_code_id: string
  aircraft_type: string // '' = not type-specific; populated for family/variant-scoped codes
  last_done: string | null
  base_month: string | null
  expiry_date: string | null
  next_planned: string | null
  notes: string | null
}

export interface CrewExpiryDateFull extends CrewExpiryDate {
  code_label: string
  code_name: string
  category_key: string
  category_label: string
  category_color: string
  status: 'valid' | 'warning' | 'expired' | 'unknown'
}

export interface CrewGroupAssignment {
  id: string
  crew_id: string
  group_id: string
  start_date: string | null
  end_date: string | null
}

export interface CrewGroupAssignmentFull extends CrewGroupAssignment {
  group_name: string
}

export interface CrewRuleset {
  id: string
  crew_id: string
  name: string
  start_date: string
  end_date: string | null
}

export interface CrewOnOffPattern {
  id: string
  crew_id: string
  pattern_type: string
  start_date: string
  end_date: string | null
  starting_day: number
}

export interface CrewAirportRestriction {
  id: string
  crew_id: string
  airport: string
  type: 'RESTRICTED' | 'PREFERRED'
  start_date: string | null
  end_date: string | null
}

export interface CrewPairing {
  id: string
  crew_id: string
  type: 'Same' | 'Not same'
  what: 'Flights' | 'Offs'
  paired_crew_id: string
  start_date: string | null
  end_date: string | null
}

export interface CrewPairingFull extends CrewPairing {
  paired_crew_name: string
}

export interface CrewBlockHours {
  id: string
  crew_id: string
  aircraft_type: string
  position: string
  block_hours: string | null
  training_hours: string | null
  first_flight: string | null
  last_flight: string | null
}

export interface FullCrewProfile {
  member: CrewMember
  base_label: string | null // airports.iata_code via crew_bases join
  phones: CrewPhone[]
  passports: CrewPassport[]
  licenses: CrewLicense[]
  visas: CrewVisa[]
  qualifications: CrewQualification[]
  expiry_dates: CrewExpiryDateFull[]
  group_assignments: CrewGroupAssignmentFull[]
  rulesets: CrewRuleset[]
  on_off_patterns: CrewOnOffPattern[]
  airport_restrictions: CrewAirportRestriction[]
  pairings: CrewPairingFull[]
  block_hours: CrewBlockHours[]
}

export interface CrewMemberListItem extends CrewMember {
  ac_types: string[]
  expiry_alert_count: number
  base_label: string | null // airports.iata_code via crew_bases join
}

// ─── 3.1.2 Crew Documents ─────────────────────────────────────────────────────

export interface CrewDocument {
  id: string
  crew_id: string
  operator_id: string
  folder_id: string | null
  expiry_code_id: string | null
  document_type: 'photo' | 'passport_scan' | 'other'
  file_url: string
  file_path: string | null
  file_name: string
  file_size: number | null
  mime_type: string | null
  notes: string | null
  expires_at: string | null
  uploaded_at: string
  created_at: string
  updated_at: string
}

export interface CrewDocumentFolder {
  id: string
  operator_id: string
  parent_id: string | null
  name: string
  slug: string
  is_system: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CrewDocumentFolderWithCounts extends CrewDocumentFolder {
  document_count: number
  subfolder_count: number
}

export interface CrewDocumentStatus {
  id: string
  employee_id: string
  first_name: string
  middle_name: string | null
  last_name: string
  position: string | null
  status: 'active' | 'inactive' | 'suspended' | 'terminated'
  photo_url: string | null
  base_label: string | null
  has_photo: boolean
  has_passport_scan: boolean
  coverage: number // 0-100
}
