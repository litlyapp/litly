export type Genre =
  | "poetry"
  | "fiction"
  | "nonfiction"
  | "essay"
  | "hybrid_experimental"
  | "translation"
  | "ya"
  | "craft_talk"
  | "open_mic"
  | "workshop";

export type UserRole = "patron" | "organizer";
export type EventType = "in_person" | "virtual";
export type OrgType = "individual" | "organization";

export interface FeaturedReader {
  name: string;
  url: string;
}

export type RecurrenceFrequency = "weekly" | "biweekly" | "monthly_date" | "monthly_day";

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  day_of_week?: number;
  week_of_month?: number;
  until: string; // "YYYY-MM-DD"
}

export interface SocialLinks {
  twitter?: string;
  instagram?: string;
  facebook?: string;
  website?: string;
  [key: string]: string | undefined;
}

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          role: UserRole;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role?: UserRole;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          email?: string;
          role?: UserRole;
          display_name?: string | null;
        };
        Relationships: [];
      };
      organizer_profiles: {
        Row: {
          id: string;
          user_id: string;
          org_type: OrgType;
          name: string;
          bio: string | null;
          website: string | null;
          social_links: SocialLinks | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          org_type: OrgType;
          name: string;
          bio?: string | null;
          website?: string | null;
          social_links?: SocialLinks | null;
        };
        Update: {
          org_type?: OrgType;
          name?: string;
          bio?: string | null;
          website?: string | null;
          social_links?: SocialLinks | null;
        };
        Relationships: [
          {
            foreignKeyName: "organizer_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      events: {
        Row: {
          id: string;
          organizer_id: string;
          title: string;
          description: string | null;
          genre: Genre[];
          event_type: EventType;
          date_time: string;
          end_time: string | null;
          location_name: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          country: string | null;
          lat: number | null;
          lng: number | null;
          virtual_url: string | null;
          open_mic: boolean;
          featured_readers: FeaturedReader[] | null;
          rsvp_enabled: boolean;
          is_imported: boolean;
          source_url: string | null;
          source_name: string | null;
          banner_url: string | null;
          ticket_url: string | null;
          ticket_type: "paid" | "free" | null;
          view_count: number;
          ticket_click_count: number;
          recurrence_rule: RecurrenceRule | null;
          parent_event_id: string | null;
          is_cancelled: boolean;
          series_end_date: string | null;
          is_ongoing: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organizer_id: string;
          title: string;
          description?: string | null;
          genre: Genre[];
          event_type: EventType;
          date_time: string;
          end_time?: string | null;
          location_name?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          lat?: number | null;
          lng?: number | null;
          virtual_url?: string | null;
          open_mic?: boolean;
          featured_readers?: FeaturedReader[] | null;
          rsvp_enabled?: boolean;
          is_imported?: boolean;
          source_url?: string | null;
          source_name?: string | null;
          banner_url?: string | null;
          ticket_url?: string | null;
          ticket_type?: "paid" | "free" | null;
          view_count?: number;
          ticket_click_count?: number;
          recurrence_rule?: RecurrenceRule | null;
          parent_event_id?: string | null;
          is_cancelled?: boolean;
          series_end_date?: string | null;
          is_ongoing?: boolean;
          created_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          genre?: Genre[];
          event_type?: EventType;
          date_time?: string;
          end_time?: string | null;
          location_name?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          lat?: number | null;
          lng?: number | null;
          virtual_url?: string | null;
          open_mic?: boolean;
          featured_readers?: FeaturedReader[] | null;
          rsvp_enabled?: boolean;
          is_imported?: boolean;
          source_url?: string | null;
          source_name?: string | null;
          banner_url?: string | null;
          ticket_url?: string | null;
          ticket_type?: "paid" | "free" | null;
          recurrence_rule?: RecurrenceRule | null;
          parent_event_id?: string | null;
          is_cancelled?: boolean;
          series_end_date?: string | null;
          is_ongoing?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "events_organizer_id_fkey";
            columns: ["organizer_id"];
            isOneToOne: false;
            referencedRelation: "organizer_profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      saved_events: {
        Row: {
          id: string;
          user_id: string;
          event_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      rsvps: {
        Row: {
          id: string;
          user_id: string;
          event_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      follows: {
        Row: {
          id: string;
          patron_id: string;
          organizer_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          patron_id: string;
          organizer_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          patron_id?: string;
          organizer_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      genre: Genre;
      user_role: UserRole;
      event_type: EventType;
      org_type: OrgType;
    };
    CompositeTypes: Record<string, never>;
  };
};
