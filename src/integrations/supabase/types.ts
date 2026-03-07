export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_date: string
          check_in_time: string | null
          created_at: string
          diagnosis: string | null
          doctor_name: string
          doctor_notes: string | null
          follow_up_date: string | null
          hospital_id: string
          id: string
          opd_type: string
          patient_id: string | null
          patient_name: string
          registration_number: string
          status: string
          time_slot: string | null
          token_no: number
          updated_at: string
        }
        Insert: {
          appointment_date?: string
          check_in_time?: string | null
          created_at?: string
          diagnosis?: string | null
          doctor_name: string
          doctor_notes?: string | null
          follow_up_date?: string | null
          hospital_id: string
          id?: string
          opd_type?: string
          patient_id?: string | null
          patient_name: string
          registration_number: string
          status?: string
          time_slot?: string | null
          token_no: number
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          check_in_time?: string | null
          created_at?: string
          diagnosis?: string | null
          doctor_name?: string
          doctor_notes?: string | null
          follow_up_date?: string | null
          hospital_id?: string
          id?: string
          opd_type?: string
          patient_id?: string | null
          patient_name?: string
          registration_number?: string
          status?: string
          time_slot?: string | null
          token_no?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          attendance_date: string
          check_in: string | null
          check_out: string | null
          created_at: string
          hospital_id: string
          hours_worked: number | null
          id: string
          notes: string | null
          overtime_hours: number | null
          staff_id: string
          staff_name: string
          status: string
        }
        Insert: {
          attendance_date?: string
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          hospital_id: string
          hours_worked?: number | null
          id?: string
          notes?: string | null
          overtime_hours?: number | null
          staff_id: string
          staff_name: string
          status?: string
        }
        Update: {
          attendance_date?: string
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          hospital_id?: string
          hours_worked?: number | null
          id?: string
          notes?: string | null
          overtime_hours?: number | null
          staff_id?: string
          staff_name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      bed_transfers: {
        Row: {
          admission_id: string
          created_at: string
          from_bed: string
          from_ward: string
          hospital_id: string
          id: string
          patient_name: string
          reason: string | null
          to_bed: string
          to_ward: string
          transfer_date: string
          transferred_by: string | null
        }
        Insert: {
          admission_id: string
          created_at?: string
          from_bed: string
          from_ward: string
          hospital_id: string
          id?: string
          patient_name: string
          reason?: string | null
          to_bed: string
          to_ward: string
          transfer_date?: string
          transferred_by?: string | null
        }
        Update: {
          admission_id?: string
          created_at?: string
          from_bed?: string
          from_ward?: string
          hospital_id?: string
          id?: string
          patient_name?: string
          reason?: string | null
          to_bed?: string
          to_ward?: string
          transfer_date?: string
          transferred_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bed_transfers_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "ipd_admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bed_transfers_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      beds: {
        Row: {
          admission_id: string | null
          bed_number: string
          created_at: string
          hospital_id: string
          id: string
          patient_id: string | null
          status: string
          ward_id: string
        }
        Insert: {
          admission_id?: string | null
          bed_number: string
          created_at?: string
          hospital_id: string
          id?: string
          patient_id?: string | null
          status?: string
          ward_id: string
        }
        Update: {
          admission_id?: string | null
          bed_number?: string
          created_at?: string
          hospital_id?: string
          id?: string
          patient_id?: string | null
          status?: string
          ward_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beds_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "ipd_admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beds_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beds_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beds_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      daycare_bill_items: {
        Row: {
          bill_id: string
          category: string | null
          description: string
          hospital_id: string
          id: string
          qty: number | null
          total: number | null
          unit_price: number | null
        }
        Insert: {
          bill_id: string
          category?: string | null
          description: string
          hospital_id: string
          id?: string
          qty?: number | null
          total?: number | null
          unit_price?: number | null
        }
        Update: {
          bill_id?: string
          category?: string | null
          description?: string
          hospital_id?: string
          id?: string
          qty?: number | null
          total?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daycare_bill_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "daycare_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daycare_bill_items_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      daycare_bills: {
        Row: {
          created_at: string
          discount: number | null
          grand_total: number | null
          hospital_id: string
          id: string
          payment_mode: string | null
          payment_status: string | null
          session_id: string
          subtotal: number | null
          tax: number | null
        }
        Insert: {
          created_at?: string
          discount?: number | null
          grand_total?: number | null
          hospital_id: string
          id?: string
          payment_mode?: string | null
          payment_status?: string | null
          session_id: string
          subtotal?: number | null
          tax?: number | null
        }
        Update: {
          created_at?: string
          discount?: number | null
          grand_total?: number | null
          hospital_id?: string
          id?: string
          payment_mode?: string | null
          payment_status?: string | null
          session_id?: string
          subtotal?: number | null
          tax?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daycare_bills_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daycare_bills_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "daycare_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      daycare_session_treatments: {
        Row: {
          end_time: string | null
          hospital_id: string
          id: string
          notes: string | null
          session_id: string
          start_time: string | null
          status: string
          treatment_id: string | null
          treatment_name: string
        }
        Insert: {
          end_time?: string | null
          hospital_id: string
          id?: string
          notes?: string | null
          session_id: string
          start_time?: string | null
          status?: string
          treatment_id?: string | null
          treatment_name: string
        }
        Update: {
          end_time?: string | null
          hospital_id?: string
          id?: string
          notes?: string | null
          session_id?: string
          start_time?: string | null
          status?: string
          treatment_id?: string | null
          treatment_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "daycare_session_treatments_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daycare_session_treatments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "daycare_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daycare_session_treatments_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "daycare_treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      daycare_sessions: {
        Row: {
          admission_time: string | null
          age: number | null
          created_at: string
          diagnosis: string | null
          doctor_name: string
          gender: string | null
          hospital_id: string
          id: string
          mobile: string | null
          patient_id: string | null
          patient_name: string
          registration_number: string
          session_date: string
          status: string
          updated_at: string
        }
        Insert: {
          admission_time?: string | null
          age?: number | null
          created_at?: string
          diagnosis?: string | null
          doctor_name: string
          gender?: string | null
          hospital_id: string
          id?: string
          mobile?: string | null
          patient_id?: string | null
          patient_name: string
          registration_number: string
          session_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          admission_time?: string | null
          age?: number | null
          created_at?: string
          diagnosis?: string | null
          doctor_name?: string
          gender?: string | null
          hospital_id?: string
          id?: string
          mobile?: string | null
          patient_id?: string | null
          patient_name?: string
          registration_number?: string
          session_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daycare_sessions_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daycare_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      daycare_treatments: {
        Row: {
          category: string
          created_at: string
          description: string | null
          duration: string | null
          hospital_id: string
          id: string
          name: string
          price: number | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          duration?: string | null
          hospital_id: string
          id?: string
          name: string
          price?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          duration?: string | null
          hospital_id?: string
          id?: string
          name?: string
          price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daycare_treatments_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_entries: {
        Row: {
          admission_id: string
          cost: number | null
          created_at: string
          entry_date: string
          hospital_id: string
          id: string
          result: string | null
          test_name: string
        }
        Insert: {
          admission_id: string
          cost?: number | null
          created_at?: string
          entry_date?: string
          hospital_id: string
          id?: string
          result?: string | null
          test_name: string
        }
        Update: {
          admission_id?: string
          cost?: number | null
          created_at?: string
          entry_date?: string
          hospital_id?: string
          id?: string
          result?: string | null
          test_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_entries_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "ipd_admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_entries_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      discharge_summaries: {
        Row: {
          admission_id: string
          condition_at_discharge: string | null
          created_at: string
          discharge_date: string
          final_diagnosis: string | null
          follow_up_date: string | null
          follow_up_instructions: string | null
          hospital_id: string
          id: string
          medications_on_discharge: string | null
          paid_amount: number | null
          payment_status: string | null
          total_bill: number | null
          treatment_summary: string | null
        }
        Insert: {
          admission_id: string
          condition_at_discharge?: string | null
          created_at?: string
          discharge_date?: string
          final_diagnosis?: string | null
          follow_up_date?: string | null
          follow_up_instructions?: string | null
          hospital_id: string
          id?: string
          medications_on_discharge?: string | null
          paid_amount?: number | null
          payment_status?: string | null
          total_bill?: number | null
          treatment_summary?: string | null
        }
        Update: {
          admission_id?: string
          condition_at_discharge?: string | null
          created_at?: string
          discharge_date?: string
          final_diagnosis?: string | null
          follow_up_date?: string | null
          follow_up_instructions?: string | null
          hospital_id?: string
          id?: string
          medications_on_discharge?: string | null
          paid_amount?: number | null
          payment_status?: string | null
          total_bill?: number | null
          treatment_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discharge_summaries_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "ipd_admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discharge_summaries_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_schedules: {
        Row: {
          available_from: string | null
          available_to: string | null
          consultation_duration: number | null
          created_at: string
          doctor_name: string
          hospital_id: string
          id: string
          schedule_date: string
          specialization: string | null
          updated_at: string
        }
        Insert: {
          available_from?: string | null
          available_to?: string | null
          consultation_duration?: number | null
          created_at?: string
          doctor_name: string
          hospital_id: string
          id?: string
          schedule_date?: string
          specialization?: string | null
          updated_at?: string
        }
        Update: {
          available_from?: string | null
          available_to?: string | null
          consultation_duration?: number | null
          created_at?: string
          doctor_name?: string
          hospital_id?: string
          id?: string
          schedule_date?: string
          specialization?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_schedules_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_visit_notes: {
        Row: {
          admission_id: string
          created_at: string
          doctor: string
          hospital_id: string
          id: string
          instructions: string | null
          notes: string | null
          visit_date: string
          visit_time: string | null
        }
        Insert: {
          admission_id: string
          created_at?: string
          doctor: string
          hospital_id: string
          id?: string
          instructions?: string | null
          notes?: string | null
          visit_date?: string
          visit_time?: string | null
        }
        Update: {
          admission_id?: string
          created_at?: string
          doctor?: string
          hospital_id?: string
          id?: string
          instructions?: string | null
          notes?: string | null
          visit_date?: string
          visit_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_visit_notes_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "ipd_admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_visit_notes_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitals: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          license_number: string | null
          name: string
          phone: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          license_number?: string | null
          name: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          license_number?: string | null
          name?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          barcode: string | null
          batch_no: string | null
          category: string
          consumption_rate: number | null
          created_at: string
          department: string | null
          expiry_date: string | null
          gst_percent: number | null
          hospital_id: string
          hsn_code: string | null
          id: string
          manufacturer: string | null
          min_stock: number | null
          name: string
          purchase_date: string | null
          selling_price: number | null
          sku: string | null
          stock: number
          unit: string | null
          unit_price: number | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          barcode?: string | null
          batch_no?: string | null
          category?: string
          consumption_rate?: number | null
          created_at?: string
          department?: string | null
          expiry_date?: string | null
          gst_percent?: number | null
          hospital_id: string
          hsn_code?: string | null
          id?: string
          manufacturer?: string | null
          min_stock?: number | null
          name: string
          purchase_date?: string | null
          selling_price?: number | null
          sku?: string | null
          stock?: number
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          barcode?: string | null
          batch_no?: string | null
          category?: string
          consumption_rate?: number | null
          created_at?: string
          department?: string | null
          expiry_date?: string | null
          gst_percent?: number | null
          hospital_id?: string
          hsn_code?: string | null
          id?: string
          manufacturer?: string | null
          min_stock?: number | null
          name?: string
          purchase_date?: string | null
          selling_price?: number | null
          sku?: string | null
          stock?: number
          unit?: string | null
          unit_price?: number | null
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      ipd_admissions: {
        Row: {
          admission_date: string
          admitting_doctor: string
          age: number | null
          bed_id: string | null
          bed_number: string | null
          contact_number: string | null
          created_at: string
          department: string | null
          diagnosis: string | null
          discharge_date: string | null
          emergency_contact: string | null
          gender: string | null
          hospital_id: string
          id: string
          insurance_info: string | null
          patient_id: string | null
          patient_name: string
          referred_by: string | null
          registration_number: string
          status: string
          updated_at: string
          ward_id: string | null
          ward_name: string | null
        }
        Insert: {
          admission_date?: string
          admitting_doctor: string
          age?: number | null
          bed_id?: string | null
          bed_number?: string | null
          contact_number?: string | null
          created_at?: string
          department?: string | null
          diagnosis?: string | null
          discharge_date?: string | null
          emergency_contact?: string | null
          gender?: string | null
          hospital_id: string
          id?: string
          insurance_info?: string | null
          patient_id?: string | null
          patient_name: string
          referred_by?: string | null
          registration_number: string
          status?: string
          updated_at?: string
          ward_id?: string | null
          ward_name?: string | null
        }
        Update: {
          admission_date?: string
          admitting_doctor?: string
          age?: number | null
          bed_id?: string | null
          bed_number?: string | null
          contact_number?: string | null
          created_at?: string
          department?: string | null
          diagnosis?: string | null
          discharge_date?: string | null
          emergency_contact?: string | null
          gender?: string | null
          hospital_id?: string
          id?: string
          insurance_info?: string | null
          patient_id?: string | null
          patient_name?: string
          referred_by?: string | null
          registration_number?: string
          status?: string
          updated_at?: string
          ward_id?: string | null
          ward_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ipd_admissions_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipd_admissions_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipd_admissions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ipd_admissions_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "wards"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_orders: {
        Row: {
          appointment_id: string | null
          category: string
          clinical_notes: string | null
          completed_at: string | null
          created_at: string
          hospital_id: string
          id: string
          ordered_at: string
          ordered_by: string
          patient_name: string
          patient_reg_no: string
          payment_mode: string | null
          payment_status: string | null
          price: number
          priority: string
          report_notes: string | null
          sample_collected_at: string | null
          status: string
          test_name: string
        }
        Insert: {
          appointment_id?: string | null
          category?: string
          clinical_notes?: string | null
          completed_at?: string | null
          created_at?: string
          hospital_id: string
          id?: string
          ordered_at?: string
          ordered_by: string
          patient_name: string
          patient_reg_no: string
          payment_mode?: string | null
          payment_status?: string | null
          price?: number
          priority?: string
          report_notes?: string | null
          sample_collected_at?: string | null
          status?: string
          test_name: string
        }
        Update: {
          appointment_id?: string | null
          category?: string
          clinical_notes?: string | null
          completed_at?: string | null
          created_at?: string
          hospital_id?: string
          id?: string
          ordered_at?: string
          ordered_by?: string
          patient_name?: string
          patient_reg_no?: string
          payment_mode?: string | null
          payment_status?: string | null
          price?: number
          priority?: string
          report_notes?: string | null
          sample_collected_at?: string | null
          status?: string
          test_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_orders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_results: {
        Row: {
          hospital_id: string
          id: string
          is_abnormal: boolean | null
          lab_order_id: string
          normal_range: string | null
          parameter: string
          unit: string | null
          value: string | null
        }
        Insert: {
          hospital_id: string
          id?: string
          is_abnormal?: boolean | null
          lab_order_id: string
          normal_range?: string | null
          parameter: string
          unit?: string | null
          value?: string | null
        }
        Update: {
          hospital_id?: string
          id?: string
          is_abnormal?: boolean | null
          lab_order_id?: string
          normal_range?: string | null
          parameter?: string
          unit?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_results_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_lab_order_id_fkey"
            columns: ["lab_order_id"]
            isOneToOne: false
            referencedRelation: "lab_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_test_catalog: {
        Row: {
          category: string
          created_at: string
          hospital_id: string
          id: string
          name: string
          price: number
        }
        Insert: {
          category?: string
          created_at?: string
          hospital_id: string
          id?: string
          name: string
          price?: number
        }
        Update: {
          category?: string
          created_at?: string
          hospital_id?: string
          id?: string
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "lab_test_catalog_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_test_parameters: {
        Row: {
          hospital_id: string
          id: string
          name: string
          normal_range: string | null
          test_id: string
          unit: string | null
        }
        Insert: {
          hospital_id: string
          id?: string
          name: string
          normal_range?: string | null
          test_id: string
          unit?: string | null
        }
        Update: {
          hospital_id?: string
          id?: string
          name?: string
          normal_range?: string | null
          test_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_test_parameters_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_test_parameters_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "lab_test_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          applied_date: string
          approved_by: string | null
          created_at: string
          days: number
          from_date: string
          hospital_id: string
          id: string
          leave_type: string
          reason: string | null
          staff_id: string
          staff_name: string
          status: string | null
          to_date: string
        }
        Insert: {
          applied_date?: string
          approved_by?: string | null
          created_at?: string
          days?: number
          from_date: string
          hospital_id: string
          id?: string
          leave_type?: string
          reason?: string | null
          staff_id: string
          staff_name: string
          status?: string | null
          to_date: string
        }
        Update: {
          applied_date?: string
          approved_by?: string | null
          created_at?: string
          days?: number
          from_date?: string
          hospital_id?: string
          id?: string
          leave_type?: string
          reason?: string | null
          staff_id?: string
          staff_name?: string
          status?: string | null
          to_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      medicine_entries: {
        Row: {
          admission_id: string
          created_at: string
          dosage: string | null
          entry_date: string
          frequency: string | null
          hospital_id: string
          id: string
          medicine_name: string
          quantity: number | null
          total: number | null
          unit_price: number | null
        }
        Insert: {
          admission_id: string
          created_at?: string
          dosage?: string | null
          entry_date?: string
          frequency?: string | null
          hospital_id: string
          id?: string
          medicine_name: string
          quantity?: number | null
          total?: number | null
          unit_price?: number | null
        }
        Update: {
          admission_id?: string
          created_at?: string
          dosage?: string | null
          entry_date?: string
          frequency?: string | null
          hospital_id?: string
          id?: string
          medicine_name?: string
          quantity?: number | null
          total?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "medicine_entries_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "ipd_admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicine_entries_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      medicines: {
        Row: {
          batch_no: string | null
          category: string | null
          created_at: string
          expiry_date: string | null
          generic_name: string | null
          gst_percent: number | null
          hospital_id: string
          hsn_code: string | null
          id: string
          manufacturer: string | null
          mrp: number
          name: string
          stock: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          batch_no?: string | null
          category?: string | null
          created_at?: string
          expiry_date?: string | null
          generic_name?: string | null
          gst_percent?: number | null
          hospital_id: string
          hsn_code?: string | null
          id?: string
          manufacturer?: string | null
          mrp?: number
          name: string
          stock?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          batch_no?: string | null
          category?: string | null
          created_at?: string
          expiry_date?: string | null
          generic_name?: string | null
          gst_percent?: number | null
          hospital_id?: string
          hsn_code?: string | null
          id?: string
          manufacturer?: string | null
          mrp?: number
          name?: string
          stock?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicines_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      nurse_notes: {
        Row: {
          admission_id: string
          bp: string | null
          created_at: string
          hospital_id: string
          id: string
          note_date: string
          note_time: string | null
          notes: string | null
          nurse: string
          pulse: string | null
          spo2: string | null
          temp: string | null
        }
        Insert: {
          admission_id: string
          bp?: string | null
          created_at?: string
          hospital_id: string
          id?: string
          note_date?: string
          note_time?: string | null
          notes?: string | null
          nurse: string
          pulse?: string | null
          spo2?: string | null
          temp?: string | null
        }
        Update: {
          admission_id?: string
          bp?: string | null
          created_at?: string
          hospital_id?: string
          id?: string
          note_date?: string
          note_time?: string | null
          notes?: string | null
          nurse?: string
          pulse?: string | null
          spo2?: string | null
          temp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nurse_notes_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "ipd_admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nurse_notes_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          blood_group: string | null
          chronic_conditions: string | null
          created_at: string
          dob: string | null
          emergency_contact: string | null
          gender: string
          hospital_id: string
          id: string
          mobile: string
          name: string
          registration_number: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          blood_group?: string | null
          chronic_conditions?: string | null
          created_at?: string
          dob?: string | null
          emergency_contact?: string | null
          gender?: string
          hospital_id: string
          id?: string
          mobile: string
          name: string
          registration_number: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          blood_group?: string | null
          chronic_conditions?: string | null
          created_at?: string
          dob?: string | null
          emergency_contact?: string | null
          gender?: string
          hospital_id?: string
          id?: string
          mobile?: string
          name?: string
          registration_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_order_items: {
        Row: {
          amount: number | null
          batch_no: string | null
          discount: number | null
          gst_percent: number | null
          hospital_id: string
          id: string
          medicine_id: string | null
          medicine_name: string
          mrp: number | null
          order_id: string
          quantity: number
        }
        Insert: {
          amount?: number | null
          batch_no?: string | null
          discount?: number | null
          gst_percent?: number | null
          hospital_id: string
          id?: string
          medicine_id?: string | null
          medicine_name: string
          mrp?: number | null
          order_id: string
          quantity?: number
        }
        Update: {
          amount?: number | null
          batch_no?: string | null
          discount?: number | null
          gst_percent?: number | null
          hospital_id?: string
          id?: string
          medicine_id?: string | null
          medicine_name?: string
          mrp?: number | null
          order_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_order_items_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_order_items_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_orders: {
        Row: {
          age: number | null
          created_at: string
          discount: number | null
          doctor_name: string | null
          gender: string | null
          gst_amount: number | null
          hospital_id: string
          id: string
          issue_date: string
          issue_type: string
          mobile: string | null
          net_amount: number | null
          patient_name: string
          payment_mode: string | null
          registration_number: string | null
          status: string
          total_amount: number | null
        }
        Insert: {
          age?: number | null
          created_at?: string
          discount?: number | null
          doctor_name?: string | null
          gender?: string | null
          gst_amount?: number | null
          hospital_id: string
          id?: string
          issue_date?: string
          issue_type?: string
          mobile?: string | null
          net_amount?: number | null
          patient_name: string
          payment_mode?: string | null
          registration_number?: string | null
          status?: string
          total_amount?: number | null
        }
        Update: {
          age?: number | null
          created_at?: string
          discount?: number | null
          doctor_name?: string | null
          gender?: string | null
          gst_amount?: number | null
          hospital_id?: string
          id?: string
          issue_date?: string
          issue_type?: string
          mobile?: string | null
          net_amount?: number | null
          patient_name?: string
          payment_mode?: string | null
          registration_number?: string | null
          status?: string
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_orders_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          appointment_id: string
          created_at: string
          dosage: string | null
          duration: string | null
          frequency: string | null
          hospital_id: string
          id: string
          instructions: string | null
          medicine: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          dosage?: string | null
          duration?: string | null
          frequency?: string | null
          hospital_id: string
          id?: string
          instructions?: string | null
          medicine: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          dosage?: string | null
          duration?: string | null
          frequency?: string | null
          hospital_id?: string
          id?: string
          instructions?: string | null
          medicine?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      registration_counters: {
        Row: {
          counter: number
          hospital_id: string
        }
        Insert: {
          counter?: number
          hospital_id: string
        }
        Update: {
          counter?: number
          hospital_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_counters_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: true
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_advances: {
        Row: {
          amount: number
          approved_by: string | null
          created_at: string
          hospital_id: string
          id: string
          monthly_deduction: number | null
          reason: string | null
          repayment_months: number | null
          request_date: string
          staff_id: string
          staff_name: string
          status: string | null
        }
        Insert: {
          amount: number
          approved_by?: string | null
          created_at?: string
          hospital_id: string
          id?: string
          monthly_deduction?: number | null
          reason?: string | null
          repayment_months?: number | null
          request_date?: string
          staff_id: string
          staff_name: string
          status?: string | null
        }
        Update: {
          amount?: number
          approved_by?: string | null
          created_at?: string
          hospital_id?: string
          id?: string
          monthly_deduction?: number | null
          reason?: string | null
          repayment_months?: number | null
          request_date?: string
          staff_id?: string
          staff_name?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_advances_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_advances_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_records: {
        Row: {
          advance: number | null
          base_salary: number | null
          created_at: string
          da: number | null
          deductions: number | null
          esi: number | null
          hospital_id: string
          hra: number | null
          id: string
          month: string
          net_salary: number | null
          overtime: number | null
          paid_date: string | null
          pf: number | null
          special_allowance: number | null
          staff_id: string
          staff_name: string
          status: string | null
          tax: number | null
        }
        Insert: {
          advance?: number | null
          base_salary?: number | null
          created_at?: string
          da?: number | null
          deductions?: number | null
          esi?: number | null
          hospital_id: string
          hra?: number | null
          id?: string
          month: string
          net_salary?: number | null
          overtime?: number | null
          paid_date?: string | null
          pf?: number | null
          special_allowance?: number | null
          staff_id: string
          staff_name: string
          status?: string | null
          tax?: number | null
        }
        Update: {
          advance?: number | null
          base_salary?: number | null
          created_at?: string
          da?: number | null
          deductions?: number | null
          esi?: number | null
          hospital_id?: string
          hra?: number | null
          id?: string
          month?: string
          net_salary?: number | null
          overtime?: number | null
          paid_date?: string | null
          pf?: number | null
          special_allowance?: number | null
          staff_id?: string
          staff_name?: string
          status?: string | null
          tax?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_records_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_records_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          aadhar_no: string | null
          address: string | null
          bank_account: string | null
          bank_name: string | null
          base_salary: number | null
          blood_group: string | null
          created_at: string
          department: string | null
          designation: string | null
          email: string | null
          emergency_contact: string | null
          employee_id: string
          employment_type: string | null
          hospital_id: string
          id: string
          ifsc_code: string | null
          joining_date: string | null
          name: string
          pan_no: string | null
          phone: string | null
          qualification: string | null
          role: string
          specialization: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          aadhar_no?: string | null
          address?: string | null
          bank_account?: string | null
          bank_name?: string | null
          base_salary?: number | null
          blood_group?: string | null
          created_at?: string
          department?: string | null
          designation?: string | null
          email?: string | null
          emergency_contact?: string | null
          employee_id: string
          employment_type?: string | null
          hospital_id: string
          id?: string
          ifsc_code?: string | null
          joining_date?: string | null
          name: string
          pan_no?: string | null
          phone?: string | null
          qualification?: string | null
          role?: string
          specialization?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          aadhar_no?: string | null
          address?: string | null
          bank_account?: string | null
          bank_name?: string | null
          base_salary?: number | null
          blood_group?: string | null
          created_at?: string
          department?: string | null
          designation?: string | null
          email?: string | null
          emergency_contact?: string | null
          employee_id?: string
          employment_type?: string | null
          hospital_id?: string
          id?: string
          ifsc_code?: string | null
          joining_date?: string | null
          name?: string
          pan_no?: string | null
          phone?: string | null
          qualification?: string | null
          role?: string
          specialization?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          created_at: string
          from_dept: string
          hospital_id: string
          id: string
          item_id: string | null
          item_name: string
          notes: string | null
          quantity: number
          status: string
          to_dept: string
          transfer_date: string
          transferred_by: string | null
        }
        Insert: {
          created_at?: string
          from_dept: string
          hospital_id: string
          id?: string
          item_id?: string | null
          item_name: string
          notes?: string | null
          quantity: number
          status?: string
          to_dept: string
          transfer_date?: string
          transferred_by?: string | null
        }
        Update: {
          created_at?: string
          from_dept?: string
          hospital_id?: string
          id?: string
          item_id?: string | null
          item_name?: string
          notes?: string | null
          quantity?: number
          status?: string
          to_dept?: string
          transfer_date?: string
          transferred_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      surgical_entries: {
        Row: {
          admission_id: string
          cost: number | null
          created_at: string
          entry_date: string
          hospital_id: string
          id: string
          notes: string | null
          procedure_name: string
          surgeon: string | null
        }
        Insert: {
          admission_id: string
          cost?: number | null
          created_at?: string
          entry_date?: string
          hospital_id: string
          id?: string
          notes?: string | null
          procedure_name: string
          surgeon?: string | null
        }
        Update: {
          admission_id?: string
          cost?: number | null
          created_at?: string
          entry_date?: string
          hospital_id?: string
          id?: string
          notes?: string | null
          procedure_name?: string
          surgeon?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surgical_entries_admission_id_fkey"
            columns: ["admission_id"]
            isOneToOne: false
            referencedRelation: "ipd_admissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surgical_entries_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      time_slots: {
        Row: {
          booked_patients: number | null
          hospital_id: string
          id: string
          is_active: boolean | null
          max_patients: number | null
          schedule_id: string
          time: string
        }
        Insert: {
          booked_patients?: number | null
          hospital_id: string
          id?: string
          is_active?: boolean | null
          max_patients?: number | null
          schedule_id: string
          time: string
        }
        Update: {
          booked_patients?: number | null
          hospital_id?: string
          id?: string
          is_active?: boolean | null
          max_patients?: number | null
          schedule_id?: string
          time?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_slots_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_slots_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "doctor_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      user_module_permissions: {
        Row: {
          created_at: string
          hospital_id: string
          id: string
          module_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hospital_id: string
          id?: string
          module_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          hospital_id?: string
          id?: string
          module_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_module_permissions_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          hospital_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          hospital_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          hospital_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          avg_delivery_days: number | null
          categories: string[] | null
          contact: string | null
          created_at: string
          email: string | null
          gst_no: string | null
          hospital_id: string
          id: string
          last_order_date: string | null
          name: string
          rating: number | null
        }
        Insert: {
          avg_delivery_days?: number | null
          categories?: string[] | null
          contact?: string | null
          created_at?: string
          email?: string | null
          gst_no?: string | null
          hospital_id: string
          id?: string
          last_order_date?: string | null
          name: string
          rating?: number | null
        }
        Update: {
          avg_delivery_days?: number | null
          categories?: string[] | null
          contact?: string | null
          created_at?: string
          email?: string | null
          gst_no?: string | null
          hospital_id?: string
          id?: string
          last_order_date?: string | null
          name?: string
          rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      vitals: {
        Row: {
          appointment_id: string
          bp: string | null
          height: string | null
          hospital_id: string
          id: string
          pulse: string | null
          recorded_at: string
          spo2: string | null
          temperature: string | null
          weight: string | null
        }
        Insert: {
          appointment_id: string
          bp?: string | null
          height?: string | null
          hospital_id: string
          id?: string
          pulse?: string | null
          recorded_at?: string
          spo2?: string | null
          temperature?: string | null
          weight?: string | null
        }
        Update: {
          appointment_id?: string
          bp?: string | null
          height?: string | null
          hospital_id?: string
          id?: string
          pulse?: string | null
          recorded_at?: string
          spo2?: string | null
          temperature?: string | null
          weight?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vitals_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitals_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      wards: {
        Row: {
          charge_per_day: number | null
          created_at: string
          floor: string | null
          hospital_id: string
          id: string
          name: string
          total_beds: number | null
          type: string
        }
        Insert: {
          charge_per_day?: number | null
          created_at?: string
          floor?: string | null
          hospital_id: string
          id?: string
          name: string
          total_beds?: number | null
          type?: string
        }
        Update: {
          charge_per_day?: number | null
          created_at?: string
          floor?: string | null
          hospital_id?: string
          id?: string
          name?: string
          total_beds?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wards_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_hospital_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_registration_number: {
        Args: { _hospital_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "hospital_admin"
        | "doctor"
        | "nurse"
        | "staff"
        | "lab_technician"
        | "pharmacist"
        | "receptionist"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "hospital_admin",
        "doctor",
        "nurse",
        "staff",
        "lab_technician",
        "pharmacist",
        "receptionist",
      ],
    },
  },
} as const
