export type Choice = { value: string; label: string };

export type Role =
  | "capture_officer"
  | "land_officer"
  | "committee"
  | "board"
  | "minister"
  | "admin";

export type Status =
  | "received"
  | "queried"
  | "committee"
  | "board"
  | "minister"
  | "approved"
  | "rejected"
  | "withdrawn";

export type StageCode = "D" | "E" | "F" | "G";
export type Outcome = "positive" | "negative" | "query";

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: Role;
  role_display: string;
  province: string;
  province_display: string;
  employee_number: string;
  phone: string;
  is_active: boolean;
  last_login: string | null;
  date_joined: string;
}

export interface OfficerSummary {
  id: number;
  full_name: string;
  role: Role;
  role_display: string;
  province: string;
}

export interface Meta {
  provinces: Choice[];
  districts: Record<string, string[]>;
  titles: Choice[];
  sexes: Choice[];
  marital_statuses: Choice[];
  farm_types: Choice[];
  farming_types: Choice[];
  categories: Choice[];
  sources: Choice[];
  natural_regions: Choice[];
  statuses: Choice[];
  stages: Choice[];
  outcome_labels: Record<StageCode, Partial<Record<Outcome, string>>>;
  attachment_types: Choice[];
  required_attachments: string[];
  roles: Choice[];
  farm_size_schedule: { region: string; small: string; medium: string; large: string }[];
  peri_urban_size: string;
}

export interface Attachment {
  id: number;
  doc_type: string;
  doc_type_display: string;
  original_name: string;
  content_type: string;
  size: number;
  note: string;
  uploaded_by: OfficerSummary;
  uploaded_at: string;
}

export interface Review {
  id: number;
  stage: StageCode;
  stage_display: string;
  outcome: Outcome;
  outcome_display: string;
  comments: string;
  meeting_date: string | null;
  decision_date: string;
  signatory_name: string;
  signatory_designation: string;
  recorded_by: OfficerSummary;
  created_at: string;
}

export interface Activity {
  id: number;
  verb: string;
  verb_display: string;
  message: string;
  from_status: Status | "";
  to_status: Status | "";
  meta: Record<string, unknown>;
  actor: OfficerSummary;
  created_at: string;
}

export type NotificationEvent = "application_received" | "application_approved";

export interface ApplicantNotification {
  id: number;
  event: NotificationEvent;
  event_display: string;
  channel: "sms" | "email";
  channel_display: string;
  recipient: string;
  subject: string;
  body: string;
  status: "sent" | "failed";
  status_display: string;
  error_message: string;
  triggered_by: OfficerSummary | null;
  sent_at: string;
}

export interface ApplicationListItem {
  id: number;
  reference: string;
  application_no: string;
  title: string;
  surname: string;
  other_names: string;
  full_name: string;
  national_id: string;
  sex: string;
  province: string;
  province_display: string;
  preferred_province: string;
  preferred_province_display: string;
  preferred_district: string;
  farm_type: string;
  farm_type_display: string;
  farming_type: string;
  farming_type_display: string;
  status: Status;
  status_display: string;
  date_received: string;
  attachment_count: number;
  assigned_to: OfficerSummary | null;
  created_at: string;
  updated_at: string;
}

/** Fields captured on the paper form (sections A–C) plus registry details. */
export interface ApplicationInput {
  province: string;
  source: string;
  date_received: string;
  title: string;
  surname: string;
  other_names: string;
  sex: string;
  marital_status: string;
  national_id: string;
  date_of_birth: string | null;
  categories: string[];
  postal_address: string;
  residential_address: string;
  business_phone: string;
  residential_phone: string;
  mobile_phone: string;
  email: string;
  occupation: string;
  preferred_province: string;
  preferred_district: string;
  farm_type: string;
  farming_type: string;
  farming_type_other: string;
  experience_summary: string;
  resources_summary: string;
  declaration_name: string;
  declaration_date: string;
  declaration_signed: boolean;
}

export interface ApplicationDetail extends ApplicationInput {
  reference: string;
  application_no: string;
  full_name: string;
  status: Status;
  status_display: string;
  natural_region: string;
  allocated_unit: string;
  allocated_hectares: string | null;
  attachments: Attachment[];
  reviews: Review[];
  notifications: ApplicantNotification[];
  created_by: OfficerSummary;
  assigned_to: OfficerSummary | null;
  missing_attachments: string[];
  current_stage: {
    code: StageCode;
    label: string;
    role: Role;
    role_display: string;
    outcomes: Partial<Record<Outcome, string>>;
  } | null;
  permissions: { edit: boolean; delete: boolean; upload: boolean; decide: boolean; withdraw: boolean };
  duplicates: { reference: string; application_no: string; status: Status; date_received: string }[];
  created_at: string;
  updated_at: string;
  decided_at: string | null;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Stats {
  total: number;
  open: number;
  this_month: number;
  by_status: Partial<Record<Status, number>>;
  monthly: { month: string; received: number; approved: number }[];
  by_province: { preferred_province: string; n: number }[];
  by_farm_type: { farm_type: string; n: number }[];
  by_sex: Record<string, number>;
  avg_decision_days: number | null;
  my_queue: number;
  stale: number;
  missing_id: number;
  recent: (Activity & { application_no: string; application_reference: string; applicant: string })[];
}

